/**
 * Learning bias — adjusts per-photo quality scores using what the user did to
 * the AI's picks in past review sessions.
 *
 * The bias is a multiplier applied after the persona formula. It activates only
 * once enough *decisive* edits exist (see `isLearningActive`): a session the
 * user never touched produces only `kept` events and tells us nothing about
 * their taste beyond what the AI already thought.
 */

import type { LocalPhoto } from '../store/state';
import type { PersonaType } from '../store/state';
import {
  approvedStats,
  hasRealFeatures,
  isLearningActive,
  type LearningFeatures,
  type LearningHistory,
} from './storage';

/** Cap on how far learning may move a score, in either direction. */
export const MAX_BIAS = 0.25;

/** Weight of the vector-similarity term within the bias. */
const SIMILARITY_WEIGHT = MAX_BIAS;

/** Total weight in the group-size buckets before that signal is trusted. */
const MIN_GROUP_WEIGHT = 3;

/** Maximum contribution of the group-size preference. */
const GROUP_BONUS_SCALE = 0.10;

/** A bucket share above this is a preference; below it, an aversion. */
const NEUTRAL_BUCKET_SHARE = 0.25;

/** faceCount is a raw count; six faces is treated as "a crowd". */
const FACE_COUNT_CEILING = 6;

/** Convert LearningFeatures to a normalised 6-element vector. */
function toVector(f: LearningFeatures): number[] {
  return [
    f.sharpness,
    Math.min(f.faceCount / FACE_COUNT_CEILING, 1),
    f.brightnessQuality,
    f.contrast,
    f.saturation,
    1 - f.complexity, // invert: lower complexity is "cleaner"
  ];
}

function dot(a: number[], b: number[]): number {
  return a.reduce((s, v, i) => s + v * b[i], 0);
}

function magnitude(v: number[]): number {
  return Math.sqrt(dot(v, v));
}

export function cosineSimilarity(a: number[], b: number[]): number {
  const magA = magnitude(a);
  const magB = magnitude(b);
  if (magA === 0 || magB === 0) return 0;
  return dot(a, b) / (magA * magB);
}

function extractVector(photo: LocalPhoto): number[] {
  return toVector({
    sharpness:         photo.sharpness ?? 0,
    faceCount:         photo.faceCount ?? 0,
    brightnessQuality: photo.brightnessQuality ?? 0,
    contrast:          photo.contrast ?? 0,
    saturation:        photo.saturation ?? 0,
    complexity:        photo.complexity ?? 0,
  });
}

/**
 * Compute a score multiplier for a photo based on the learning history.
 *
 * Returns 1.0 (no change) when:
 *   - no history exists for this persona
 *   - too few decisive edits have been recorded
 *   - the photo carries no sidecar measurements
 *
 * Otherwise returns a value in [1 - MAX_BIAS, 1 + MAX_BIAS].
 */
export function computeLearningBias(
  photo: LocalPhoto,
  persona: PersonaType | null,
  history: LearningHistory,
): number {
  const learning = history[persona ?? 'default'];
  if (!isLearningActive(learning)) return 1.0;

  // A photo the sidecar never scored has no features to compare. Biasing it on
  // fabricated defaults would be worse than not biasing it at all.
  if (!hasRealFeatures(photo)) return 1.0;

  const photoVec = extractVector(photo);

  // Similarity to what the user approves of (kept + promoted, weighted) versus
  // what they remove.
  const approved = approvedStats(learning);
  const approvedSim = approved.weight > 0
    ? cosineSimilarity(photoVec, toVector(approved.avg))
    : 0;
  const rejectedSim = learning.rejected.weight > 0
    ? cosineSimilarity(photoVec, toVector(learning.rejected.avg))
    : 0;

  const net = approvedSim - rejectedSim;

  // Group-size preference, an explicit signal that survives the cosine's
  // insensitivity on all-positive vectors.
  const gs = learning.groupSize;
  let groupBonus = 0;
  if (gs.totalPromoted >= MIN_GROUP_WEIGHT) {
    const bucket =
      (photo.faceCount ?? 0) === 0 ? 'noFace'
      : (photo.faceCount ?? 0) === 1 ? 'solo'
      : (photo.faceCount ?? 0) <= 3 ? 'small'
      : 'group';
    const share = gs[bucket] / gs.totalPromoted;
    groupBonus = (share - NEUTRAL_BUCKET_SHARE) * GROUP_BONUS_SCALE;
  }

  const bias = net * SIMILARITY_WEIGHT + groupBonus;
  return Math.max(1 - MAX_BIAS, Math.min(1 + MAX_BIAS, 1.0 + bias));
}
