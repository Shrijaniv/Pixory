/**
 * Curation routes — thin HTTP handlers.
 * Business logic lives in src/services/aiCurator.ts and src/services/promptBuilder.ts.
 */
import type { FastifyInstance } from 'fastify';
import { ANTHROPIC_API_KEY, OPENAI_API_KEY, CLAUDE_VISION_MODEL, OPENAI_VISION_MODEL } from '../config';
import type { AssignRolesBody, CurateBody, CurateResult } from '../types/curateTypes';
import { curateWithClaude, curateWithOpenAI, assignRolesWithClaude, assignRolesWithOpenAI } from '../services/aiCurator';
import { resizeToBase64 } from '../services/imageProcessor';

export async function curateRoutes(app: FastifyInstance) {
  // ── POST /api/curate_device_photos ─────────────────────────────────────────
  // Accepts candidate photos from the mobile app, calls AI vision, returns
  // selected indices, roles, ordering, story, and caption variants.
  app.post<{ Body: CurateBody }>('/api/curate_device_photos', async (request, reply) => {
    const {
      photos_b64,
      photo_names,
      favorite_indices,
      vibe,
      max_select = 10,
      provider = 'claude',
      face_profiles,
      content_mix,
      persona,
    } = request.body;

    if (provider === 'claude' && !ANTHROPIC_API_KEY) {
      return reply.status(400).send({ success: false, error: 'ANTHROPIC_API_KEY not set on the backend.' });
    }
    if (provider === 'openai' && !OPENAI_API_KEY) {
      return reply.status(400).send({ success: false, error: 'OPENAI_API_KEY not set on the backend.' });
    }
    if (!photos_b64 || photos_b64.length === 0) {
      return reply.status(400).send({ success: false, error: 'No photos provided.' });
    }

    try {
      // GPT-4o has a lower TPM limit — cap at 35 photos, 512px; Claude gets 50 at 1024px
      const isOpenAI = provider === 'openai';
      const maxPhotos = isOpenAI ? 35 : 50;
      const maxPx     = isOpenAI ? 512 : 1024;
      const inputPhotos = photos_b64.slice(0, maxPhotos);
      const inputNames  = (photo_names ?? []).slice(0, maxPhotos);
      const inputFavs   = favorite_indices?.filter((i) => i < maxPhotos);

      request.log.info(
        `[curate] ${photos_b64.length} photos → ${inputPhotos.length}, ` +
        `provider=${provider}, persona=${persona ?? 'none'}, vibe="${vibe ?? ''}"`,
      );

      const t0 = Date.now();
      const resized = await Promise.all(inputPhotos.map((b64) => resizeToBase64(b64, maxPx)));
      request.log.info(`[curate] resized in ${Date.now() - t0}ms`);

      const t1 = Date.now();
      const model = provider === 'claude' ? CLAUDE_VISION_MODEL : OPENAI_VISION_MODEL;
      request.log.info(`[curate] calling ${provider} (${model})...`);

      const result = provider === 'claude'
        ? await curateWithClaude(resized, inputNames, vibe, max_select, face_profiles, inputFavs, content_mix, persona)
        : await curateWithOpenAI(resized, inputNames, vibe, max_select, face_profiles, inputFavs, content_mix, persona);

      request.log.info(`[curate] done in ${Date.now() - t1}ms — selected ${result.selected_indices?.length ?? 0}`);
      return { success: true, ...result };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      request.log.error({ err }, '[curate] failed');
      return reply.status(500).send({ success: false, error: message });
    }
  });

  // ── POST /api/assign_roles ──────────────────────────────────────────────────
  // Called when user adds/removes photos in the review screen.
  // All submitted photos are the FINAL selection — AI assigns beats + ordering.
  app.post<{ Body: AssignRolesBody }>('/api/assign_roles', async (request, reply) => {
    const { photos_b64, photo_names, vibe, story, persona, provider = 'claude' } = request.body;

    if (provider === 'claude' && !ANTHROPIC_API_KEY) {
      return reply.status(400).send({ success: false, error: 'ANTHROPIC_API_KEY not set.' });
    }
    if (provider === 'openai' && !OPENAI_API_KEY) {
      return reply.status(400).send({ success: false, error: 'OPENAI_API_KEY not set.' });
    }
    if (!photos_b64 || photos_b64.length === 0) {
      return reply.status(400).send({ success: false, error: 'No photos provided.' });
    }

    try {
      const resized = await Promise.all(photos_b64.map((b64) => resizeToBase64(b64, 512)));
      const names = photo_names ?? [];

      request.log.info(`[assign_roles] ${resized.length} photos, provider=${provider}, persona=${persona ?? 'none'}`);
      const t = Date.now();

      const result = provider === 'claude'
        ? await assignRolesWithClaude(resized, names, vibe, story, persona)
        : await assignRolesWithOpenAI(resized, names, vibe, story, persona);

      request.log.info(`[assign_roles] done in ${Date.now() - t}ms`);
      return { success: true, ...result };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      request.log.error({ err }, '[assign_roles] failed');
      return reply.status(500).send({ success: false, error: message });
    }
  });
}

// Re-export for any direct usage (e.g. eval scripts)
export { buildSystemPrompt, buildRolePrompt } from '../services/promptBuilder';
