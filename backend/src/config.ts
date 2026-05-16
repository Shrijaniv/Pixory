import "dotenv/config";

// ── AI Model Constants ──────────────────────────────────────────────────────
// Opus for vision curation (sending photos, selecting best, writing captions)
export const CLAUDE_VISION_MODEL = "claude-opus-4-5";
// Sonnet for agent tool-use loop (desktop pipeline)
export const CLAUDE_AGENT_MODEL = "claude-sonnet-4-5";
// GPT-4o for OpenAI vision path
export const OPENAI_VISION_MODEL = "gpt-4o";

// ── API Keys ────────────────────────────────────────────────────────────────
export const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? "";
export const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? "";

// ── Server Config ───────────────────────────────────────────────────────────
export const PORT = parseInt(process.env.PORT ?? "8000", 10);
export const HOST = process.env.HOST ?? "0.0.0.0";

// ── Instagram Carousel Limit ────────────────────────────────────────────────
export const INSTAGRAM_MAX_PHOTOS = 10;
