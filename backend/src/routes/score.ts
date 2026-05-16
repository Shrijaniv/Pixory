import { FastifyInstance } from "fastify";

const SIDECAR_URL = "http://127.0.0.1:8001";

export async function scoreRoutes(fastify: FastifyInstance) {
  // Proxy POST /api/score_photos → Python sidecar /score_photos
  fastify.post("/api/score_photos", async (req, reply) => {
    try {
      const resp = await fetch(`${SIDECAR_URL}/score_photos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req.body),
      });
      if (!resp.ok) {
        const text = await resp.text();
        return reply.status(502).send({ error: `Sidecar error: ${text}` });
      }
      return reply.send(await resp.json());
    } catch (err: any) {
      return reply.status(503).send({ error: `Scoring sidecar unavailable: ${err?.message}` });
    }
  });
}
