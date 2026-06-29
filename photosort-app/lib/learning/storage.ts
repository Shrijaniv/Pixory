/**
 * Self-learning storage — persists per-persona preference signals across sessions.
 *
 * Learning history lives in DocumentDirectory/pixory_learning_v1.json.
 * It is local to the device and never synced or committed to git.
 *
 * Each persona (+ "default" for no-persona sessions) tracks running averages
 * of the vision metric features for photos the user promoted vs rejected in
 * the review screen. Once ≥5 combined examples exist for a persona, these
 * averages are used to bias future scoring toward the user's actual preferences.
 */

import * as FileSystem from 'expo-file-system/legacy';
import type { LocalPhoto } from '../store/state';
import type { PersonaType } from '../store/state';

// v2: v1 recorded outcomes against the raw (unscored) photo snapshot, so every
// record carried default features (faceCount→0 etc.). v2 records against the
// scored set — bump invalidates the polluted v1 history and starts clean.
const LEARNING_FILE = FileSystem.documentDirectory + 'pixory_learning_v2.json';

/** 6-dimensional feature vector matching the sidecar's vision signals. */
export interface LearningFeatures {
  sharpness: number;
  faceCount: number;       // raw count (not divided) — easier to read
  brightnessQuality: number;
  contrast: number;
  saturation: number;
  complexity: number;
}

/** Tracks which face-count bucket the user tends to prefer. */
export interface GroupSizePreference {
  noFace: number;    // promoted photos with 0 faces (total, not ratio)
  solo: number;      // face_count === 1
  small: number;     // face_count 2–3
  group: number;     // face_count 4+
  totalPromoted: number;
}

/** Learning history for a single persona. */
export interface PersonaLearning {
  promotedCount: number;
  promotedAvg: LearningFeatures;
  rejectedCount: number;
  rejectedAvg: LearningFeatures;
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

function emptyPersonaLearning(): PersonaLearning {
  return {
    promotedCount: 0,
    promotedAvg: { ...ZERO_FEATURES },
    rejectedCount: 0,
    rejectedAvg: { ...ZERO_FEATURES },
    groupSize: { ...ZERO_GROUP },
  };
}

export async function loadLearningHistory(): Promise<LearningHistory> {
  try {
    const raw = await FileSystem.readAsStringAsync(LEARNING_FILE);
    return JSON.parse(raw) as LearningHistory;
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

/** Extract a LearningFeatures vector from a LocalPhoto (uses cached sidecar fields). */
function extractFeatures(photo: LocalPhoto): LearningFeatures {
  return {
    sharpness:        photo.sharpness        ?? 0.5,
    faceCount:        photo.faceCount        ?? 0,
    brightnessQuality:photo.brightnessQuality ?? 0.5,
    contrast:         photo.contrast         ?? 0.5,
    saturation:       photo.saturation       ?? 0.3,
    complexity:       photo.complexity       ?? 0.3,
  };
}

/** Update a running average with a new sample (Welford's online algorithm). */
function updateAvg(avg: LearningFeatures, count: number, sample: LearningFeatures): LearningFeatures {
  const n = count + 1;
  return {
    sharpness:         avg.sharpness         + (sample.sharpness         - avg.sharpness)         / n,
    faceCount:         avg.faceCount         + (sample.faceCount         - avg.faceCount)         / n,
    brightnessQuality: avg.brightnessQuality + (sample.brightnessQuality - avg.brightnessQuality) / n,
    contrast:          avg.contrast          + (sample.contrast          - avg.contrast)          / n,
    saturation:        avg.saturation        + (sample.saturation        - avg.saturation)        / n,
    complexity:        avg.complexity        + (sample.complexity        - avg.complexity)        / n,
  };
}

/**
 * Record a user edit outcome for a photo. Call this when the user:
 *   - 'promoted': adds a runner-up to their selection
 *   - 'rejected': removes an AI-selected photo from their selection
 */
export async function recordOutcome(
  photo: LocalPhoto,
  outcome: 'promoted' | 'rejected',
  persona: PersonaType | null,
): Promise<void> {
  try {
    const history = await loadLearningHistory();
    const key = persona ?? 'default';
    const entry = history[key] ?? emptyPersonaLearning();

    const features = extractFeatures(photo);

    if (outcome === 'promoted') {
      entry.promotedAvg = updateAvg(entry.promotedAvg, entry.promotedCount, features);
      entry.promotedCount += 1;

      // Group size tracking
      const fc = photo.faceCount ?? 0;
      if (fc === 0)       entry.groupSize.noFace  += 1;
      else if (fc === 1)  entry.groupSize.solo    += 1;
      else if (fc <= 3)   entry.groupSize.small   += 1;
      else                entry.groupSize.group   += 1;
      entry.groupSize.totalPromoted += 1;

    } else {
      entry.rejectedAvg = updateAvg(entry.rejectedAvg, entry.rejectedCount, features);
      entry.rejectedCount += 1;
    }

    history[key] = entry;
    await saveLearningHistory(history);
  } catch { /* non-fatal — learning failure must never break curation */ }
}

/**
 * Human-readable summary of what the app has learned for a persona.
 * Returns null if not enough data (< 5 combined examples).
 */
export function learningInsight(learning: PersonaLearning | undefined | null): string | null {
  if (!learning) return null;
  const total = learning.promotedCount + learning.rejectedCount;
  if (total < 5) return null;

  const { groupSize } = learning;
  if (groupSize.totalPromoted === 0) return null;

  const dominant = (['noFace', 'solo', 'small', 'group'] as const).reduce(
    (best, key) => groupSize[key] > groupSize[best] ? key : best,
    'noFace' as 'noFace' | 'solo' | 'small' | 'group',
  );
  const labels: Record<typeof dominant, string> = {
    noFace: 'no-people shots',
    solo:   'solo shots',
    small:  'small group shots',
    group:  'large group shots',
  };
  const pct = Math.round((groupSize[dominant] / groupSize.totalPromoted) * 100);
  return `Based on ${learning.promotedCount} past picks: you tend to prefer ${labels[dominant]} (${pct}%)`;
}
