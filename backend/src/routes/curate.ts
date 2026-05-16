import type { FastifyInstance } from "fastify";
import sharp from "sharp";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import {
  ANTHROPIC_API_KEY,
  OPENAI_API_KEY,
  CLAUDE_VISION_MODEL,
  OPENAI_VISION_MODEL,
} from "../config";

// ── Types ───────────────────────────────────────────────────────────────────

interface Caption {
  mood: "wanderlust" | "minimal" | "story" | "playful";
  text: string;
  hashtags: string[];
}

interface FaceProfile {
  name: string;
  samplePhotoB64: string; // base64 JPEG of a face crop
}

interface CurateBody {
  photos_b64: string[];       // base64 JPEG for each candidate photo
  photo_names: string[];      // filenames for display in prompt
  favorite_indices?: number[]; // indices of photos the user has heart-favorited in iOS Photos
  vibe?: string;
  max_select?: number;        // how many the AI should pick (default 10)
  provider?: "claude" | "openai";
  face_profiles?: FaceProfile[];
  content_mix?: "people" | "balanced" | "places";
  persona?: string;           // storytelling persona key (aesthete|social|logger|storyteller|minimalist)
}

interface PhotoRole {
  index: number;
  role: "hook" | "world" | "life" | "detail" | "closer";
  reason: string;
}

interface CurateResult {
  success: boolean;
  selected_indices?: number[];
  photo_roles?: PhotoRole[];
  ordering?: number[];
  story?: string;
  missing?: string | null;
  captions?: Caption[];
  notes?: string;
  error?: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

async function resizeToBase64(b64: string, maxPx = 1024): Promise<string> {
  const buf = Buffer.from(b64, "base64");
  const resized = await sharp(buf)
    .resize(maxPx, maxPx, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toBuffer();
  return resized.toString("base64");
}

// ── Persona clauses ───────────────────────────────────────────────────────────

function buildPersonaClause(persona: string | undefined, maxSelect: number): string {
  if (!persona) return "";
  switch (persona) {
    case "aesthete":
      return (
        `\n\n━━ POSTING PERSONA: THE AESTHETE ━━\n` +
        `This user has a consistent grid. They will reject a perfect moment because the colors clash. ` +
        `Select photos where tones, saturation, and overall mood are coherent across the entire carousel. ` +
        `A sharp photo with clashing colors is WORSE than a softer photo that fits the palette. ` +
        `Every slide must feel like it belongs to the same visual set. ` +
        `Reject visual outliers even if they are emotionally strong. ` +
        `Faces are irrelevant unless the portrait composition is impeccable and fits the palette.`
      );
    case "social":
      return (
        `\n\n━━ POSTING PERSONA: THE SOCIAL CONNECTOR ━━\n` +
        `Every slide needs to have people in it. Landscapes without people feel empty to this user. ` +
        `"Tag me in that one" is the success metric — faces must be visible and expressions genuine. ` +
        `Prefer group shots, candid laughs, and moments where friends would want to tag themselves. ` +
        `A blurry portrait of laughing friends beats a technically perfect empty landscape. ` +
        `Select landscape/scene-only shots ONLY as establishing context between people shots.`
      );
    case "logger":
      return (
        `\n\n━━ POSTING PERSONA: THE EXPERIENCE LOGGER ━━\n` +
        `"I was here, I did this." This user has a documentary instinct. ` +
        `Slightly rough edges feel authentic — they would post the blurry photo from the boat because it was a real moment. ` +
        `Do NOT penalise imperfect exposure, motion blur, or unconventional framing if it captures genuine experience. ` +
        `Prefer chronological storytelling. Photos the user hearted (♥) are especially valuable — ` +
        `they captured them in the moment for a reason. ` +
        `A posed, perfectly-lit photo of nothing is worse than a shaky, real one.`
      );
    case "storyteller":
      return (
        `\n\n━━ POSTING PERSONA: THE STORYTELLER ━━\n` +
        `This user thinks in sequences. They will swap a better photo for a worse one because it ` +
        `transitions better to the next slide. The emotional arc across all slides IS the product. ` +
        `Actively prioritise visual variety — a wide shot must be followed by something different in scale or subject. ` +
        `No two adjacent slides should have the same composition, focal length, or subject type. ` +
        `The ordering you suggest is as important as the photos you select. ` +
        `A set of ${maxSelect} photos that tells a complete arc beats ${maxSelect} individually great photos with no flow.`
      );
    case "minimalist":
      return (
        `\n\n━━ POSTING PERSONA: THE MINIMALIST ━━\n` +
        `This user would rather post ${maxSelect} perfect photos than ${maxSelect + 5} good ones. Less is always more. ` +
        `Every photo must be exceptional — if it is merely "good", do NOT include it. ` +
        `Prefer clean compositions, uncluttered backgrounds, and impeccable light. ` +
        `Actively resist filling all ${maxSelect} slots — selecting fewer is a sign of editorial discipline, not failure. ` +
        `A carousel of ${maxSelect - 1} extraordinary photos is better than ${maxSelect} with one that's just okay.`
      );
    default:
      return "";
  }
}

export function buildSystemPrompt(
  count: number,
  maxSelect: number,
  vibe: string | undefined,
  faceProfiles: FaceProfile[] | undefined,
  favoriteIndices: number[] | undefined,
  contentMix?: string,
  persona?: string,
): string {
  const personaClause = buildPersonaClause(persona, maxSelect);

  // When a persona is set, the story intent ("what's the story") is the primary
  // creative brief. The content-mix clause is suppressed — persona already defines
  // what kind of photos to prefer.
  const vibeClause = vibe
    ? persona
      ? `\n\nThe story the user wants to tell this time: "${vibe}". Let this shape the narrative arc and caption copy.`
      : `\n\nThe user's requested vibe/theme is: "${vibe}". This is the most important selection criterion — actively prefer photos that match this mood, subject matter, lighting style, or aesthetic. Reject otherwise-good photos that clearly clash with the vibe.`
    : "";

  let faceClause = "";
  if (faceProfiles && faceProfiles.length > 0) {
    const names = faceProfiles.map((f) => `"${f.name}"`).join(", ");
    faceClause = `\n\nThe user has provided face profiles for the following people: ${names}. When selecting photos, prefer shots that prominently feature these individuals. The sample face images are included at the end of this message.`;
  }

  let favClause = "";
  if (favoriteIndices && favoriteIndices.length > 0) {
    favClause = `\n\nThe user has personally heart-favorited these photos in their iOS Photos app: indices [${favoriteIndices.join(", ")}]. ` +
      `These are photos the user already loves — treat them as MUST-INCLUDE unless they are near-duplicates of each other. ` +
      `If there are more favorites than ${maxSelect} slots, keep the best ones and fill remaining slots with top non-favorites.`;
  }

  // Content mix clause is only shown when no persona is set — persona already
  // implies a content preference, and showing both would create conflicting signals.
  const mixClause = persona ? "" : contentMix === "people"
    ? `\n\nCONTENT MIX: The user wants a people-focused carousel. Strongly prefer photos featuring people, faces, portraits, and candid moments. Select landscape/scene-only shots only when they are exceptional or provide crucial context.`
    : contentMix === "places"
    ? `\n\nCONTENT MIX: The user wants a places-focused carousel. Prefer landscapes, architecture, food, and atmospheric scenes. You may include people photos but don't prioritise them over interesting scenery.`
    : `\n\nCONTENT MIX: The user wants a balanced Instagram carousel — a healthy mix of people shots and place/scene shots. Aim for roughly half-and-half. Avoid selecting all portraits or all landscapes.`;

  return (
    `You are crafting an Instagram carousel post — not just picking good photos, but editing a short film.\n\n` +

    `You have ${count} candidate photos to work with.` +
    personaClause +
    vibeClause +
    faceClause +
    favClause +
    mixClause +

    `\n\n━━ YOUR TASK ━━\n` +
    `Build a carousel of ${maxSelect} photos that tells a coherent story. ` +
    `A viewer will swipe through this in about 8 seconds. ` +
    `They should feel something — not just see nice photos.\n\n` +

    `━━ STORY BEATS ━━\n` +
    `Assign each selected photo one of these roles:\n\n` +
    `• HOOK (exactly 1): The first slide — the scroll-stopper. Visually arresting, sets the entire tone. ` +
    `Strong composition, compelling light, or an emotionally immediate image. This is the thumbnail.\n\n` +
    `• WORLD (1–2 photos): Establishes where this is and what it feels like. ` +
    `Wide shots, atmosphere, scale. The viewer gets transported.\n\n` +
    `• LIFE (2–4 photos): The human element. Candid moments, experiences being lived, not posed. ` +
    `Laughter, movement, interaction. The "I wish I was there" slides.\n\n` +
    `• DETAIL (1–2 photos): Close-ups that reward the person who keeps swiping. ` +
    `Food, textures, small moments, intimate observations. Feels intentional and personal.\n\n` +
    `• CLOSER (exactly 1): The emotional punctuation of the last slide. ` +
    `Often a portrait, a sunset, a quiet moment. Leaves the viewer with a feeling, not just a visual.\n\n` +

    `━━ ORDERING ━━\n` +
    `Suggest the ideal viewing order. This is NOT necessarily chronological — it is the order that creates ` +
    `the best emotional arc. Hook always goes first. Closer always goes last. Everything in between ` +
    `should build toward something.\n\n` +

    `━━ SELECTION PRINCIPLES ━━\n` +
    `1. Does this photo serve a clear narrative purpose? (most important)\n` +
    (favClause ? `2. Favorited photos (♥) are must-include unless a near-duplicate fills the same role better\n` : "") +
    (vibe ? `${favClause ? "3" : "2"}. Vibe match — does this embody "${vibe}"?\n` : "") +
    `${[favClause, vibe].filter(Boolean).length + 2}. Technical quality — sharpness, exposure, composition\n` +
    `${[favClause, vibe].filter(Boolean).length + 3}. No near-duplicates in the same story beat\n\n` +

    `━━ MISSING BEATS ━━\n` +
    `If the candidate pool genuinely cannot fill a story beat (e.g. no close-up detail shots exist), ` +
    `note it in "missing". If nothing is missing, set "missing" to null.\n\n` +

    `━━ CAPTIONS ━━\n` +
    `Write 4 caption variants that reflect the actual story of this specific carousel — not generic travel copy. ` +
    `Reference the real moments and places. Each should feel like a different voice posting the same experience.\n\n` +

    `Respond with ONLY valid JSON — no markdown, no explanation:\n` +
    `{\n` +
    `  "story": "One sentence: what does this carousel tell? e.g. 'A golden afternoon wandering the old city, ending with dinner by the water'",\n` +
    `  "selected": [\n` +
    `    {"index": 4, "role": "hook",   "reason": "Wide golden-hour square shot, immediately transporting"},\n` +
    `    {"index": 12, "role": "world",  "reason": "Establishes the narrow alley architecture"},\n` +
    `    {"index": 7,  "role": "life",   "reason": "Candid laugh at the café, genuinely joyful"},\n` +
    `    {"index": 23, "role": "detail", "reason": "Close-up of the pasta dish, rewards the swiper"},\n` +
    `    {"index": 1,  "role": "closer", "reason": "Quiet portrait at dusk, emotional punctuation"}\n` +
    `  ],\n` +
    `  "ordering": [4, 12, 7, 23, 1],\n` +
    `  "missing": "No close-up detail shot available — the set lacks an intimate moment" or null,\n` +
    `  "captions": [\n` +
    `    {"mood": "wanderlust", "text": "caption referencing the actual story", "hashtags": ["relevant", "tags"]},\n` +
    `    {"mood": "minimal",    "text": "shorter, quieter version", "hashtags": ["minimal"]},\n` +
    `    {"mood": "story",      "text": "narrative version, first-person, specific details", "hashtags": ["story", "travel"]},\n` +
    `    {"mood": "playful",    "text": "lighter, funnier take on the same experience", "hashtags": ["fun"]}\n` +
    `  ]\n` +
    `}`
  );
}

function parseAiResponse(text: string): Omit<CurateResult, "success"> {
  // Strip markdown code fences if present
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();

  // Detect prose refusals before attempting JSON.parse — saves a confusing stack trace
  if (!cleaned.startsWith("{") && !cleaned.startsWith("[")) {
    const preview = cleaned.slice(0, 120);
    throw new Error(`AI returned prose instead of JSON: "${preview}" — try Claude instead or retry`);
  }

  const parsed = JSON.parse(cleaned);

  // If JSON parsed but contains no selection data (e.g. {"error": "..."} refusal in JSON mode)
  if (!parsed.selected && !parsed.selected_indices) {
    const errKey = parsed.error ?? parsed.message ?? parsed.reason ?? JSON.stringify(parsed).slice(0, 120);
    throw new Error(`AI returned an error response: ${errKey}`);
  }

  // New schema: parsed.selected is [{index, role, reason}]
  const selected: Array<{ index: number; role: string; reason: string }> = parsed.selected ?? [];
  const selectedIndices = selected.map((s) => s.index);
  const photoRoles: PhotoRole[] = selected.map((s) => ({
    index: s.index,
    role: s.role as PhotoRole["role"],
    reason: s.reason,
  }));

  return {
    selected_indices: selectedIndices,
    photo_roles: photoRoles,
    ordering: parsed.ordering ?? selectedIndices,
    story: parsed.story ?? "",
    missing: parsed.missing ?? null,
    captions: parsed.captions ?? [],
    notes: parsed.notes ?? "",
  };
}

// ── Claude curation ──────────────────────────────────────────────────────────

async function curateWithClaude(
  photos: string[],         // already-resized base64
  names: string[],
  vibe: string | undefined,
  maxSelect: number,
  faceProfiles?: FaceProfile[],
  favoriteIndices?: number[],
  contentMix?: string,
  persona?: string,
): Promise<Omit<CurateResult, "success">> {
  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

  const content: Anthropic.MessageParam["content"] = [];

  // Add candidate photos — mark favorites inline so the AI can see them
  for (let i = 0; i < photos.length; i++) {
    content.push({
      type: "image",
      source: { type: "base64", media_type: "image/jpeg", data: photos[i] },
    });
    const favTag = favoriteIndices?.includes(i) ? " ♥ FAVORITED" : "";
    content.push({
      type: "text",
      text: `Photo ${i}: ${names[i] ?? `photo_${i}`}${favTag}`,
    });
  }

  // Add face profile samples
  if (faceProfiles && faceProfiles.length > 0) {
    content.push({ type: "text", text: "\n--- Face profiles for people to prioritize ---" });
    for (const fp of faceProfiles) {
      content.push({
        type: "image",
        source: { type: "base64", media_type: "image/jpeg", data: fp.samplePhotoB64 },
      });
      content.push({ type: "text", text: `Person named: ${fp.name}` });
    }
  }

  content.push({
    type: "text",
    text: buildSystemPrompt(photos.length, maxSelect, vibe, faceProfiles, favoriteIndices, contentMix, persona),
  });

  const response = await client.messages.create({
    model: CLAUDE_VISION_MODEL,
    max_tokens: 2048,
    messages: [{ role: "user", content }],
  });

  const text = (response.content[0] as Anthropic.TextBlock).text;
  return parseAiResponse(text);
}

// ── OpenAI curation ──────────────────────────────────────────────────────────

async function curateWithOpenAI(
  photos: string[],
  names: string[],
  vibe: string | undefined,
  maxSelect: number,
  faceProfiles?: FaceProfile[],
  favoriteIndices?: number[],
  contentMix?: string,
  persona?: string,
): Promise<Omit<CurateResult, "success">> {
  const client = new OpenAI({ apiKey: OPENAI_API_KEY });

  const imageContent: OpenAI.Chat.ChatCompletionContentPart[] = [];

  for (let i = 0; i < photos.length; i++) {
    imageContent.push({
      type: "image_url",
      image_url: { url: `data:image/jpeg;base64,${photos[i]}`, detail: "low" },
    });
    const favTag = favoriteIndices?.includes(i) ? " ♥ FAVORITED" : "";
    imageContent.push({ type: "text", text: `Photo ${i}: ${names[i] ?? `photo_${i}`}${favTag}` });
  }

  if (faceProfiles && faceProfiles.length > 0) {
    imageContent.push({ type: "text", text: "\n--- Face profiles for people to prioritize ---" });
    for (const fp of faceProfiles) {
      imageContent.push({
        type: "image_url",
        image_url: { url: `data:image/jpeg;base64,${fp.samplePhotoB64}`, detail: "low" },
      });
      imageContent.push({ type: "text", text: `Person named: ${fp.name}` });
    }
  }

  imageContent.push({
    type: "text",
    text: buildSystemPrompt(photos.length, maxSelect, vibe, faceProfiles, favoriteIndices, contentMix, persona),
  });

  const response = await client.chat.completions.create(
    {
      model: OPENAI_VISION_MODEL,
      max_tokens: 2048,
      // response_format forces JSON output even when the model would otherwise
      // return a prose apology. Requires the word "JSON" to appear in the prompt
      // (it does — "Respond with ONLY valid JSON").
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: imageContent }],
    },
    { timeout: 90000 }, // 90s — GPT-4o vision with 30 images can be slow
  );

  const finishReason = response.choices[0]?.finish_reason;
  if (finishReason === "content_filter") {
    throw new Error("GPT-4o content filter triggered — try Claude instead, or use a different set of photos");
  }

  const text = response.choices[0]?.message?.content ?? "{}";
  return parseAiResponse(text);
}

// ── Role-assignment prompt (used when selection is already fixed) ────────────

export function buildRolePrompt(
  count: number,
  vibe?: string,
  storyHint?: string,
  persona?: string,
): string {
  const personaClause = buildPersonaClause(persona, count);
  const vibeClause = vibe
    ? `\n\nStory this carousel tells: "${vibe}". Let this shape the roles and ordering.`
    : "";
  const hintClause = storyHint
    ? `\n\nPrevious story arc: "${storyHint}". Update it if the new set tells a different story.`
    : "";

  return (
    `You are a photo editor assigning story roles to ${count} photos for an Instagram carousel.\n\n` +
    `These are the FINAL selected photos — do not exclude any. Assign every photo exactly one role.\n` +
    personaClause + vibeClause + hintClause +

    `\n\n━━ STORY BEATS ━━\n` +
    `• HOOK (exactly 1): First slide — the scroll-stopper. Most visually arresting.\n` +
    `• WORLD (1–2): Establishes place and atmosphere.\n` +
    `• LIFE (2–4): Human moments, candid, emotional. The "I wish I was there" shots.\n` +
    `• DETAIL (1–2): Close-ups, textures, intimate observations.\n` +
    `• CLOSER (exactly 1): Last slide — emotional punctuation.\n\n` +
    `If there are too few photos to cover every beat, do your best with what exists and note what's missing.\n\n` +

    `━━ ORDERING ━━\n` +
    `Suggest the ideal swiping order that creates the best emotional arc. ` +
    `HOOK always first. CLOSER always last. Build toward something in between.\n\n` +

    `Respond with ONLY valid JSON — no markdown, no explanation:\n` +
    `{\n` +
    `  "story": "One sentence describing what this carousel tells",\n` +
    `  "selected": [\n` +
    `    {"index": 0, "role": "hook",   "reason": "most arresting composition"},\n` +
    `    {"index": 2, "role": "world",  "reason": "wide shot establishes place"}\n` +
    `  ],\n` +
    `  "ordering": [0, 2, 1, 3],\n` +
    `  "missing": "No close-up detail shot — set lacks an intimate moment" or null\n` +
    `}`
  );
}

interface AssignRolesBody {
  photos_b64: string[];
  photo_names?: string[];
  vibe?: string;
  story?: string;
  persona?: string;
  provider?: "claude" | "openai";
}

async function assignRolesWithClaude(
  photos: string[],
  names: string[],
  vibe?: string,
  storyHint?: string,
  persona?: string,
): Promise<{ photo_roles: PhotoRole[]; ordering: number[]; story: string; missing: string | null }> {
  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

  const content: Anthropic.MessageParam["content"] = [];
  for (let i = 0; i < photos.length; i++) {
    content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: photos[i] } });
    content.push({ type: "text", text: `Photo ${i}: ${names[i] ?? `photo_${i}`}` });
  }
  content.push({ type: "text", text: buildRolePrompt(photos.length, vibe, storyHint, persona) });

  const response = await client.messages.create({
    model: CLAUDE_VISION_MODEL,
    max_tokens: 1024,
    messages: [{ role: "user", content }],
  });

  const raw = (response.content[0] as Anthropic.TextBlock).text;
  return parseRoleResponse(raw, photos.length);
}

async function assignRolesWithOpenAI(
  photos: string[],
  names: string[],
  vibe?: string,
  storyHint?: string,
  persona?: string,
): Promise<{ photo_roles: PhotoRole[]; ordering: number[]; story: string; missing: string | null }> {
  const client = new OpenAI({ apiKey: OPENAI_API_KEY });

  const content: OpenAI.Chat.ChatCompletionContentPart[] = [];
  for (let i = 0; i < photos.length; i++) {
    content.push({ type: "image_url", image_url: { url: `data:image/jpeg;base64,${photos[i]}`, detail: "low" } });
    content.push({ type: "text", text: `Photo ${i}: ${names[i] ?? `photo_${i}`}` });
  }
  content.push({ type: "text", text: buildRolePrompt(photos.length, vibe, storyHint, persona) });

  const response = await client.chat.completions.create({
    model: OPENAI_VISION_MODEL,
    max_tokens: 1024,
    response_format: { type: "json_object" },
    messages: [{ role: "user", content }],
  });

  if (response.choices[0]?.finish_reason === "content_filter") {
    throw new Error("GPT-4o content filter triggered on role assignment — try Claude instead");
  }

  const raw = response.choices[0]?.message?.content ?? "{}";
  return parseRoleResponse(raw, photos.length);
}

function parseRoleResponse(
  text: string,
  count: number,
): { photo_roles: PhotoRole[]; ordering: number[]; story: string; missing: string | null } {
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();

  if (!cleaned.startsWith("{") && !cleaned.startsWith("[")) {
    throw new Error(`AI returned prose instead of JSON: "${cleaned.slice(0, 120)}"`);
  }

  const parsed = JSON.parse(cleaned);
  const selected: Array<{ index: number; role: string; reason: string }> = parsed.selected ?? [];
  const photoRoles: PhotoRole[] = selected.map((s) => ({
    index: s.index,
    role: s.role as PhotoRole["role"],
    reason: s.reason,
  }));
  const fallback = Array.from({ length: count }, (_, i) => i);
  return {
    photo_roles: photoRoles,
    ordering: parsed.ordering ?? fallback,
    story: parsed.story ?? "",
    missing: parsed.missing ?? null,
  };
}

// ── Route ────────────────────────────────────────────────────────────────────

export async function curateRoutes(app: FastifyInstance) {
  app.post<{ Body: CurateBody }>("/api/curate_device_photos", async (request, reply) => {
    const {
      photos_b64,
      photo_names,
      favorite_indices,
      vibe,
      max_select = 10,
      provider = "claude",
      face_profiles,
      content_mix,
      persona,
    } = request.body;

    // Validate API key
    if (provider === "claude" && !ANTHROPIC_API_KEY) {
      return reply.status(400).send({ success: false, error: "ANTHROPIC_API_KEY not set on the backend." });
    }
    if (provider === "openai" && !OPENAI_API_KEY) {
      return reply.status(400).send({ success: false, error: "OPENAI_API_KEY not set on the backend." });
    }
    if (!photos_b64 || photos_b64.length === 0) {
      return reply.status(400).send({ success: false, error: "No photos provided." });
    }

    try {
      // GPT-4o has a much lower TPM limit than Claude — cap at 25 photos and
      // resize to 512px so each image uses ~85 tokens (low detail).
      // Claude gets the full 50 at 1024px.
      const isOpenAI = provider === "openai";
      const maxPhotos = isOpenAI ? 35 : 50;
      const maxPx     = isOpenAI ? 512 : 1024;
      const inputPhotos = photos_b64.slice(0, maxPhotos);
      const inputNames  = (photo_names ?? []).slice(0, maxPhotos);
      const inputFavs   = favorite_indices?.filter((i) => i < maxPhotos);

      request.log.info(`[curate] received ${photos_b64.length} photos → using ${inputPhotos.length}, provider=${provider}, maxPx=${maxPx}, vibe="${vibe ?? ""}"`);

      const t0 = Date.now();
      request.log.info(`[curate] resizing ${inputPhotos.length} photos...`);
      const resized = await Promise.all(inputPhotos.map((b64) => resizeToBase64(b64, maxPx)));
      request.log.info(`[curate] resize done in ${Date.now() - t0}ms — total payload ~${Math.round(resized.reduce((s, b) => s + b.length, 0) / 1024)}KB`);

      const t1 = Date.now();
      request.log.info(`[curate] calling ${provider} API (model: ${provider === "claude" ? CLAUDE_VISION_MODEL : OPENAI_VISION_MODEL})...`);

      if (inputFavs && inputFavs.length > 0) {
        request.log.info(`[curate] ${inputFavs.length} favorited photos among candidates: [${inputFavs.join(", ")}]`);
      }
      request.log.info(`[curate] content_mix="${content_mix ?? "balanced"}", persona="${persona ?? "none"}"`);

      let result: Omit<CurateResult, "success">;
      if (provider === "claude") {
        result = await curateWithClaude(resized, inputNames, vibe, max_select, face_profiles, inputFavs, content_mix, persona);
      } else {
        result = await curateWithOpenAI(resized, inputNames, vibe, max_select, face_profiles, inputFavs, content_mix, persona);
      }

      request.log.info(`[curate] ${provider} responded in ${Date.now() - t1}ms — selected ${result.selected_indices?.length ?? 0} photos`);
      return { success: true, ...result };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      request.log.error({ err }, "[curate] failed");
      return reply.status(500).send({ success: false, error: message });
    }
  });

  // ── /api/assign_roles — lightweight role re-assignment for review screen ──
  // Called when the user adds/removes photos in the review screen.
  // Unlike /api/curate_device_photos, all submitted photos are treated as
  // the FINAL selection — the AI only assigns beats and suggests ordering.
  app.post<{ Body: AssignRolesBody }>("/api/assign_roles", async (request, reply) => {
    const {
      photos_b64,
      photo_names,
      vibe,
      story,
      persona,
      provider = "claude",
    } = request.body;

    if (provider === "claude" && !ANTHROPIC_API_KEY) {
      return reply.status(400).send({ success: false, error: "ANTHROPIC_API_KEY not set." });
    }
    if (provider === "openai" && !OPENAI_API_KEY) {
      return reply.status(400).send({ success: false, error: "OPENAI_API_KEY not set." });
    }
    if (!photos_b64 || photos_b64.length === 0) {
      return reply.status(400).send({ success: false, error: "No photos provided." });
    }

    try {
      // Use 512px — just role assignment, not quality evaluation
      const resized = await Promise.all(photos_b64.map((b64) => resizeToBase64(b64, 512)));
      const names = (photo_names ?? []);

      request.log.info(`[assign_roles] ${resized.length} photos, provider=${provider}, persona=${persona ?? "none"}`);
      const t = Date.now();

      const result = provider === "claude"
        ? await assignRolesWithClaude(resized, names, vibe, story, persona)
        : await assignRolesWithOpenAI(resized, names, vibe, story, persona);

      request.log.info(`[assign_roles] done in ${Date.now() - t}ms`);
      return { success: true, ...result };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      request.log.error({ err }, "[assign_roles] failed");
      return reply.status(500).send({ success: false, error: message });
    }
  });
}
