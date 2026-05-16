import "dotenv/config";
import Fastify from "fastify";
import { HOST, PORT } from "./config";
import { curateRoutes } from "./routes/curate";
import { faceRoutes } from "./routes/face";
import { publishRoutes } from "./routes/publish";
import { scoreRoutes } from "./routes/score";

async function main() {
  const app = Fastify({ logger: true, bodyLimit: 100 * 1024 * 1024 }); // 100MB

  // ── CORS ───────────────────────────────────────────────────────────────────
  // Allow all origins — this backend is self-hosted by the user
  app.addHook("onSend", async (_request, reply) => {
    reply.header("Access-Control-Allow-Origin", "*");
    reply.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    reply.header("Access-Control-Allow-Headers", "Content-Type");
  });
  app.options("*", async (_request, reply) => {
    return reply.status(204).send();
  });

  // ── Routes ─────────────────────────────────────────────────────────────────
  await app.register(curateRoutes);
  await app.register(faceRoutes);
  await app.register(publishRoutes);
  await app.register(scoreRoutes);

  // ── Health check ────────────────────────────────────────────────────────────
  app.get("/health", async () => ({ status: "ok", version: "1.0.0" }));

  // ── Start ───────────────────────────────────────────────────────────────────
  await app.listen({ port: PORT, host: HOST });
  console.log(`Pixory backend running on http://${HOST}:${PORT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
