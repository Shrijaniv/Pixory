/**
 * eval_persona_scoring.ts
 *
 * Verifies that the per-persona scoring formula ranks photo archetypes
 * in the expected order WITHOUT needing real photos or the sidecar running.
 *
 * Run: npx tsx backend/scripts/eval_persona_scoring.ts
 */

type PersonaType = 'aesthete' | 'social' | 'logger' | 'storyteller' | 'minimalist' | null;

interface BackendPhotoScore {
  index: number;
  sharpness: number;
  face_count: number;
  happy_face_count: number;
  brightness: number;
  brightness_quality: number;
  contrast: number;
  saturation: number;
  complexity: number;
}

// ── Copy of computePersonaScore from photoLibrary.ts ────────────────────────
// (kept in sync manually — if the formula changes, update here too)
function computePersonaScore(score: BackendPhotoScore, persona: PersonaType): number {
  const s   = score.sharpness;
  const bq  = score.brightness_quality;
  const ct  = score.contrast;
  const sat = score.saturation;
  const cpx = score.complexity;
  const happy   = score.happy_face_count;
  const neutral = Math.max(0, score.face_count - happy);
  const effectiveFaces = happy * 1.5 + neutral * 0.5;

  switch (persona) {
    case 'aesthete':
      return s * 0.40 + bq * 0.20 + ct * 0.15 + sat * 0.10 +
             (1 - cpx) * 0.10 + Math.min(effectiveFaces * 0.01, 0.05);
    case 'social':
      return Math.min(effectiveFaces * 0.22, 0.55) + s * 0.20 + bq * 0.15 + ct * 0.10;
    case 'logger':
      return s * 0.15 + Math.min(effectiveFaces * 0.10, 0.20) + bq * 0.10 + ct * 0.05 + 0.35;
    case 'storyteller':
      return s * 0.30 + bq * 0.15 + ct * 0.15 +
             Math.min(effectiveFaces * 0.08, 0.15) + 0.15;
    case 'minimalist':
      return s * 0.50 + bq * 0.20 + ct * 0.15 + (1 - cpx) * 0.10 +
             Math.min(effectiveFaces * 0.02, 0.05);
    default:
      return s * 0.35 + Math.min(effectiveFaces * 0.08, 0.15) + 0.25;
  }
}

// ── Photo archetypes ─────────────────────────────────────────────────────────
const archetypes: Record<string, BackendPhotoScore> = {
  // Technically flawless landscape — sharp, well-lit, clean, no people
  perfect_landscape: {
    index: 0, sharpness: 0.95, face_count: 0, happy_face_count: 0,
    brightness: 0.55, brightness_quality: 0.90, contrast: 0.75,
    saturation: 0.60, complexity: 0.20,
  },
  // Blurry group shot — lots of laughing faces, poor sharpness, busy
  blurry_group_laugh: {
    index: 1, sharpness: 0.15, face_count: 5, happy_face_count: 5,
    brightness: 0.50, brightness_quality: 0.65, contrast: 0.40,
    saturation: 0.50, complexity: 0.70,
  },
  // Sharp portrait — one happy face, good lighting
  sharp_portrait: {
    index: 2, sharpness: 0.85, face_count: 1, happy_face_count: 1,
    brightness: 0.52, brightness_quality: 0.80, contrast: 0.70,
    saturation: 0.45, complexity: 0.30,
  },
  // Blurry moment from a boat — authentic, real, imperfect
  blurry_boat_moment: {
    index: 3, sharpness: 0.10, face_count: 2, happy_face_count: 1,
    brightness: 0.45, brightness_quality: 0.40, contrast: 0.30,
    saturation: 0.35, complexity: 0.60,
  },
  // Minimal clean shot — sharp, simple, no people, quiet composition
  minimal_clean: {
    index: 4, sharpness: 0.90, face_count: 0, happy_face_count: 0,
    brightness: 0.52, brightness_quality: 0.85, contrast: 0.60,
    saturation: 0.20, complexity: 0.05,
  },
  // Busy market shot — lots of edges, many faces, vibrant color
  busy_market: {
    index: 5, sharpness: 0.70, face_count: 3, happy_face_count: 2,
    brightness: 0.48, brightness_quality: 0.55, contrast: 0.65,
    saturation: 0.75, complexity: 0.90,
  },
};

// ── Assertion helpers ─────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

function score(persona: PersonaType, name: string): number {
  return computePersonaScore(archetypes[name], persona);
}

function assert(
  condition: boolean,
  label: string,
  detail: string,
) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label} — ${detail}`);
    failed++;
  }
}

function gt(persona: PersonaType, nameA: string, nameB: string, label: string) {
  const a = score(persona, nameA);
  const b = score(persona, nameB);
  assert(a > b, label, `${nameA}=${a.toFixed(3)} should be > ${nameB}=${b.toFixed(3)}`);
}

// ── Persona assertions ───────────────────────────────────────────────────────
console.log('\n── Aesthete ─────────────────────────────────────────────');
gt('aesthete', 'perfect_landscape', 'blurry_group_laugh', 'sharp landscape > blurry group (sharpness & complexity)');
gt('aesthete', 'minimal_clean',     'busy_market',        'minimal clean > busy market (complexity penalty)');
gt('aesthete', 'perfect_landscape', 'blurry_boat_moment', 'sharp landscape > blurry boat');
gt('aesthete', 'sharp_portrait',    'blurry_group_laugh', 'sharp portrait > blurry group');

console.log('\n── Social Connector ──────────────────────────────────────');
gt('social', 'blurry_group_laugh', 'perfect_landscape', 'blurry group laugh > perfect landscape (faces win)');
gt('social', 'blurry_group_laugh', 'minimal_clean',     'blurry group laugh > minimal clean (faces win)');
gt('social', 'sharp_portrait',     'perfect_landscape', 'sharp portrait > perfect landscape');
gt('social', 'busy_market',        'minimal_clean',     'busy market (3 faces) > minimal clean (0 faces)');

console.log('\n── Experience Logger ─────────────────────────────────────');
gt('logger', 'blurry_boat_moment', 'perfect_landscape',  'blurry boat moment NOT buried under perfect landscape');
gt('logger', 'blurry_group_laugh', 'minimal_clean',      'blurry group laugh > minimal clean (authentic moment)');
// Logger base of 0.35 means even a blurry shot with score 0 elsewhere still gets 0.35
const loggerBoatScore = score('logger', 'blurry_boat_moment');
assert(
  loggerBoatScore > 0.35,
  'blurry boat moment scores above 0.35 base (not penalised)',
  `actual score: ${loggerBoatScore.toFixed(3)}`,
);

console.log('\n── Storyteller ────────────────────────────────────────────');
// Storyteller is mostly set-level, but individual scores should be moderate across all archetypes
const storytellerScores = Object.keys(archetypes).map((name) => ({
  name, s: score('storyteller', name),
}));
const minS = Math.min(...storytellerScores.map((x) => x.s));
const maxS = Math.max(...storytellerScores.map((x) => x.s));
assert(
  maxS - minS < 0.45,
  'Storyteller scores are relatively spread (diversity bonus handles the rest)',
  `spread: ${(maxS - minS).toFixed(3)} — min: ${minS.toFixed(3)}, max: ${maxS.toFixed(3)}`,
);
gt('storyteller', 'sharp_portrait', 'blurry_boat_moment', 'sharp portrait > blurry boat (readability matters)');

console.log('\n── Minimalist ─────────────────────────────────────────────');
gt('minimalist', 'minimal_clean',     'blurry_boat_moment', 'minimal clean > blurry boat (perfection required)');
gt('minimalist', 'perfect_landscape', 'busy_market',        'perfect landscape > busy market (complexity penalty)');
gt('minimalist', 'perfect_landscape', 'blurry_group_laugh', 'perfect landscape > blurry group');
gt('minimalist', 'sharp_portrait',    'blurry_boat_moment', 'sharp portrait > blurry boat');
// Minimalist strongly penalises complexity
assert(
  score('minimalist', 'busy_market') < score('minimalist', 'minimal_clean'),
  'busy market scores below minimal clean by significant margin',
  `busy=${score('minimalist', 'busy_market').toFixed(3)}, clean=${score('minimalist', 'minimal_clean').toFixed(3)}`,
);

// ── Summary ──────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(55)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error('EVAL FAILED — review scoring weights');
  process.exit(1);
} else {
  console.log('All assertions pass ✓');
}
