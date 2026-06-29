import { computeTasteProfile } from '../insights';
import type { LearningHistory, PersonaLearning } from '../storage';

const ZERO = { sharpness: 0, faceCount: 0, brightnessQuality: 0, contrast: 0, saturation: 0, complexity: 0 };

function persona(over: Partial<PersonaLearning>): PersonaLearning {
  return {
    promotedCount: 0,
    promotedAvg: { ...ZERO },
    rejectedCount: 0,
    rejectedAvg: { ...ZERO },
    groupSize: { noFace: 0, solo: 0, small: 0, group: 0, totalPromoted: 0 },
    ...over,
  };
}

describe('computeTasteProfile', () => {
  it('reports not-ready with a countdown below 5 samples', () => {
    const history: LearningHistory = {
      aesthete: persona({ promotedCount: 2, rejectedCount: 1 }),
    };
    const p = computeTasteProfile(history);
    expect(p.ready).toBe(false);
    expect(p.sampleCount).toBe(3);
    expect(p.remaining).toBe(2);
    expect(p.narrative).toBe('');
  });

  it('is ready at exactly 5 combined samples', () => {
    const history: LearningHistory = {
      default: persona({ promotedCount: 3, rejectedCount: 2 }),
    };
    expect(computeTasteProfile(history).ready).toBe(true);
    expect(computeTasteProfile(history).remaining).toBe(0);
  });

  it('derives a positive lean from the promoted−rejected delta', () => {
    // Promotes are richly saturated; rejects are washed out → "rich color" leans positive
    const history: LearningHistory = {
      mood: persona({
        promotedCount: 5,
        promotedAvg: { ...ZERO, saturation: 0.8, brightnessQuality: 0.5 },
        rejectedCount: 5,
        rejectedAvg: { ...ZERO, saturation: 0.2, brightnessQuality: 0.5 },
      }),
    };
    const color = computeTasteProfile(history).traits.find((t) => t.key === 'saturation')!;
    expect(color.lean).toBeGreaterThan(0);
  });

  it('inverts complexity so preferring low-clutter reads as positive "clean framing"', () => {
    const history: LearningHistory = {
      aesthete: persona({
        promotedCount: 5,
        promotedAvg: { ...ZERO, complexity: 0.1 },  // promotes clean shots
        rejectedCount: 5,
        rejectedAvg: { ...ZERO, complexity: 0.9 },  // rejects busy shots
      }),
    };
    const clean = computeTasteProfile(history).traits.find((t) => t.key === 'clean')!;
    expect(clean.lean).toBeGreaterThan(0);
  });

  it('reports the dominant group from summed buckets (the core bug fix)', () => {
    const history: LearningHistory = {
      social: persona({
        promotedCount: 6,
        groupSize: { noFace: 1, solo: 5, small: 0, group: 0, totalPromoted: 6 },
      }),
    };
    expect(computeTasteProfile(history).dominantGroup).toBe('solo shots');
  });

  it('aggregates across personas, count-weighting the averages', () => {
    const history: LearningHistory = {
      a: persona({ promotedCount: 1, promotedAvg: { ...ZERO, saturation: 1.0 } }),
      b: persona({ promotedCount: 3, promotedAvg: { ...ZERO, saturation: 0.0 } }),
    };
    const p = computeTasteProfile(history);
    expect(p.promotedCount).toBe(4);
    // weighted mean saturation = (1*1 + 3*0)/4 = 0.25 → positive but small lean vs zero rejects
    const color = p.traits.find((t) => t.key === 'saturation')!;
    expect(color.lean).toBeCloseTo(0.25 * 3, 5); // delta 0.25 × scale 3, clamped ≤1
  });

  it('builds a non-empty narrative once ready', () => {
    const history: LearningHistory = {
      mood: persona({
        promotedCount: 5,
        promotedAvg: { ...ZERO, saturation: 0.8, brightnessQuality: 0.8 },
        groupSize: { noFace: 0, solo: 5, small: 0, group: 0, totalPromoted: 5 },
      }),
    };
    const n = computeTasteProfile(history).narrative;
    expect(n.length).toBeGreaterThan(0);
    expect(n).toContain('solo shots');
  });

  it('handles empty history without throwing', () => {
    const p = computeTasteProfile({});
    expect(p.ready).toBe(false);
    expect(p.sampleCount).toBe(0);
    expect(p.traits).toHaveLength(6);
  });
});
