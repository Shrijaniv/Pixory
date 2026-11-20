/**
 * Learning-bias tests.
 *
 * The bias must stay inert until the user has actually revealed something. A
 * run they never edited produces only `kept` outcomes, and biasing on those
 * would make the scorer chase its own tail (audit L1).
 */
import { MAX_BIAS, computeLearningBias, cosineSimilarity } from '../bias';
import {
  MIN_DECISIVE_EXAMPLES,
  applyOutcome,
  emptyPersonaLearning,
  type LearningHistory,
  type Outcome,
  type PersonaLearning,
} from '../storage';
import type { LocalPhoto } from '../../store/state';

function photo(over: Partial<LocalPhoto> = {}): LocalPhoto {
  return {
    id: 'p', uri: 'ph://p', localUri: 'file:///p.jpg', filename: 'p.jpg',
    creationTime: 0, width: 100, height: 100, qualityScore: 0.5,
    sharpness: 0.8, faceCount: 1, brightnessQuality: 0.7,
    contrast: 0.6, saturation: 0.5, complexity: 0.3,
    ...over,
  } as LocalPhoto;
}

function unscored(): LocalPhoto {
  const p = photo();
  delete (p as Partial<LocalPhoto>).sharpness;
  delete (p as Partial<LocalPhoto>).brightnessQuality;
  delete (p as Partial<LocalPhoto>).contrast;
  delete (p as Partial<LocalPhoto>).saturation;
  delete (p as Partial<LocalPhoto>).complexity;
  return p;
}

/** Build a persona by replaying outcomes. */
function build(entries: Array<[Partial<LocalPhoto>, Outcome]>): PersonaLearning {
  let l = emptyPersonaLearning();
  for (const [over, outcome] of entries) l = applyOutcome(l, photo(over), outcome);
  return l;
}

function history(learning: PersonaLearning, key = 'default'): LearningHistory {
  return { [key]: learning };
}

/** n decisive edits, so the gate is open. */
function decisive(n = MIN_DECISIVE_EXAMPLES, over: Partial<LocalPhoto> = {}) {
  return Array.from({ length: n }, () => [over, 'promoted'] as [Partial<LocalPhoto>, Outcome]);
}

describe('activation', () => {
  it('is neutral with no history for the persona', () => {
    expect(computeLearningBias(photo(), null, {})).toBe(1.0);
  });

  it('is neutral when the persona has no entry', () => {
    expect(computeLearningBias(photo(), 'mood', history(build(decisive())))).toBe(1.0);
  });

  it('is neutral below the decisive-edit gate', () => {
    const learning = build(decisive(MIN_DECISIVE_EXAMPLES - 1));

    expect(computeLearningBias(photo(), null, history(learning))).toBe(1.0);
  });

  it('stays neutral after a session the user never edited (audit L1)', () => {
    const keptOnly: Array<[Partial<LocalPhoto>, Outcome]> =
      Array.from({ length: 30 }, () => [{}, 'kept']);

    expect(computeLearningBias(photo(), null, history(build(keptOnly)))).toBe(1.0);
  });

  it('activates once the gate opens', () => {
    const learning = build([
      ...decisive(MIN_DECISIVE_EXAMPLES, { sharpness: 0.9, complexity: 0.1 }),
      [{ sharpness: 0.1, complexity: 0.9 }, 'rejected'],
    ]);

    expect(computeLearningBias(photo({ sharpness: 0.9, complexity: 0.1 }), null, history(learning)))
      .not.toBe(1.0);
  });

  it('is neutral for a photo with no measurements (audit L4)', () => {
    const learning = build(decisive());

    expect(computeLearningBias(unscored(), null, history(learning))).toBe(1.0);
  });

  it('uses the persona key when one is set', () => {
    const learning = build(decisive(MIN_DECISIVE_EXAMPLES, { faceCount: 0 }));

    expect(computeLearningBias(photo({ faceCount: 0 }), 'social', history(learning, 'social')))
      .not.toBe(1.0);
  });
});

describe('direction', () => {
  const approved = { sharpness: 0.95, brightnessQuality: 0.9, contrast: 0.8, saturation: 0.7, complexity: 0.05, faceCount: 0 };
  const rejected = { sharpness: 0.1, brightnessQuality: 0.2, contrast: 0.2, saturation: 0.15, complexity: 0.9, faceCount: 5 };

  const learning = build([
    ...decisive(MIN_DECISIVE_EXAMPLES, approved),
    [rejected, 'rejected'], [rejected, 'rejected'], [rejected, 'rejected'],
  ]);

  it('rewards a photo resembling what the user approves of', () => {
    expect(computeLearningBias(photo(approved), null, history(learning))).toBeGreaterThan(1.0);
  });

  it('penalises a photo resembling what the user removes', () => {
    expect(computeLearningBias(photo(rejected), null, history(learning))).toBeLessThan(1.0);
  });

  it('separates the two by a usable margin', () => {
    const good = computeLearningBias(photo(approved), null, history(learning));
    const bad = computeLearningBias(photo(rejected), null, history(learning));

    expect(good - bad).toBeGreaterThan(0.05);
  });
});

describe('bounds', () => {
  it('never exceeds the cap in either direction', () => {
    const extreme = build([
      ...decisive(20, { sharpness: 1, brightnessQuality: 1, contrast: 1, saturation: 1, complexity: 0, faceCount: 0 }),
      ...Array.from({ length: 20 }, () => [
        { sharpness: 0, brightnessQuality: 0, contrast: 0, saturation: 0, complexity: 1, faceCount: 8 },
        'rejected',
      ] as [Partial<LocalPhoto>, Outcome]),
    ]);

    const candidates = [
      photo({ sharpness: 1, brightnessQuality: 1, contrast: 1, saturation: 1, complexity: 0, faceCount: 0 }),
      photo({ sharpness: 0, brightnessQuality: 0, contrast: 0, saturation: 0, complexity: 1, faceCount: 9 }),
      photo({ sharpness: 0.5, complexity: 0.5, faceCount: 3 }),
    ];

    for (const c of candidates) {
      const bias = computeLearningBias(c, null, history(extreme));
      expect(bias).toBeGreaterThanOrEqual(1 - MAX_BIAS);
      expect(bias).toBeLessThanOrEqual(1 + MAX_BIAS);
    }
  });

  it('caps at 25%', () => {
    expect(MAX_BIAS).toBe(0.25);
  });

  it('returns a finite number for every plausible input', () => {
    const learning = build(decisive());
    const odd = [
      photo({ sharpness: 0, brightnessQuality: 0, contrast: 0, saturation: 0, complexity: 0, faceCount: 0 }),
      photo({ faceCount: 100 }),
    ];

    for (const p of odd) {
      expect(Number.isFinite(computeLearningBias(p, null, history(learning)))).toBe(true);
    }
  });
});

describe('group-size preference', () => {
  it('favours the bucket the user actually publishes', () => {
    const soloLover = build(decisive(MIN_DECISIVE_EXAMPLES, { faceCount: 1 }));

    const solo = computeLearningBias(photo({ faceCount: 1 }), null, history(soloLover));
    const crowd = computeLearningBias(photo({ faceCount: 6 }), null, history(soloLover));

    expect(solo).toBeGreaterThan(crowd);
  });

  it('ignores group size until enough weight has accumulated', () => {
    // Two promotions clear neither the decisive gate nor the group threshold.
    const thin = build(decisive(2, { faceCount: 1 }));

    expect(computeLearningBias(photo({ faceCount: 1 }), null, history(thin))).toBe(1.0);
  });

  it('does not let rejections shape the group preference', () => {
    const learning = build([
      ...decisive(MIN_DECISIVE_EXAMPLES, { faceCount: 0 }),
      [{ faceCount: 5 }, 'rejected'],
    ]);

    expect(learning.groupSize.group).toBe(0);
  });
});

describe('cosineSimilarity', () => {
  it('is 1 for identical vectors', () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1, 10);
  });

  it('is 0 for orthogonal vectors', () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0, 10);
  });

  it('is scale invariant', () => {
    expect(cosineSimilarity([1, 2], [2, 4])).toBeCloseTo(1, 10);
  });

  it('returns 0 rather than NaN for a zero vector', () => {
    expect(cosineSimilarity([0, 0], [1, 1])).toBe(0);
    expect(cosineSimilarity([1, 1], [0, 0])).toBe(0);
    expect(cosineSimilarity([0, 0], [0, 0])).toBe(0);
  });
});
