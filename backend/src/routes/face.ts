/**
 * Face identity routes — thin HTTP handlers.
 * Proxy calls to the Python sidecar which runs DeepFace.
 */
import type { FastifyInstance } from 'fastify';
import type { MatchFacesBody, MatchFacesResult, RegisterFaceBody, RegisterFaceResult } from '../types/faceTypes';
import { fetchSidecar } from '../services/sidecarClient';

export async function faceRoutes(app: FastifyInstance) {
  /**
   * POST /api/register_face
   * Extracts a Facenet128 embedding from a reference selfie.
   * Called once during "Who Are You?" face-setup flow.
   */
  app.post<{ Body: RegisterFaceBody }>('/api/register_face', async (request, reply) => {
    const { photo_b64 } = request.body;
    if (!photo_b64) {
      return reply.status(400).send({ success: false, error: 'photo_b64 is required' });
    }

    try {
      const result = await fetchSidecar<RegisterFaceResult>(
        '/register_face',
        { photo_b64 },
        30_000, // embedding extraction ~5s
      );
      return reply.send(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      request.log.error({ err }, '[face] register_face sidecar error');
      return reply.status(503).send({ success: false, error: message });
    }
  });

  /**
   * POST /api/match_faces
   * Compares a reference embedding against a batch of candidate photos.
   * Fail-open: on network errors returns all photos as user-present.
   */
  app.post<{ Body: MatchFacesBody }>('/api/match_faces', async (request, reply) => {
    const { reference_embedding, photos, threshold } = request.body;
    if (!reference_embedding?.length || !photos?.length) {
      return reply.send({ matches: [] });
    }

    request.log.info(`[face] match_faces: ${photos.length} photos`);

    try {
      const result = await fetchSidecar<MatchFacesResult>(
        '/match_faces',
        { reference_embedding, photos, threshold },
        120_000, // ~200–500ms per photo via DeepFace
      );
      return reply.send(result);
    } catch (err: unknown) {
      request.log.error({ err }, '[face] match_faces sidecar error — failing open');
      // Fail-open: return all photos as user-present so curation isn't blocked
      return reply.send({
        matches: photos.map((p) => ({ index: p.index, user_face_present: true, similarity: 0.5 })),
      });
    }
  });
}
