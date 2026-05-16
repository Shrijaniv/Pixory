/**
 * Publish routes — thin HTTP handlers.
 * Proxy photo publishing and location search to the Python sidecar.
 */
import type { FastifyInstance } from 'fastify';
import { INSTAGRAM_MAX_PHOTOS } from '../config';
import type { PublishBody, PublishResult, SearchLocationBody } from '../types/publishTypes';
import { deleteSidecar, fetchSidecar } from '../services/sidecarClient';

export async function publishRoutes(app: FastifyInstance) {
  // ── POST /api/search_location ────────────────────────────────────────────────
  app.post<{ Body: SearchLocationBody }>('/api/search_location', async (request, reply) => {
    const { username, password, lat, lon, name } = request.body;
    if (!username || !password) {
      return reply.send({ locations: [] });
    }

    try {
      const result = await fetchSidecar('/search_location', { username, password, lat, lon, name }, 15_000);
      return reply.send(result);
    } catch {
      return reply.send({ locations: [] });
    }
  });

  // ── POST /api/publish_from_device ────────────────────────────────────────────
  app.post<{ Body: PublishBody }>('/api/publish_from_device', async (request, reply) => {
    const { photos_b64, caption, username, password, location_lat, location_lon, location_name } = request.body;

    if (!photos_b64 || photos_b64.length === 0) {
      return reply.status(400).send({ success: false, error: 'No photos provided.' });
    }
    if (photos_b64.length > INSTAGRAM_MAX_PHOTOS) {
      return reply.status(400).send({
        success: false,
        error: `Instagram carousels support a maximum of ${INSTAGRAM_MAX_PHOTOS} photos. You sent ${photos_b64.length}.`,
      });
    }
    if (!username || !password) {
      return reply.status(400).send({ success: false, error: 'Username and password are required.' });
    }

    request.log.info(`[publish] ${photos_b64.length} photos for @${username}`);

    try {
      const data = await fetchSidecar<PublishResult>(
        '/publish',
        { photos_b64, caption, username, password, location_lat, location_lon, location_name },
        120_000,
      );
      request.log.info(`[publish] success=${data.success} post_id=${data.post_id ?? '—'}`);

      if (!data.success) {
        const err = data.error?.toLowerCase() ?? '';
        const status = err.includes('challenge') || err.includes('checkpoint') ? 403
          : err.includes('login') ? 401
          : 500;
        return reply.status(status).send(data);
      }

      return data;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      request.log.error({ err }, '[publish] sidecar error');
      return reply.status(503).send({ success: false, error: message });
    }
  });

  // ── DELETE /api/session/:username ─────────────────────────────────────────────
  app.delete<{ Params: { username: string } }>('/api/session/:username', async (request, reply) => {
    await deleteSidecar(`/session/${request.params.username}`);
    return { success: true };
  });
}
