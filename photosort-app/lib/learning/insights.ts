/**
 * Taste profile — turns the per-persona learning averages into a user-facing
 * "here's your style" summary. Pure and local; no backend.
 *
 * The signal lives in the DELTA between what the user approves of and what they
 * remove: a trait they consistently pick OVER what they skip is a real
 * preference. "Approves of" is kept plus promoted, weighted — see storage.ts
 * for why those two carry different weights.
 */
import {
  approvedStats,
  decisiveCount,
  MIN_DECISIVE_EXAMPLES,
  type LearningFeatures,
  type LearningHistory,
  type PersonaLearning,
  type WeightedStats,
} from './storage';

export interface TasteTrait {
  key: string;
  label: string;
  /** −1..1 — positive = drawn to it, negative = avoids it. */
  lean: number;
}

export interface TasteProfile {
  /** True once enough decisive edits exist (matches the learningInsight gate). */
  ready: boolean;
  /** Decisive edits — promoted + rejected — across all personas. */
  sampleCount: number;
  /** Photos the user approved of, kept and promoted together. */
  promotedCount: number;
  /** Decisive edits still needed to unlock (0 when ready). */
  remaining: number;
  /** 6 dimensions, sorted by |lean| descending. */
  traits: TasteTrait[];
  /** Friendly label, e.g. "solo shots". */
  dominantGroup: string;
  /** Human paragraph built from the top traits. */
  narrative: string;
}

/** Each visual dimension → friendly label, source feature, and direction. */
const SPECS: { key: string; label: string; feat: keyof LearningFeatures; invert: boolean; scale: number }[] = [
  { key: 'saturation', label: 'rich color',             feat: 'saturation',        invert: false, scale: 3 },
  { key: 'light',      label: 'balanced light',         feat: 'brightnessQuality', invert: false, scale: 3 },
  { key: 'sharpness',  label: 'crisp focus',            feat: 'sharpness',         invert: false, scale: 3 },
  { key: 'contrast',   label: 'punchy contrast',        feat: 'contrast',          invert: false, scale: 3 },
  { key: 'clean',      label: 'clean, minimal framing', feat: 'complexity',        invert: true,  scale: 3 },
  { key: 'people',     label: 'people in frame',        feat: 'faceCount',         invert: false, scale: 0.5 },
];

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Combine one bucket across every persona, weighting by accumulated weight. */
function weightedAvg(history: LearningHistory, pick: (p: PersonaLearning) => WeightedStats) {
  const sum: LearningFeatures = { sharpness: 0, faceCount: 0, brightnessQuality: 0, contrast: 0, saturation: 0, complexity: 0 };
  let total = 0;
  for (const p of Object.values(history)) {
    const { avg, weight } = pick(p);
    if (weight <= 0) continue;
    total += weight;
    (Object.keys(sum) as (keyof LearningFeatures)[]).forEach((k) => { sum[k] += avg[k] * weight; });
  }
  if (total > 0) (Object.keys(sum) as (keyof LearningFeatures)[]).forEach((k) => { sum[k] /= total; });
  return sum;
}

export function computeTasteProfile(history: LearningHistory): TasteProfile {
  const personas = Object.values(history);
  // Readiness counts only decisive edits. Kept photos are shown in
  // promotedCount because they are real approvals, but a user who edits
  // nothing must not unlock a taste profile built from the AI's own picks.
  const sampleCount = personas.reduce((s, p) => s + decisiveCount(p), 0);
  const promotedCount = personas.reduce((s, p) => s + approvedStats(p).count, 0);

  const promotedAvg = weightedAvg(history, (p) => approvedStats(p));
  const rejectedAvg = weightedAvg(history, (p) => p.rejected);

  const traits: TasteTrait[] = SPECS.map((s) => {
    const delta = promotedAvg[s.feat] - rejectedAvg[s.feat];
    const lean = clamp(delta * s.scale * (s.invert ? -1 : 1), -1, 1);
    return { key: s.key, label: s.label, lean };
  }).sort((a, b) => Math.abs(b.lean) - Math.abs(a.lean));

  // Dominant group from summed buckets
  const g = personas.reduce(
    (acc, p) => {
      acc.noFace += p.groupSize.noFace; acc.solo += p.groupSize.solo;
      acc.small += p.groupSize.small; acc.group += p.groupSize.group;
      return acc;
    },
    { noFace: 0, solo: 0, small: 0, group: 0 },
  );
  const groupLabels: Record<string, string> = {
    noFace: 'no-people shots', solo: 'solo shots', small: 'small group shots', group: 'big group shots',
  };
  const dominantKey = (Object.keys(g) as (keyof typeof g)[]).reduce((best, k) => (g[k] > g[best] ? k : best), 'noFace');
  const dominantGroup = groupLabels[dominantKey];

  const ready = sampleCount >= MIN_DECISIVE_EXAMPLES;
  const narrative = ready ? buildNarrative(traits, dominantGroup) : '';

  return {
    ready,
    sampleCount,
    promotedCount,
    remaining: Math.max(0, MIN_DECISIVE_EXAMPLES - sampleCount),
    traits,
    dominantGroup,
    narrative,
  };
}

function buildNarrative(traits: TasteTrait[], dominantGroup: string): string {
  const positives = traits.filter((t) => t.lean > 0.08).slice(0, 2).map((t) => t.label);
  const avoided = traits.filter((t) => t.lean < -0.08).sort((a, b) => a.lean - b.lean)[0];

  let lead: string;
  if (positives.length === 2) lead = `You're drawn to ${positives[0]} and ${positives[1]}`;
  else if (positives.length === 1) lead = `You're drawn to ${positives[0]}`;
  else lead = `Your eye is still taking shape`;

  const group = ` — usually ${dominantGroup}.`;
  const tail = avoided ? ` You'll pass on photos that lack ${avoided.label}.` : '';
  return lead + group + tail;
}
