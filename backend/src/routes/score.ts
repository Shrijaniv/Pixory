/**
 * Score route — proxies photo scoring to the Python sidecar (OpenCV + DeepFace).
 */
import type { FastifyInstance } from 'fastify';
import { fetchSidecar } from '../services/sidecarClient';

export async function scoreRoutes(app: FastifyInstance) {
  // POST /api/score_photos → Python sidecar /score_photos
  app.post('/api/score_photos', async (req, reply) => {
    try {
      const result = await fetchSidecar('/score_photos', req.body, 120_000);
      return reply.send(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return reply.status(503).send({ error: `Scoring sidecar unavailable: ${message}` });
    }
  });
}
