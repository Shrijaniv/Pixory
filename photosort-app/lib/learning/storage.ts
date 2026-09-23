/**
 * Self-learning storage — persists per-persona preference signals across sessions.
 *
 * Learning history lives in DocumentDirectory/pixory_learning_v3.json. It is
 * local to the device and never synced or committed.
 *
 * ## What changed in v3, and why
 *
 * v2 recorded three different user actions into two buckets, and the biggest
 * one carried no information (audit L1). On reaching the caption screen the
 * review hook looped every photo still in the carousel that the AI had
 * originally selected and recorded it as `promoted` — so a user who changed
 * nothing recorded ten promotions. The promoted average therefore converged on
 * *the AI's own taste*, and the activation gate unlocked after a single
 * untouched session. The system learned to reinforce what it already did.
 *
 * v3 separates the three actions and weights them by how much they actually
 * reveal:
 *
 *   kept      the user left an AI pick alone          weight 0.3
 *   promoted  the user actively added a photo         weight 1.0
 *   rejected  the user actively removed an AI pick    weight 1.0
 *
 * Leaving a pick alone is mild approval; it might equally be indifference.
 * Reaching into the tray to add something, or deliberately removing something,
 * is a real preference. The activation gate now counts only those decisive
 * actions, so a run the user never touched cannot unlock the bias.
 *
 * v2 data is not migrated — it is polluted by the bug above and by fabricated
 * feature values (audit L4). A clean start is worth more than a tainted history.
 */

import * as FileSystem from 'expo-file-system/legacy';
import type { LocalPhoto } from '../store/state';
import type { PersonaType } from '../store/state';

const LEARNING_FILE = FileSystem.documentDirectory + 'pixory_learning_v3.json';

/** 6-dimensional feature vector matching the sidecar's vision signals. */
export interface LearningFeatures {
  sharpness: number;
  faceCount: number;       // raw count (not divided) — easier to read
  brightnessQuality: number;
  contrast: number;
  saturation: number;
  complexity: number;
}

/** What the user did with a photo in the review screen. */
export type Outcome = 'kept' | 'promoted' | 'rejected';

/**
 * How much each action counts toward the running averages.
 *
 * Kept is deliberately small. It is the most common outcome by far — most
 * photos in a carousel are never touched — so at equal weight it would drown
 * out the handful of deliberate edits that carry the real signal.
 */
export const OUTCOME_WEIGHTS: Record<Outcome, number> = {
  kept: 0.3,
  promoted: 1.0,
  rejected: 1.0,
};

/** Decisive actions (promoted + rejected) needed before the bias activates. */
export const MIN_DECISIVE_EXAMPLES = 5;

/** A weighted running average and the evidence behind it. */
export interface WeightedStats {
  /** Number of photos recorded. */
  count: number;
  /** Sum of their weights — the denominator of the running average. */
  weight: number;
  /** Weighted mean feature vector. */
  avg: LearningFeatures;
}

/** Tracks which face-count bucket the user tends to prefer, by weight. */
export interface GroupSizePreference {
  noFace: number;    // approved photos with 0 faces (weighted, not a count)
  solo: number;      // face_count === 1
  small: number;     // face_count 2–3
  group: number;     // face_count 4+
  totalPromoted: number; // total weight across the four buckets
}

/** Learning history for a single persona. */
export interface PersonaLearning {
  kept: WeightedStats;
  promoted: WeightedStats;
  rejected: WeightedStats;
  groupSize: GroupSizePreference;
}

/** Full learning file — keyed by persona name or "default". */
export type LearningHistory = Record<string, PersonaLearning>;

const ZERO_FEATURES: LearningFeatures = {
  sharpness: 0, faceCount: 0, brightnessQuality: 0,
  contrast: 0, saturation: 0, complexity: 0,
};

const ZERO_GROUP: GroupSizePreference = {
  noFace: 0, solo: 0, small: 0, group: 0, totalPromoted: 0,
};

function emptyStats(): WeightedStats {
  return { count: 0, weight: 0, avg: { ...ZERO_FEATURES } };
}

export function emptyPersonaLearning(): PersonaLearning {
  return {
    kept: emptyStats(),
    promoted: emptyStats(),
    rejected: emptyStats(),
    groupSize: { ...ZERO_GROUP },
  };
}

const FEATURE_KEYS = Object.keys(ZERO_FEATURES) as (keyof LearningFeatures)[];

// ── Derived views ────────────────────────────────────────────────────────────

/**
 * Merge two weighted averages into one.
 *
 * Used to combine `kept` and `promoted` into a single "what this user
 * approves of" vector while preserving their different weights.
 */
export function mergeStats(a: WeightedStats, b: WeightedStats): WeightedStats {
  const weight = a.weight + b.weight;
  if (weight === 0) return emptyStats();
  const avg = { ...ZERO_FEATURES };
  for (const k of FEATURE_KEYS) {
    avg[k] = (a.avg[k] * a.weight + b.avg[k] * b.weight) / weight;
  }
  return { count: a.count + b.count, weight, avg };
}

/** Everything the user signalled approval of: kept plus promoted. */
export function approvedStats(learning: PersonaLearning): WeightedStats {
  return mergeStats(learning.kept, learning.promoted);
}

/**
 * Count of actions that carry real information.
 *
 * Kept is excluded on purpose: a session the user never edited produces only
 * kept events and must not unlock the bias (audit L1).
 */
export function decisiveCount(learning: PersonaLearning): number {
  return learning.promoted.count + learning.rejected.count;
}

/** True once enough deliberate edits exist to bias scoring. */
export function isLearningActive(learning: PersonaLearning | undefined | null): boolean {
  return !!learning && decisiveCount(learning) >= MIN_DECISIVE_EXAMPLES;
}

// ── Persistence ──────────────────────────────────────────────────────────────

/** Narrow unknown JSON to a PersonaLearning, or null if it isn't one. */
function parsePersona(value: unknown): PersonaLearning | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  const stats = (s: unknown): WeightedStats | null => {
    if (!s || typeof s !== 'object') return null;
    const o = s as Record<string, unknown>;
    if (typeof o.count !== 'number' || typeof o.weight !== 'number') return null;
    if (!o.avg || typeof o.avg !== 'object') return null;
    const avg = { ...ZERO_FEATURES };
    for (const k of FEATURE_KEYS) {
      const n = (o.avg as Record<string, unknown>)[k];
      avg[k] = typeof n === 'number' && Number.isFinite(n) ? n : 0;
    }
    return { count: o.count, weight: o.weight, avg };
  };
  const kept = stats(v.kept);
  const promoted = stats(v.promoted);
  const rejected = stats(v.rejected);
  if (!kept || !promoted || !rejected) return null;

  const g = (v.groupSize ?? {}) as Record<string, unknown>;
  const num = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? x : 0);
  return {
    kept,
    promoted,
    rejected,
    groupSize: {
      noFace: num(g.noFace),
      solo: num(g.solo),
      small: num(g.small),
      group: num(g.group),
      totalPromoted: num(g.totalPromoted),
    },
  };
}

export async function loadLearningHistory(): Promise<LearningHistory> {
  try {
    const raw = await FileSystem.readAsStringAsync(LEARNING_FILE);
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object') return {};
    // Drop any persona entry that doesn't match the current shape rather than
    // letting a half-written or older record poison the averages.
    const history: LearningHistory = {};
    for (const [key, value] of Object.entries(parsed)) {
      const persona = parsePersona(value);
      if (persona) history[key] = persona;
    }
    return history;
  } catch {
    return {};
  }
}

export async function saveLearningHistory(history: LearningHistory): Promise<void> {
  try {
    await FileSystem.writeAsStringAsync(LEARNING_FILE, JSON.stringify(history));
  } catch { /* non-fatal */ }
}

export async function clearLearningHistory(): Promise<void> {
  try {
    await FileSystem.deleteAsync(LEARNING_FILE, { idempotent: true });
  } catch { /* non-fatal */ }
}

// ── Recording ────────────────────────────────────────────────────────────────

/**
 * Whether a photo carries real sidecar measurements.
 *
 * v2 substituted defaults (0.5 / 0.3) for missing fields, so any photo past
 * the 120-photo scoring cap, or one the sidecar failed on, contributed
 * fabricated values to the averages (audit L4). `computeLearningBias` already
 * guarded on this; the recorder did not.
 */
export function hasRealFeatures(photo: LocalPhoto): boolean {
  return (
    photo.sharpness !== undefined &&
    photo.brightnessQuality !== undefined &&
    photo.contrast !== undefined &&
    photo.saturation !== undefined &&
    photo.complexity !== undefined
  );
}

/** Extract a feature vector. Only call when hasRealFeatures() is true. */
export function extractFeatures(photo: LocalPhoto): LearningFeatures {
  return {
    sharpness:         photo.sharpness!,
    faceCount:         photo.faceCount ?? 0,
    brightnessQuality: photo.brightnessQuality!,
    contrast:          photo.contrast!,
    saturation:        photo.saturation!,
    complexity:        photo.complexity!,
  };
}

/** Fold one weighted sample into a running average. */
export function updateStats(
  stats: WeightedStats,
  sample: LearningFeatures,
  weight: number,
): WeightedStats {
  const nextWeight = stats.weight + weight;
  if (nextWeight <= 0) return stats;
  const avg = { ...ZERO_FEATURES };
  for (const k of FEATURE_KEYS) {
    avg[k] = stats.avg[k] + ((sample[k] - stats.avg[k]) * weight) / nextWeight;
  }
  return { count: stats.count + 1, weight: nextWeight, avg };
}

/** Which face-count bucket a photo falls into. */
export function groupBucket(faceCount: number): keyof Omit<GroupSizePreference, 'totalPromoted'> {
  if (faceCount === 0) return 'noFace';
  if (faceCount === 1) return 'solo';
  if (faceCount <= 3) return 'small';
  return 'group';
}

/** Apply one outcome to a persona's stats. Pure — the caller persists. */
export function applyOutcome(
  learning: PersonaLearning,
  photo: LocalPhoto,
  outcome: Outcome,
): PersonaLearning {
  if (!hasRealFeatures(photo)) return learning;

  const features = extractFeatures(photo);
  const weight = OUTCOME_WEIGHTS[outcome];
  const next: PersonaLearning = {
    kept: learning.kept,
    promoted: learning.promoted,
    rejected: learning.rejected,
    groupSize: { ...learning.groupSize },
  };

  next[outcome] = updateStats(learning[outcome], features, weight);

  // Group preference reflects what the user was happy to publish, so both
  // approving outcomes contribute — at their own weight. Rejections never do:
  // removing one crowd shot is not evidence about crowd shots in general.
  if (outcome !== 'rejected') {
    const bucket = groupBucket(photo.faceCount ?? 0);
    next.groupSize[bucket] += weight;
    next.groupSize.totalPromoted += weight;
  }

  return next;
}

/**
 * Record a batch of review outcomes in one write.
 *
 * Takes the whole session at once rather than one call per edit, because the
 * caller resolves each photo to a single final outcome first. Previously each
 * toggle wrote immediately, so promote → deselect → promote recorded two
 * promotions and a rejection for one photo (audit L5).
 */
export async function recordOutcomes(
  entries: Array<{ photo: LocalPhoto; outcome: Outcome }>,
  persona: PersonaType | null,
): Promise<void> {
  if (entries.length === 0) return;
  try {
    const history = await loadLearningHistory();
    const key = persona ?? 'default';
    let entry = history[key] ?? emptyPersonaLearning();
    for (const { photo, outcome } of entries) {
      entry = applyOutcome(entry, photo, outcome);
    }
    history[key] = entry;
    await saveLearningHistory(history);
  } catch { /* non-fatal — learning must never break curation */ }
}

/**
 * Human-readable summary of what the app has learned for a persona.
 * Returns null until enough decisive edits exist.
 */
export function learningInsight(learning: PersonaLearning | undefined | null): string | null {
  if (!isLearningActive(learning)) return null;

  const { groupSize } = learning!;
  if (groupSize.totalPromoted <= 0) return null;

  const buckets = ['noFace', 'solo', 'small', 'group'] as const;
  const dominant = buckets.reduce(
    (best, key) => (groupSize[key] > groupSize[best] ? key : best),
    'noFace' as (typeof buckets)[number],
  );
  const labels: Record<typeof dominant, string> = {
    noFace: 'no-people shots',
    solo:   'solo shots',
    small:  'small group shots',
    group:  'large group shots',
  };
  const pct = Math.round((groupSize[dominant] / groupSize.totalPromoted) * 100);
  const approved = approvedStats(learning!);
  return `Based on ${approved.count} past picks: you tend to prefer ${labels[dominant]} (${pct}%)`;
}
