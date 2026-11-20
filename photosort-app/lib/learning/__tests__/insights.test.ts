/**
 * Taste-profile tests for the v3 weighted model.
 *
 * Readiness counts only decisive edits — promotions and rejections. A user who
 * accepts every AI pick has not revealed a taste, so the profile stays locked
 * (audit L1).
 */
import { computeTasteProfile } from '../insights';
import {
  MIN_DECISIVE_EXAMPLES,
  emptyPersonaLearning,
  type LearningFeatures,
  type LearningHistory,
  type Outcome,
  type PersonaLearning,
  type WeightedStats,
} from '../storage';

const ZERO: LearningFeatures = {
  sharpness: 0, faceCount: 0, brightnessQuality: 0, contrast: 0, saturation: 0, complexity: 0,
};

/** Build a stats bucket directly, bypassing the running average. */
function stats(count: number, avg: Partial<LearningFeatures> = {}, weight = count): WeightedStats {
  return { count, weight, avg: { ...ZERO, ...avg } };
}

function persona(over: Partial<PersonaLearning> = {}): PersonaLearning {
  return { ...emptyPersonaLearning(), ...over };
}

/** Group buckets summing to `total`, all in one bucket. */
function group(bucket: 'noFace' | 'solo' | 'small' | 'group', total: number) {
  return { noFace: 0, solo: 0, small: 0, group: 0, totalPromoted: total, [bucket]: total };
}

/** A persona with `n` decisive edits, so the profile is unlocked. */
function unlocked(over: Partial<PersonaLearning> = {}, n = MIN_DECISIVE_EXAMPLES): PersonaLearning {
  return persona({ promoted: stats(n), ...over });
}

describe('readiness', () => {
  it('reports a countdown below the gate', () => {
    const p = computeTasteProfile({ aesthete: persona({ promoted: stats(2), rejected: stats(1) }) });

    expect(p.ready).toBe(false);
    expect(p.sampleCount).toBe(3);
    expect(p.remaining).toBe(MIN_DECISIVE_EXAMPLES - 3);
  });

  it('is ready at exactly the gate', () => {
    const p = computeTasteProfile({
      aesthete: persona({ promoted: stats(3), rejected: stats(2) }),
    });

    expect(p.ready).toBe(true);
    expect(p.remaining).toBe(0);
  });

  it('stays locked on kept outcomes alone, however many (audit L1)', () => {
    const p = computeTasteProfile({ aesthete: persona({ kept: stats(40, {}, 12) }) });

    expect(p.ready).toBe(false);
    expect(p.sampleCount).toBe(0);
    expect(p.remaining).toBe(MIN_DECISIVE_EXAMPLES);
  });

  it('counts approvals in promotedCount even while locked', () => {
    const p = computeTasteProfile({ aesthete: persona({ kept: stats(8, {}, 2.4) }) });

    expect(p.promotedCount).toBe(8);
    expect(p.ready).toBe(false);
  });

  it('sums decisive edits across personas', () => {
    const p = computeTasteProfile({
      aesthete: persona({ promoted: stats(3) }),
      social: persona({ rejected: stats(2) }),
    });

    expect(p.sampleCount).toBe(MIN_DECISIVE_EXAMPLES);
    expect(p.ready).toBe(true);
  });
});

describe('trait leans', () => {
  it('derives a positive lean from the approved-minus-rejected delta', () => {
    const p = computeTasteProfile({
      aesthete: unlocked({
        promoted: stats(MIN_DECISIVE_EXAMPLES, { saturation: 0.8 }),
        rejected: stats(3, { saturation: 0.2 }),
      }),
    });

    expect(p.traits.find((t) => t.key === 'saturation')!.lean).toBeGreaterThan(0);
  });

  it('derives a negative lean when the rejected side scores higher', () => {
    const p = computeTasteProfile({
      aesthete: unlocked({
        promoted: stats(MIN_DECISIVE_EXAMPLES, { sharpness: 0.2 }),
        rejected: stats(3, { sharpness: 0.9 }),
      }),
    });

    expect(p.traits.find((t) => t.key === 'sharpness')!.lean).toBeLessThan(0);
  });

  it('inverts complexity so preferring low clutter reads as clean framing', () => {
    const p = computeTasteProfile({
      aesthete: unlocked({
        promoted: stats(MIN_DECISIVE_EXAMPLES, { complexity: 0.1 }),
        rejected: stats(3, { complexity: 0.8 }),
      }),
    });

    const clean = p.traits.find((t) => t.key === 'clean')!;
    expect(clean.lean).toBeGreaterThan(0);
    expect(clean.label).toContain('clean');
  });

  it('folds kept photos into the approved average', () => {
    const p = computeTasteProfile({
      aesthete: unlocked({
        kept: stats(10, { saturation: 1 }, 3),
        promoted: stats(MIN_DECISIVE_EXAMPLES, { saturation: 1 }),
        rejected: stats(3, { saturation: 0 }),
      }),
    });

    expect(p.traits.find((t) => t.key === 'saturation')!.lean).toBeGreaterThan(0);
  });

  it('clamps every lean into [-1, 1]', () => {
    const p = computeTasteProfile({
      aesthete: unlocked({
        promoted: stats(MIN_DECISIVE_EXAMPLES, { saturation: 1, faceCount: 10 }),
        rejected: stats(3, { saturation: 0, faceCount: 0 }),
      }),
    });

    for (const t of p.traits) {
      expect(t.lean).toBeGreaterThanOrEqual(-1);
      expect(t.lean).toBeLessThanOrEqual(1);
    }
  });

  it('sorts traits by absolute lean, strongest first', () => {
    const p = computeTasteProfile({
      aesthete: unlocked({
        promoted: stats(MIN_DECISIVE_EXAMPLES, { saturation: 0.9, contrast: 0.55 }),
        rejected: stats(3, { saturation: 0.1, contrast: 0.5 }),
      }),
    });

    const magnitudes = p.traits.map((t) => Math.abs(t.lean));
    expect([...magnitudes].sort((a, b) => b - a)).toEqual(magnitudes);
  });

  it('always reports all six dimensions', () => {
    expect(computeTasteProfile({ aesthete: unlocked() }).traits).toHaveLength(6);
  });
});

describe('dominant group', () => {
  it('reports the heaviest bucket', () => {
    const p = computeTasteProfile({
      aesthete: unlocked({ groupSize: group('solo', 7) }),
    });

    expect(p.dominantGroup).toBe('solo shots');
  });

  it('sums buckets across personas', () => {
    const p = computeTasteProfile({
      aesthete: unlocked({ groupSize: { noFace: 1, solo: 0, small: 0, group: 0, totalPromoted: 1 } }),
      social: persona({
        promoted: stats(3),
        groupSize: { noFace: 0, solo: 0, small: 9, group: 0, totalPromoted: 9 },
      }),
    });

    expect(p.dominantGroup).toBe('small group shots');
  });

  it('falls back to no-people shots when nothing was recorded', () => {
    expect(computeTasteProfile({ aesthete: unlocked() }).dominantGroup).toBe('no-people shots');
  });
});

describe('narrative', () => {
  it('is empty while locked', () => {
    expect(computeTasteProfile({ aesthete: persona({ promoted: stats(1) }) }).narrative).toBe('');
  });

  it('is written once ready', () => {
    const p = computeTasteProfile({
      aesthete: unlocked({
        promoted: stats(MIN_DECISIVE_EXAMPLES, { saturation: 0.9, brightnessQuality: 0.9 }),
        rejected: stats(3, { saturation: 0.1, brightnessQuality: 0.1 }),
        groupSize: group('solo', 5),
      }),
    });

    expect(p.narrative).toContain('drawn to');
    expect(p.narrative).toContain('solo shots');
  });

  it('admits when no lean is strong enough to name', () => {
    const p = computeTasteProfile({
      aesthete: unlocked({
        promoted: stats(MIN_DECISIVE_EXAMPLES, { saturation: 0.5 }),
        rejected: stats(3, { saturation: 0.5 }),
      }),
    });

    expect(p.narrative).toContain('still taking shape');
  });

  it('mentions what the user passes on when a trait leans negative', () => {
    const p = computeTasteProfile({
      aesthete: unlocked({
        promoted: stats(MIN_DECISIVE_EXAMPLES, { sharpness: 0.1 }),
        rejected: stats(3, { sharpness: 0.9 }),
      }),
    });

    expect(p.narrative).toContain('pass on');
  });
});

describe('edge cases', () => {
  it('handles an empty history without throwing', () => {
    const p = computeTasteProfile({});

    expect(p.ready).toBe(false);
    expect(p.sampleCount).toBe(0);
    expect(p.traits).toHaveLength(6);
    expect(p.narrative).toBe('');
  });

  it('handles a persona with no recorded outcomes at all', () => {
    const p = computeTasteProfile({ aesthete: emptyPersonaLearning() } as LearningHistory);

    expect(p.ready).toBe(false);
    expect(p.traits.every((t) => t.lean === 0)).toBe(true);
  });

  it('produces zero leans when approvals and rejections match exactly', () => {
    const p = computeTasteProfile({
      aesthete: unlocked({
        promoted: stats(MIN_DECISIVE_EXAMPLES, { saturation: 0.5, sharpness: 0.5 }),
        rejected: stats(MIN_DECISIVE_EXAMPLES, { saturation: 0.5, sharpness: 0.5 }),
      }),
    });

    expect(p.traits.every((t) => t.lean === 0)).toBe(true);
  });

  it('does not divide by zero when a bucket has count but no weight', () => {
    const p = computeTasteProfile({
      aesthete: unlocked({ promoted: stats(MIN_DECISIVE_EXAMPLES, { saturation: 1 }, 0) }),
    });

    expect(p.traits.every((t) => Number.isFinite(t.lean))).toBe(true);
  });
});

// Keeps the Outcome type referenced so a rename surfaces here too.
const _outcomes: Outcome[] = ['kept', 'promoted', 'rejected'];
void _outcomes;
