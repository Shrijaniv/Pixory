/**
 * eval_persona_scoring.ts
 *
 * Verifies that the per-persona scoring formula ranks photo archetypes
 * in the expected order WITHOUT needing real photos or the sidecar running.
 *
 * Run: npx tsx backend/scripts/eval_persona_scoring.ts
 */

type PersonaType = 'aesthete' | 'social' | 'logger' | 'storyteller' | 'mood' | null;

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

// ── Copy of computePersonaScore from scoring.ts ─────────────────────────────
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
      return s * 0.35 + sat * 0.25 + bq * 0.15 + ct * 0.10 +
             (1 - cpx) * 0.15 + Math.min(effectiveFaces * 0.005, 0.02);
    case 'social':
      return Math.min(happy * 0.30, 0.45) + Math.min(neutral * 0.10, 0.15) +
             s * 0.20 + bq * 0.10 + ct * 0.05 + sat * 0.05;
    case 'logger':
      return cpx * 0.25 + Math.min(effectiveFaces * 0.08, 0.20) +
             bq * 0.20 + s * 0.15 + ct * 0.10 + sat * 0.10;
    case 'storyteller':
      return bq * 0.35 + s * 0.25 + ct * 0.20 +
             Math.min(effectiveFaces * 0.05, 0.10) + sat * 0.10;
    case 'mood':
      return sat * 0.45 + bq * 0.35 + ct * 0.10 + s * 0.10 +
             Math.min(effectiveFaces * 0.005, 0.02);
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
gt('logger', 'blurry_group_laugh', 'minimal_clean', 'blurry group laugh > minimal clean (complexity + faces)');
gt('logger', 'busy_market',        'minimal_clean', 'busy market > minimal clean (complexity valued, not penalised)');
// Logger's real semantic: the sharpness GAP is much narrower than aesthete's.
// blurry_boat vs perfect_landscape: logger should close the gap significantly.
const loggerGap   = score('logger',   'perfect_landscape') - score('logger',   'blurry_boat_moment');
const aestheteGap = score('aesthete', 'perfect_landscape') - score('aesthete', 'blurry_boat_moment');
assert(
  loggerGap < aestheteGap * 0.25,
  'Logger penalises blurry_boat far less than Aesthete does (gap < 25% of aesthete gap)',
  `loggerGap=${loggerGap.toFixed(3)}, aestheteGap=${aestheteGap.toFixed(3)}`,
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

console.log('\n── Mood Poster ────────────────────────────────────────────');
gt('mood', 'perfect_landscape', 'minimal_clean',     'perfect landscape (sat=0.60) > minimal clean (sat=0.20)');
gt('mood', 'busy_market',       'minimal_clean',     'busy market (sat=0.75) > minimal clean (sat=0.20)');
gt('mood', 'perfect_landscape', 'blurry_boat_moment','high-sat landscape > low-sat blurry boat');
// Mood cares about saturation above all — a flat low-sat photo loses even if sharp
assert(
  score('mood', 'minimal_clean') < score('mood', 'perfect_landscape'),
  'flat minimal_clean loses to atmospheric perfect_landscape despite being sharper',
  `minimal_clean=${score('mood', 'minimal_clean').toFixed(3)}, perfect_landscape=${score('mood', 'perfect_landscape').toFixed(3)}`,
);

// ── Divergence checks — personas must produce distinct rankings ───────────────
console.log('\n── Divergence ──────────────────────────────────────────────');

const personas: PersonaType[] = ['aesthete', 'social', 'logger', 'storyteller', 'mood'];
const photoNames = Object.keys(archetypes);

function rankUnder(persona: PersonaType): string {
  return [...photoNames]
    .map((name) => ({ name, s: score(persona, name) }))
    .sort((a, b) => b.s - a.s)
    .map((x) => x.name)
    .join(' > ');
}

const top1s = personas.map((p) => rankUnder(p).split(' > ')[0]);
const uniqueTop1s = new Set(top1s);
// With only 6 archetypes, sharing a #1 is expected — the meaningful check is top-3 divergence below.
// We require at least 2 distinct #1s to catch total formula collapse.
assert(
  uniqueTop1s.size >= 2,
  `At least 2 distinct #1 photos across 5 personas (got ${uniqueTop1s.size}: ${[...uniqueTop1s].join(', ')})`,
  `Top picks: ${personas.map((p, i) => `${p}→${top1s[i]}`).join(', ')}`,
);

const top3s = personas.map((p) => rankUnder(p).split(' > ').slice(0, 3).join(','));
const uniqueTop3s = new Set(top3s);
assert(
  uniqueTop3s.size === personas.length,
  'All 5 personas produce a different top-3 ranking',
  `Duplicates found:\n${personas.map((p, i) => `  ${p}: ${top3s[i]}`).join('\n')}`,
);

assert(
  score('logger', 'busy_market') > score('aesthete', 'busy_market'),
  'Logger scores busy_market higher than Aesthete (complexity valued vs penalised)',
  `logger=${score('logger', 'busy_market').toFixed(3)}, aesthete=${score('aesthete', 'busy_market').toFixed(3)}`,
);

assert(
  score('social', 'blurry_group_laugh') > score('mood', 'blurry_group_laugh'),
  'Social scores blurry_group_laugh higher than Mood (faces vs atmosphere)',
  `social=${score('social', 'blurry_group_laugh').toFixed(3)}, mood=${score('mood', 'blurry_group_laugh').toFixed(3)}`,
);

console.log('\n── Full rankings per persona ───────────────────────────────');
for (const p of personas) {
  console.log(`  ${String(p).padEnd(12)} ${rankUnder(p)}`);
}

// ── Summary ──────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(55)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error('EVAL FAILED — review scoring weights');
  process.exit(1);
} else {
  console.log('All assertions pass ✓');
}
