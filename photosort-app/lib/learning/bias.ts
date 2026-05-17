/**
 * Learning bias computation — adjusts per-photo quality scores based on
 * accumulated promoted/rejected examples from past review sessions.
 *
 * The bias is a multiplier in [0.75, 1.25] applied after the persona formula.
 * It activates only once ≥5 combined examples exist for a persona, to avoid
 * noise from a single session skewing results.
 */

import type { LocalPhoto } from '../store/state';
import type { PersonaType } from '../store/state';
import type { LearningFeatures, LearningHistory } from './storage';

const MIN_EXAMPLES = 5;   // combined promoted + rejected before bias activates
const MAX_BIAS     = 0.25; // cap at ±25%

/** Convert LearningFeatures to a normalised 6-element vector for cosine similarity. */
function toVector(f: LearningFeatures): number[] {
  // faceCount typically 0–6; normalise to 0–1 by dividing by 6
  return [
    f.sharpness,
    Math.min(f.faceCount / 6, 1),
    f.brightnessQuality,
    f.contrast,
    f.saturation,
    1 - f.complexity,   // invert complexity: lower is "simpler/cleaner"
  ];
}

function dot(a: number[], b: number[]): number {
  return a.reduce((s, v, i) => s + v * b[i], 0);
}

function magnitude(v: number[]): number {
  return Math.sqrt(v.reduce((s, x) => s + x * x, 0));
}

function cosineSimilarity(a: number[], b: number[]): number {
  const magA = magnitude(a);
  const magB = magnitude(b);
  if (magA === 0 || magB === 0) return 0;
  return dot(a, b) / (magA * magB);
}

function extractVector(photo: LocalPhoto): number[] {
  return toVector({
    sharpness:         photo.sharpness         ?? 0.5,
    faceCount:         photo.faceCount         ?? 0,
    brightnessQuality: photo.brightnessQuality ?? 0.5,
    contrast:          photo.contrast          ?? 0.5,
    saturation:        photo.saturation        ?? 0.3,
    complexity:        photo.complexity        ?? 0.3,
  });
}

/**
 * Compute a score multiplier for a photo based on the learning history.
 *
 * Returns 1.0 (no change) when:
 *   - No history exists for this persona
 *   - Fewer than MIN_EXAMPLES combined examples recorded
 *   - The photo has no vision metric fields (wasn't sent to the sidecar)
 *
 * Returns a value in [0.75, 1.25] otherwise.
 */
export function computeLearningBias(
  photo: LocalPhoto,
  persona: PersonaType | null,
  history: LearningHistory,
): number {
  const key = persona ?? 'default';
  const learning = history[key];
  if (!learning) return 1.0;

  const total = learning.promotedCount + learning.rejectedCount;
  if (total < MIN_EXAMPLES) return 1.0;

  // If the photo was never scored by the sidecar, skip bias (no reliable features)
  if (photo.sharpness === undefined) return 1.0;

  const photoVec = extractVector(photo);

  // Similarity to what the user tends to promote vs reject
  const promotedSim = learning.promotedCount > 0
    ? cosineSimilarity(photoVec, toVector(learning.promotedAvg))
    : 0;
  const rejectedSim = learning.rejectedCount > 0
    ? cosineSimilarity(photoVec, toVector(learning.rejectedAvg))
    : 0;

  // Positive = photo looks like promoted examples; negative = looks like rejected ones
  const net = promotedSim - rejectedSim;

  // Group-size explicit bonus/penalty
  const gs = learning.groupSize;
  let groupBonus = 0;
  if (gs.totalPromoted >= 3) {
    const fc = photo.faceCount ?? 0;
    const preferredBucket: 'noFace' | 'solo' | 'small' | 'group' =
      fc === 0 ? 'noFace' : fc === 1 ? 'solo' : fc <= 3 ? 'small' : 'group';
    const preferenceRatio = gs[preferredBucket] / gs.totalPromoted;
    // Bonus if this is the user's dominant bucket; penalty if they almost never pick it
    groupBonus = (preferenceRatio - 0.25) * 0.10; // ±0.075 max contribution
  }

  const bias = net * MAX_BIAS + groupBonus;
  return Math.max(1 - MAX_BIAS, Math.min(1 + MAX_BIAS, 1.0 + bias));
}
