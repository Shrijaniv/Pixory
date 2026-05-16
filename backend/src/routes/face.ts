import type { FastifyInstance } from "fastify";

const SIDECAR_URL = "http://127.0.0.1:8001";

// ── Types ────────────────────────────────────────────────────────────────────

interface RegisterFaceBody {
  photo_b64: string;
}

interface MatchFacesBody {
  reference_embedding: number[];
  photos: Array<{ index: number; data_b64: string }>;
  threshold?: number;
}

// ── Routes ───────────────────────────────────────────────────────────────────

export async function faceRoutes(app: FastifyInstance) {
  /**
   * POST /api/register_face
   * Extracts a Facenet128 embedding from a reference photo.
   * Called once during "Who Are You?" setup.
   * Returns: { success, embedding: number[], error? }
   */
  app.post<{ Body: RegisterFaceBody }>("/api/register_face", async (request, reply) => {
    const { photo_b64 } = request.body;
    if (!photo_b64) {
      return reply.status(400).send({ success: false, error: "photo_b64 is required" });
    }

    try {
      const res = await fetch(`${SIDECAR_URL}/register_face`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photo_b64 }),
        // @ts-ignore — Node 18+ AbortSignal
        signal: AbortSignal.timeout(30_000), // embedding extraction can take ~5s
      });
      return reply.send(await res.json());
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      request.log.error({ err }, "[face] register_face sidecar error");
      if (message.includes("ECONNREFUSED") || message.includes("fetch failed")) {
        return reply.status(503).send({
          success: false,
          error: "Sidecar not running. Start it with: python backend/publish_sidecar.py",
        });
      }
      return reply.status(500).send({ success: false, error: message });
    }
  });

  /**
   * POST /api/match_faces
   * Compares a reference embedding against candidate photos.
   * Returns: { matches: [{ index, user_face_present, similarity }] }
   */
  app.post<{ Body: MatchFacesBody }>("/api/match_faces", async (request, reply) => {
    const { reference_embedding, photos, threshold } = request.body;
    if (!reference_embedding?.length || !photos?.length) {
      return reply.status(400).send({ matches: [] });
    }

    request.log.info(`[face] match_faces: checking ${photos.length} photos`);

    try {
      const res = await fetch(`${SIDECAR_URL}/match_faces`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reference_embedding, photos, threshold }),
        // @ts-ignore
        signal: AbortSignal.timeout(120_000), // ~200-500ms per photo via DeepFace
      });
      return reply.send(await res.json());
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      request.log.error({ err }, "[face] match_faces sidecar error");
      // Fail-open: return all photos as user-present so curation isn't blocked
      return reply.send({
        matches: photos.map((p) => ({ index: p.index, user_face_present: true, similarity: 0.5 })),
      });
    }
  });
}
