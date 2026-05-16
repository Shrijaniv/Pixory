import type { FastifyInstance } from "fastify";
import { INSTAGRAM_MAX_PHOTOS } from "../config";

// ── Types ────────────────────────────────────────────────────────────────────

interface PublishBody {
  photos_b64: string[];
  caption: string;
  username: string;
  password: string;
  location_lat?: number;
  location_lon?: number;
  location_name?: string;
}

interface SearchLocationBody {
  username: string;
  password: string;
  lat?: number;
  lon?: number;
  name?: string;
}

interface PublishResult {
  success: boolean;
  post_id?: string;
  error?: string;
}

const SIDECAR_URL = "http://127.0.0.1:8001";

// ── Route ────────────────────────────────────────────────────────────────────

export async function publishRoutes(app: FastifyInstance) {
  // ── Location search (proxied to Python sidecar) ──────────────────────────
  app.post<{ Body: SearchLocationBody }>("/api/search_location", async (request, reply) => {
    const { username, password, lat, lon, name } = request.body;
    if (!username || !password) {
      return reply.status(400).send({ locations: [] });
    }
    try {
      const res = await fetch(`${SIDECAR_URL}/search_location`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, lat, lon, name }),
        // @ts-ignore
        signal: AbortSignal.timeout(15_000),
      });
      return reply.send(await res.json());
    } catch {
      return reply.send({ locations: [] });
    }
  });

  app.post<{ Body: PublishBody }>("/api/publish_from_device", async (request, reply) => {
    const { photos_b64, caption, username, password, location_lat, location_lon, location_name } = request.body;

    if (!photos_b64 || photos_b64.length === 0) {
      return reply.status(400).send({ success: false, error: "No photos provided." });
    }
    if (photos_b64.length > INSTAGRAM_MAX_PHOTOS) {
      return reply.status(400).send({
        success: false,
        error: `Instagram carousels support a maximum of ${INSTAGRAM_MAX_PHOTOS} photos. You sent ${photos_b64.length}.`,
      });
    }
    if (!username || !password) {
      return reply.status(400).send({ success: false, error: "Username and password are required." });
    }

    request.log.info(`[publish] proxying ${photos_b64.length} photos for @${username} → Python sidecar`);

    try {
      const res = await fetch(`${SIDECAR_URL}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photos_b64, caption, username, password, location_lat, location_lon, location_name }),
        // @ts-ignore — Node 18+ fetch signal
        signal: AbortSignal.timeout(120_000), // 2-min timeout
      });

      const data = (await res.json()) as PublishResult;
      request.log.info(`[publish] sidecar response: success=${data.success} post_id=${data.post_id ?? "—"}`);

      if (!data.success) {
        const status = data.error?.toLowerCase().includes("challenge") ||
                       data.error?.toLowerCase().includes("checkpoint") ? 403 :
                       data.error?.toLowerCase().includes("login") ? 401 : 500;
        return reply.status(status).send(data);
      }

      return data;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      request.log.error({ err }, "[publish] sidecar unreachable");

      if (message.includes("ECONNREFUSED") || message.includes("fetch failed")) {
        return reply.status(503).send({
          success: false,
          error: "Instagram publish service is not running. Start it with: python backend/publish_sidecar.py",
        });
      }

      return reply.status(500).send({ success: false, error: message });
    }
  });

  // Proxy session clear to sidecar
  app.delete<{ Params: { username: string } }>("/api/session/:username", async (request, reply) => {
    try {
      await fetch(`${SIDECAR_URL}/session/${request.params.username}`, { method: "DELETE" });
    } catch { /* sidecar may not be running */ }
    return { success: true };
  });
}
