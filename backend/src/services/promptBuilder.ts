/**
 * Prompt builder — assembles the system prompt and persona clauses
 * for the AI curation and role-assignment calls.
 */
import type { FaceProfile } from '../types/curateTypes';

// ── Persona clauses ────────────────────────────────────────────────────────────

export function buildPersonaClause(persona: string | undefined, maxSelect: number): string {
  if (!persona) return '';
  switch (persona) {
    case 'aesthete':
      return (
        `\n\n━━ POSTING PERSONA: THE AESTHETE ━━\n` +
        `This user has a consistent grid built around colour palette. Saturation, tone, and colour temperature ` +
        `are the primary selection criteria — not sharpness, not emotion. ` +
        `A photo that breaks the palette is disqualified even if it is technically perfect or emotionally strong. ` +
        `Every slide must feel like it belongs to the same visual universe — same warmth, same saturation register, same mood. ` +
        `Complexity and clutter are enemies; clean subjects within a coherent colour story win. ` +
        `Faces are acceptable only when the portrait fits the palette without disturbing it.`
      );
    case 'social':
      return (
        `\n\n━━ POSTING PERSONA: THE SOCIAL CONNECTOR ━━\n` +
        `Every slide needs to have people in it. Landscapes without people feel empty to this user. ` +
        `"Tag me in that one" is the success metric — faces must be visible and expressions genuine. ` +
        `Laughing, candid, unguarded moments beat posed shots. Happy expressions outweigh neutral ones. ` +
        `A blurry portrait of laughing friends beats a technically perfect empty landscape. ` +
        `Select landscape/scene-only shots ONLY as brief establishing context between people shots.`
      );
    case 'logger':
      return (
        `\n\n━━ POSTING PERSONA: THE EXPERIENCE LOGGER ━━\n` +
        `"I was here, I did this." This user has a documentary instinct — they post proof of life, not a portfolio. ` +
        `Visual complexity is a virtue: crowded scenes, overlapping figures, messy tables, motion blur are evidence that something real happened. ` +
        `Do NOT favour clean, composed, or "content-y" shots over chaotic, lived-in ones. ` +
        `A perfectly lit photo of an empty beach is worse than a shaky photo of everyone piling into the boat. ` +
        `Photos the user hearted (♥) are especially valuable — they captured them in the moment for a reason. ` +
        `Prefer chronological ordering that reads like a diary entry, not a highlight reel.`
      );
    case 'storyteller':
      return (
        `\n\n━━ POSTING PERSONA: THE STORYTELLER ━━\n` +
        `This user thinks in sequences. They will swap a better photo for a worse one because it ` +
        `transitions better to the next slide. The emotional arc across all slides IS the product. ` +
        `Actively prioritise tonal variety — the set must move between bright and dark, near and far, busy and sparse. ` +
        `A carousel where every slide has the same ambient brightness or subject distance is a failed sequence. ` +
        `No two adjacent slides should have the same composition, focal length, or subject type. ` +
        `The ordering you suggest is as important as the photos you select. ` +
        `A set of ${maxSelect} photos that tells a complete arc beats ${maxSelect} individually great photos with no flow.`
      );
    case 'mood':
      return (
        `\n\n━━ POSTING PERSONA: THE MOOD POSTER ━━\n` +
        `This user only posts when the light is right. Golden hour, blue hour, soft window light, dramatic shadows — ` +
        `the quality of light and the emotional atmosphere of the photo IS the post. ` +
        `A slightly soft photo with magic light beats a technically sharp photo under flat or harsh light. ` +
        `Saturation and atmosphere take absolute precedence over sharpness, composition, or even content. ` +
        `Reject any photo that feels visually flat, grey, or uninspired even if it is technically clean. ` +
        `Faces are acceptable only when they are bathed in beautiful light and add to the atmosphere.`
      );
    default:
      return '';
  }
}

// ── System prompt for initial curation ────────────────────────────────────────

export function buildSystemPrompt(
  count: number,
  maxSelect: number,
  vibe: string | undefined,
  faceProfiles: FaceProfile[] | undefined,
  favoriteIndices: number[] | undefined,
  contentMix?: string,
  persona?: string,
  hasUserFace?: boolean,
): string {
  const personaClause = buildPersonaClause(persona, maxSelect);

  const vibeClause = vibe
    ? persona
      ? `\n\nThe story the user wants to tell this time: "${vibe}". Let this shape the narrative arc and caption copy.`
      : `\n\nThe user's requested vibe/theme is: "${vibe}". This is the most important selection criterion — actively prefer photos that match this mood, subject matter, lighting style, or aesthetic. Reject otherwise-good photos that clearly clash with the vibe.`
    : '';

  // User face identity clause — stronger than a generic face profile preference.
  // The reference photo was sent as the FIRST image in the message, labeled "REFERENCE PHOTO".
  const userFaceClause = hasUserFace
    ? `\n\n━━ USER FACE FILTER ━━\n` +
      `The FIRST image you received (labeled "REFERENCE PHOTO — THE USER") is a reference photo of the person who is posting this carousel. ` +
      `STRICT RULE: Any candidate photo that contains visible human faces MUST include this person. ` +
      `If a photo shows other people's faces but the user is clearly absent, DO NOT select it. ` +
      `Photos with no faces at all (landscapes, food, objects) are always eligible regardless of this rule.`
    : '';

  let faceClause = '';
  if (faceProfiles && faceProfiles.length > 0) {
    const names = faceProfiles.map((f) => `"${f.name}"`).join(', ');
    faceClause = `\n\nThe user has provided face profiles for: ${names}. Prefer shots that prominently feature these individuals.`;
  }

  let favClause = '';
  if (favoriteIndices && favoriteIndices.length > 0) {
    favClause =
      `\n\nThe user has personally heart-favorited these photos: indices [${favoriteIndices.join(', ')}]. ` +
      `Treat them as MUST-INCLUDE unless they are near-duplicates of each other. ` +
      `If there are more favorites than ${maxSelect} slots, keep the best and fill remaining with top non-favorites.`;
  }

  // Content mix is only shown when no persona is set — persona already implies content preference.
  const mixClause = persona ? '' : contentMix === 'people'
    ? `\n\nCONTENT MIX: People-focused. Strongly prefer faces, portraits, candid moments. Landscape/scene-only shots only when exceptional.`
    : contentMix === 'places'
    ? `\n\nCONTENT MIX: Places-focused. Prefer landscapes, architecture, food, scenes. People shots are fine but not prioritised.`
    : `\n\nCONTENT MIX: Balanced — roughly half people, half places/scenes.`;

  return (
    `You are crafting an Instagram carousel post — not just picking good photos, but editing a short film.\n\n` +
    `You have ${count} candidate photos to work with.` +
    personaClause + userFaceClause + vibeClause + faceClause + favClause + mixClause +

    `\n\n━━ YOUR TASK ━━\n` +
    `Build a carousel of ${maxSelect} photos that tells a coherent story. ` +
    `A viewer will swipe through this in about 8 seconds. They should feel something.\n\n` +

    `━━ STORY BEATS ━━\n` +
    `• HOOK (exactly 1): First slide — scroll-stopper. Visually arresting, sets the entire tone.\n` +
    `• WORLD (1–2): Establishes where this is and what it feels like.\n` +
    `• LIFE (2–4): Human element. Candid moments, experiences being lived. The "I wish I was there" slides.\n` +
    `• DETAIL (1–2): Close-ups that reward the person who keeps swiping.\n` +
    `• CLOSER (exactly 1): Emotional punctuation of the last slide.\n\n` +

    `━━ PHOTO METADATA ━━\n` +
    `Each photo is followed by objective, on-device-measured attributes (after an em dash, separated by "·"). Use them — don't just guess from pixels:\n` +
    `• shot type (closeup / medium / wide) — alternate scales; never 3+ of the same in a row; include ≥1 wide establishing shot and ≥1 closeup detail\n` +
    `• people count + how many are smiling — for LIFE beats prefer genuine group joy; more smiling faces = stronger candid energy\n` +
    `• "you're in it" — the photo contains the poster themselves; strong for LIFE and CLOSER\n` +
    `• quality N/100 — composite sharpness/exposure/composition; prefer higher quality unless a lower one is narratively essential\n` +
    `• capture time — order the carousel to read like the day actually unfolded; avoid temporal whiplash\n` +
    `• near-dup X — photos sharing a "near-dup" label are visually near-identical; pick AT MOST ONE per label\n` +
    `• ♥ favorited — the user hearted this; treat as near must-include unless a duplicate\n` +
    `If the pool has no wide shots at all, note it in "missing".\n\n` +

    `━━ ORDERING ━━\n` +
    `Suggest the ideal viewing order. Hook always first. Closer always last. Build toward something.\n\n` +

    `━━ SELECTION PRINCIPLES ━━\n` +
    `1. Narrative purpose (most important)\n` +
    (favClause ? `2. Favorited photos (♥) are must-include unless near-duplicate\n` : '') +
    (vibe ? `${favClause ? '3' : '2'}. Vibe match — embody "${vibe}"\n` : '') +
    `${[favClause, vibe].filter(Boolean).length + 2}. Technical quality — sharpness, exposure, composition\n` +
    `${[favClause, vibe].filter(Boolean).length + 3}. No near-duplicates in the same story beat\n\n` +

    `━━ MISSING BEATS ━━\n` +
    `If the candidate pool cannot fill a beat, note it in "missing". Otherwise set "missing" to null.\n\n` +

    `━━ CAPTIONS ━━\n` +
    `Write 4 caption variants that reflect the actual story — not generic copy. Reference real moments.\n\n` +

    `Respond with ONLY valid JSON — no markdown, no explanation:\n` +
    `{\n` +
    `  "story": "One sentence: what does this carousel tell?",\n` +
    `  "selected": [\n` +
    `    {"index": 4, "role": "hook",   "reason": "Wide golden-hour shot, immediately transporting"},\n` +
    `    {"index": 7, "role": "life",   "reason": "Candid laugh at the café, genuinely joyful"}\n` +
    `  ],\n` +
    `  "ordering": [4, 12, 7, 23, 1],\n` +
    `  "missing": "No close-up detail shot available" or null,\n` +
    `  "captions": [\n` +
    `    {"mood": "wanderlust", "text": "caption referencing the actual story", "hashtags": ["relevant"]},\n` +
    `    {"mood": "minimal",    "text": "shorter, quieter version", "hashtags": []},\n` +
    `    {"mood": "story",      "text": "narrative, first-person, specific details", "hashtags": []},\n` +
    `    {"mood": "playful",    "text": "lighter, funnier take", "hashtags": []}\n` +
    `  ]\n` +
    `}`
  );
}

// ── Role-assignment prompt (review screen re-labeling) ────────────────────────

export function buildRolePrompt(
  count: number,
  vibe?: string,
  storyHint?: string,
  persona?: string,
): string {
  const personaClause = buildPersonaClause(persona, count);
  const vibeClause = vibe ? `\n\nStory: "${vibe}". Shape roles and ordering accordingly.` : '';
  const hintClause = storyHint ? `\n\nPrevious arc: "${storyHint}". Update if the new set tells a different story.` : '';

  return (
    `You are a photo editor assigning story roles to ${count} photos for an Instagram carousel.\n\n` +
    `These are the FINAL selected photos — do not exclude any. Assign every photo exactly one role.\n` +
    personaClause + vibeClause + hintClause +

    `\n\n━━ STORY BEATS ━━\n` +
    `• HOOK (exactly 1): Most visually arresting — first slide.\n` +
    `• WORLD (1–2): Establishes place and atmosphere.\n` +
    `• LIFE (2–4): Human moments, candid, emotional.\n` +
    `• DETAIL (1–2): Close-ups, textures, intimate observations.\n` +
    `• CLOSER (exactly 1): Last slide — emotional punctuation.\n\n` +
    `If photos are too few for every beat, do your best and note what is missing.\n\n` +

    `━━ ORDERING ━━\n` +
    `Ideal swiping order. HOOK first. CLOSER last. Build toward something.\n\n` +

    `━━ REASONS ━━\n` +
    `For each photo, "reason" must justify WHY it earns its place in the carousel — ` +
    `the moment, emotion, or quality it captures — not merely describe what it shows. ` +
    `Write it like you're telling the user why you kept this one.\n\n` +

    `Respond with ONLY valid JSON:\n` +
    `{\n` +
    `  "story": "One sentence describing what this carousel tells",\n` +
    `  "selected": [\n` +
    `    {"index": 0, "role": "hook",  "reason": "Stops the scroll — the light and the look pull you straight in"},\n` +
    `    {"index": 2, "role": "world", "reason": "Sets the scene so the rest of the day has somewhere to live"}\n` +
    `  ],\n` +
    `  "ordering": [0, 2, 1, 3],\n` +
    `  "missing": "No close-up detail shot" or null\n` +
    `}`
  );
}
