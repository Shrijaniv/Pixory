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
        `This user has a consistent grid. They will reject a perfect moment because the colors clash. ` +
        `Select photos where tones, saturation, and overall mood are coherent across the entire carousel. ` +
        `A sharp photo with clashing colors is WORSE than a softer photo that fits the palette. ` +
        `Every slide must feel like it belongs to the same visual set. ` +
        `Reject visual outliers even if they are emotionally strong. ` +
        `Faces are irrelevant unless the portrait composition is impeccable and fits the palette.`
      );
    case 'social':
      return (
        `\n\n━━ POSTING PERSONA: THE SOCIAL CONNECTOR ━━\n` +
        `Every slide needs to have people in it. Landscapes without people feel empty to this user. ` +
        `"Tag me in that one" is the success metric — faces must be visible and expressions genuine. ` +
        `Prefer group shots, candid laughs, and moments where friends would want to tag themselves. ` +
        `A blurry portrait of laughing friends beats a technically perfect empty landscape. ` +
        `Select landscape/scene-only shots ONLY as establishing context between people shots.`
      );
    case 'logger':
      return (
        `\n\n━━ POSTING PERSONA: THE EXPERIENCE LOGGER ━━\n` +
        `"I was here, I did this." This user has a documentary instinct. ` +
        `Slightly rough edges feel authentic — they would post the blurry photo from the boat because it was a real moment. ` +
        `Do NOT penalise imperfect exposure, motion blur, or unconventional framing if it captures genuine experience. ` +
        `Prefer chronological storytelling. Photos the user hearted (♥) are especially valuable — ` +
        `they captured them in the moment for a reason. ` +
        `A posed, perfectly-lit photo of nothing is worse than a shaky, real one.`
      );
    case 'storyteller':
      return (
        `\n\n━━ POSTING PERSONA: THE STORYTELLER ━━\n` +
        `This user thinks in sequences. They will swap a better photo for a worse one because it ` +
        `transitions better to the next slide. The emotional arc across all slides IS the product. ` +
        `Actively prioritise visual variety — a wide shot must be followed by something different in scale or subject. ` +
        `No two adjacent slides should have the same composition, focal length, or subject type. ` +
        `The ordering you suggest is as important as the photos you select. ` +
        `A set of ${maxSelect} photos that tells a complete arc beats ${maxSelect} individually great photos with no flow.`
      );
    case 'minimalist':
      return (
        `\n\n━━ POSTING PERSONA: THE MINIMALIST ━━\n` +
        `This user would rather post ${maxSelect} perfect photos than ${maxSelect + 5} good ones. Less is always more. ` +
        `Every photo must be exceptional — if it is merely "good", do NOT include it. ` +
        `Prefer clean compositions, uncluttered backgrounds, and impeccable light. ` +
        `Actively resist filling all ${maxSelect} slots — selecting fewer is a sign of editorial discipline, not failure. ` +
        `A carousel of ${maxSelect - 1} extraordinary photos is better than ${maxSelect} with one that's just okay.`
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

    `━━ COMPOSITION DIVERSITY ━━\n` +
    `Photos are tagged with objective sidecar-computed attributes: [CLOSEUP], [MEDIUM], or [WIDE] (shot type) ` +
    `and [SOLO], [DUO], or [GROUP] (number of people). Use these to build visual variety:\n` +
    `• Do NOT select 3 or more [CLOSEUP] or [WIDE] shots in sequence — alternate shot scales\n` +
    `• Aim for: at least 1 [WIDE] establishing shot (ideal for HOOK or WORLD), at least 1 [CLOSEUP] detail\n` +
    `• [GROUP] shots work well for LIFE and WORLD beats; [SOLO] or [CLOSEUP] suit HOOK and CLOSER\n` +
    `• If the pool has no [WIDE] shots at all, note it in "missing"\n\n` +

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

    `Respond with ONLY valid JSON:\n` +
    `{\n` +
    `  "story": "One sentence describing what this carousel tells",\n` +
    `  "selected": [\n` +
    `    {"index": 0, "role": "hook",  "reason": "most arresting composition"},\n` +
    `    {"index": 2, "role": "world", "reason": "wide shot establishes place"}\n` +
    `  ],\n` +
    `  "ordering": [0, 2, 1, 3],\n` +
    `  "missing": "No close-up detail shot" or null\n` +
    `}`
  );
}
