/**
 * Learning storage tests — the v3 weighted three-outcome model.
 *
 * The behaviour these lock down is the fix for audit L1: a session the user
 * never edited must not unlock the scoring bias, because every photo in it was
 * chosen by the AI and tells us nothing about the user's own taste.
 */
import * as FileSystem from 'expo-file-system/legacy';
import {
  MIN_DECISIVE_EXAMPLES,
  OUTCOME_WEIGHTS,
  applyOutcome,
  approvedStats,
  clearLearningHistory,
  decisiveCount,
  emptyPersonaLearning,
  extractFeatures,
  groupBucket,
  hasRealFeatures,
  isLearningActive,
  learningInsight,
  loadLearningHistory,
  mergeStats,
  recordOutcomes,
  updateStats,
  type LearningFeatures,
  type PersonaLearning,
} from '../storage';
import type { LocalPhoto } from '../../store/state';

const LEARNING_FILE = 'file:///mock-doc-dir/pixory_learning_v3.json';

const fs = new Map<string, string>();

beforeEach(() => {
  fs.clear();
  (FileSystem.readAsStringAsync as jest.Mock).mockImplementation(async (p: string) => {
    if (!fs.has(p)) throw new Error('not found');
    return fs.get(p)!;
  });
  (FileSystem.writeAsStringAsync as jest.Mock).mockImplementation(
    async (p: string, data: string) => {
      fs.set(p, data);
    },
  );
  (FileSystem.deleteAsync as jest.Mock).mockImplementation(async (p: string) => {
    fs.delete(p);
  });
});

function photo(over: Partial<LocalPhoto> = {}): LocalPhoto {
  return {
    id: 'p', uri: 'ph://p', localUri: 'file:///p.jpg', filename: 'p.jpg',
    creationTime: 0, width: 100, height: 100, qualityScore: 0.5,
    sharpness: 0.8, faceCount: 1, brightnessQuality: 0.7,
    contrast: 0.6, saturation: 0.5, complexity: 0.3,
    ...over,
  } as LocalPhoto;
}

/** A photo the sidecar never scored. */
function unscored(over: Partial<LocalPhoto> = {}): LocalPhoto {
  const p = photo(over);
  delete (p as Partial<LocalPhoto>).sharpness;
  delete (p as Partial<LocalPhoto>).brightnessQuality;
  delete (p as Partial<LocalPhoto>).contrast;
  delete (p as Partial<LocalPhoto>).saturation;
  delete (p as Partial<LocalPhoto>).complexity;
  return p;
}

const ZERO: LearningFeatures = {
  sharpness: 0, faceCount: 0, brightnessQuality: 0, contrast: 0, saturation: 0, complexity: 0,
};

// ── Weights and the activation gate ─────────────────────────────────────────

describe('outcome weights', () => {
  it('treats deliberate edits as worth more than leaving a pick alone', () => {
    expect(OUTCOME_WEIGHTS.kept).toBeLessThan(OUTCOME_WEIGHTS.promoted);
    expect(OUTCOME_WEIGHTS.promoted).toBe(OUTCOME_WEIGHTS.rejected);
  });

  it('weights kept at 0.3 and the decisive actions at 1.0', () => {
    expect(OUTCOME_WEIGHTS).toEqual({ kept: 0.3, promoted: 1.0, rejected: 1.0 });
  });
});

describe('activation gate (audit L1)', () => {
  it('does not activate on kept outcomes alone, however many', () => {
    let learning = emptyPersonaLearning();
    for (let i = 0; i < 50; i++) learning = applyOutcome(learning, photo(), 'kept');

    expect(decisiveCount(learning)).toBe(0);
    expect(isLearningActive(learning)).toBe(false);
  });

  it('activates once enough decisive edits exist', () => {
    let learning = emptyPersonaLearning();
    for (let i = 0; i < MIN_DECISIVE_EXAMPLES; i++) {
      learning = applyOutcome(learning, photo(), 'promoted');
    }

    expect(isLearningActive(learning)).toBe(true);
  });

  it('counts promotions and rejections together toward the gate', () => {
    let learning = emptyPersonaLearning();
    for (let i = 0; i < 3; i++) learning = applyOutcome(learning, photo(), 'promoted');
    for (let i = 0; i < 2; i++) learning = applyOutcome(learning, photo(), 'rejected');

    expect(decisiveCount(learning)).toBe(MIN_DECISIVE_EXAMPLES);
    expect(isLearningActive(learning)).toBe(true);
  });

  it('stays inactive one edit short of the gate', () => {
    let learning = emptyPersonaLearning();
    for (let i = 0; i < MIN_DECISIVE_EXAMPLES - 1; i++) {
      learning = applyOutcome(learning, photo(), 'promoted');
    }

    expect(isLearningActive(learning)).toBe(false);
  });

  it('is inactive for a missing persona', () => {
    expect(isLearningActive(undefined)).toBe(false);
    expect(isLearningActive(null)).toBe(false);
  });
});

// ── Weighted averaging ───────────────────────────────────────────────────────

describe('updateStats', () => {
  it('takes the first sample as the average', () => {
    const s = updateStats({ count: 0, weight: 0, avg: { ...ZERO } }, { ...ZERO, sharpness: 0.8 }, 1);

    expect(s.avg.sharpness).toBeCloseTo(0.8, 10);
    expect(s.count).toBe(1);
    expect(s.weight).toBe(1);
  });

  it('averages equal-weight samples evenly', () => {
    let s = updateStats({ count: 0, weight: 0, avg: { ...ZERO } }, { ...ZERO, sharpness: 0.4 }, 1);
    s = updateStats(s, { ...ZERO, sharpness: 0.8 }, 1);

    expect(s.avg.sharpness).toBeCloseTo(0.6, 10);
  });

  it('lets a heavier sample pull the average further', () => {
    let light = updateStats({ count: 0, weight: 0, avg: { ...ZERO } }, { ...ZERO, sharpness: 0 }, 1);
    light = updateStats(light, { ...ZERO, sharpness: 1 }, 0.3);

    expect(light.avg.sharpness).toBeCloseTo(0.3 / 1.3, 10);
  });

  it('tracks count and weight separately', () => {
    let s = updateStats({ count: 0, weight: 0, avg: { ...ZERO } }, { ...ZERO }, 0.3);
    s = updateStats(s, { ...ZERO }, 0.3);

    expect(s.count).toBe(2);
    expect(s.weight).toBeCloseTo(0.6, 10);
  });

  it('ignores a non-positive weight rather than dividing by zero', () => {
    const start = { count: 0, weight: 0, avg: { ...ZERO } };

    expect(updateStats(start, { ...ZERO, sharpness: 1 }, 0)).toBe(start);
  });

  it('averages every dimension, not just the first', () => {
    let s = updateStats({ count: 0, weight: 0, avg: { ...ZERO } },
      { sharpness: 1, faceCount: 4, brightnessQuality: 1, contrast: 1, saturation: 1, complexity: 1 }, 1);
    s = updateStats(s, ZERO, 1);

    expect(s.avg).toEqual({
      sharpness: 0.5, faceCount: 2, brightnessQuality: 0.5,
      contrast: 0.5, saturation: 0.5, complexity: 0.5,
    });
  });
});

describe('mergeStats', () => {
  it('returns an empty result when both sides are empty', () => {
    const merged = mergeStats(
      { count: 0, weight: 0, avg: { ...ZERO } },
      { count: 0, weight: 0, avg: { ...ZERO } },
    );

    expect(merged.weight).toBe(0);
    expect(merged.count).toBe(0);
  });

  it('weights each side by its accumulated weight', () => {
    const a = { count: 1, weight: 3, avg: { ...ZERO, sharpness: 1 } };
    const b = { count: 1, weight: 1, avg: { ...ZERO, sharpness: 0 } };

    expect(mergeStats(a, b).avg.sharpness).toBeCloseTo(0.75, 10);
  });

  it('sums counts', () => {
    const a = { count: 4, weight: 1.2, avg: { ...ZERO } };
    const b = { count: 2, weight: 2, avg: { ...ZERO } };

    expect(mergeStats(a, b).count).toBe(6);
  });
});

describe('approvedStats', () => {
  it('combines kept and promoted', () => {
    let learning = applyOutcome(emptyPersonaLearning(), photo(), 'kept');
    learning = applyOutcome(learning, photo(), 'promoted');

    expect(approvedStats(learning).count).toBe(2);
    expect(approvedStats(learning).weight).toBeCloseTo(1.3, 10);
  });

  it('excludes rejections', () => {
    const learning = applyOutcome(emptyPersonaLearning(), photo(), 'rejected');

    expect(approvedStats(learning).count).toBe(0);
  });

  it('lets a promotion dominate a kept photo of equal count', () => {
    let learning = applyOutcome(emptyPersonaLearning(), photo({ sharpness: 0 }), 'kept');
    learning = applyOutcome(learning, photo({ sharpness: 1 }), 'promoted');

    // 1.0 weight against 0.3 — the promoted photo pulls the average past halfway.
    expect(approvedStats(learning).avg.sharpness).toBeGreaterThan(0.5);
  });
});

// ── Features ─────────────────────────────────────────────────────────────────

describe('hasRealFeatures (audit L4)', () => {
  it('accepts a fully scored photo', () => {
    expect(hasRealFeatures(photo())).toBe(true);
  });

  it('rejects a photo the sidecar never scored', () => {
    expect(hasRealFeatures(unscored())).toBe(false);
  });

  it.each(['sharpness', 'brightnessQuality', 'contrast', 'saturation', 'complexity'] as const)(
    'rejects a photo missing %s',
    (field) => {
      const p = photo();
      delete (p as Partial<LocalPhoto>)[field];
      expect(hasRealFeatures(p)).toBe(false);
    },
  );

  it('accepts a scored photo with no faces — zero is a measurement', () => {
    expect(hasRealFeatures(photo({ faceCount: 0 }))).toBe(true);
  });

  it('accepts a measured zero rather than treating it as missing', () => {
    expect(hasRealFeatures(photo({ sharpness: 0, contrast: 0 }))).toBe(true);
  });
});

describe('extractFeatures', () => {
  it('reads the measured values through, with no substitution', () => {
    expect(extractFeatures(photo({ sharpness: 0.11, complexity: 0.22 }))).toMatchObject({
      sharpness: 0.11, complexity: 0.22,
    });
  });

  it('defaults only faceCount, which is genuinely optional', () => {
    const p = photo();
    delete (p as Partial<LocalPhoto>).faceCount;

    expect(extractFeatures(p).faceCount).toBe(0);
  });
});

// ── applyOutcome ─────────────────────────────────────────────────────────────

describe('applyOutcome', () => {
  it('never records a photo without measurements (audit L4)', () => {
    const learning = applyOutcome(emptyPersonaLearning(), unscored(), 'promoted');

    expect(learning).toEqual(emptyPersonaLearning());
  });

  it('routes each outcome to its own bucket', () => {
    let l = applyOutcome(emptyPersonaLearning(), photo(), 'kept');
    l = applyOutcome(l, photo(), 'promoted');
    l = applyOutcome(l, photo(), 'rejected');

    expect([l.kept.count, l.promoted.count, l.rejected.count]).toEqual([1, 1, 1]);
  });

  it('adds group-size weight for approving outcomes', () => {
    const l = applyOutcome(emptyPersonaLearning(), photo({ faceCount: 1 }), 'promoted');

    expect(l.groupSize.solo).toBeCloseTo(1, 10);
    expect(l.groupSize.totalPromoted).toBeCloseTo(1, 10);
  });

  it('adds kept photos to group size at their lower weight', () => {
    const l = applyOutcome(emptyPersonaLearning(), photo({ faceCount: 0 }), 'kept');

    expect(l.groupSize.noFace).toBeCloseTo(0.3, 10);
  });

  it('never lets a rejection touch group size', () => {
    const l = applyOutcome(emptyPersonaLearning(), photo({ faceCount: 4 }), 'rejected');

    expect(l.groupSize.totalPromoted).toBe(0);
    expect(l.groupSize.group).toBe(0);
  });

  it('does not mutate the input', () => {
    const before = emptyPersonaLearning();
    const snapshot = JSON.stringify(before);

    applyOutcome(before, photo(), 'promoted');

    expect(JSON.stringify(before)).toBe(snapshot);
  });
});

describe('groupBucket', () => {
  it.each([
    [0, 'noFace'], [1, 'solo'], [2, 'small'], [3, 'small'], [4, 'group'], [12, 'group'],
  ])('maps a face count of %p to %s', (count, bucket) => {
    expect(groupBucket(count)).toBe(bucket);
  });
});

// ── Persistence ──────────────────────────────────────────────────────────────

describe('recordOutcomes', () => {
  it('writes a whole session in one pass', async () => {
    await recordOutcomes(
      [
        { photo: photo({ localUri: 'a' }), outcome: 'kept' },
        { photo: photo({ localUri: 'b' }), outcome: 'promoted' },
        { photo: photo({ localUri: 'c' }), outcome: 'rejected' },
      ],
      null,
    );

    const h = await loadLearningHistory();
    expect(h.default.kept.count).toBe(1);
    expect(h.default.promoted.count).toBe(1);
    expect(h.default.rejected.count).toBe(1);
  });

  it('accumulates across sessions', async () => {
    await recordOutcomes([{ photo: photo(), outcome: 'promoted' }], null);
    await recordOutcomes([{ photo: photo(), outcome: 'promoted' }], null);

    expect((await loadLearningHistory()).default.promoted.count).toBe(2);
  });

  it('keys by persona', async () => {
    await recordOutcomes([{ photo: photo(), outcome: 'promoted' }], 'social');

    const h = await loadLearningHistory();
    expect(h.social.promoted.count).toBe(1);
    expect(h.default).toBeUndefined();
  });

  it('writes nothing for an empty session', async () => {
    await recordOutcomes([], null);

    expect(await loadLearningHistory()).toEqual({});
  });

  it('never throws when the disk write fails', async () => {
    (FileSystem.writeAsStringAsync as jest.Mock).mockRejectedValueOnce(new Error('disk full'));

    await expect(
      recordOutcomes([{ photo: photo(), outcome: 'promoted' }], null),
    ).resolves.toBeUndefined();
  });

  it('skips unscored photos but still records the rest', async () => {
    await recordOutcomes(
      [
        { photo: unscored({ localUri: 'a' }), outcome: 'promoted' },
        { photo: photo({ localUri: 'b' }), outcome: 'promoted' },
      ],
      null,
    );

    expect((await loadLearningHistory()).default.promoted.count).toBe(1);
  });

  it('stores under the v3 filename', async () => {
    await recordOutcomes([{ photo: photo(), outcome: 'promoted' }], null);

    expect(fs.has(LEARNING_FILE)).toBe(true);
  });
});

describe('loadLearningHistory', () => {
  it('returns an empty history when nothing is stored', async () => {
    expect(await loadLearningHistory()).toEqual({});
  });

  it('returns an empty history for a corrupt file', async () => {
    fs.set(LEARNING_FILE, 'not json');

    expect(await loadLearningHistory()).toEqual({});
  });

  it('drops a v2-shaped record rather than averaging against it', async () => {
    // v2 stored promotedCount / promotedAvg / rejectedCount / rejectedAvg.
    fs.set(LEARNING_FILE, JSON.stringify({
      aesthete: { promotedCount: 9, promotedAvg: ZERO, rejectedCount: 2, rejectedAvg: ZERO,
                  groupSize: { noFace: 9, solo: 0, small: 0, group: 0, totalPromoted: 9 } },
    }));

    expect(await loadLearningHistory()).toEqual({});
  });

  it('keeps valid personas and drops malformed ones in the same file', async () => {
    const valid = applyOutcome(emptyPersonaLearning(), photo(), 'promoted');
    fs.set(LEARNING_FILE, JSON.stringify({ social: valid, broken: { nope: true } }));

    const h = await loadLearningHistory();
    expect(Object.keys(h)).toEqual(['social']);
  });

  it('replaces a non-finite stored feature with zero', async () => {
    const l = applyOutcome(emptyPersonaLearning(), photo(), 'promoted');
    const raw = JSON.parse(JSON.stringify(l)) as PersonaLearning;
    (raw.promoted.avg as Record<string, unknown>).sharpness = null;
    fs.set(LEARNING_FILE, JSON.stringify({ default: raw }));

    expect((await loadLearningHistory()).default.promoted.avg.sharpness).toBe(0);
  });

  it('round-trips a recorded history', async () => {
    await recordOutcomes([{ photo: photo({ sharpness: 0.42 }), outcome: 'promoted' }], null);

    expect((await loadLearningHistory()).default.promoted.avg.sharpness).toBeCloseTo(0.42, 10);
  });
});

describe('clearLearningHistory', () => {
  it('removes the stored history', async () => {
    await recordOutcomes([{ photo: photo(), outcome: 'promoted' }], null);

    await clearLearningHistory();

    expect(await loadLearningHistory()).toEqual({});
  });

  it('never throws when deletion fails', async () => {
    (FileSystem.deleteAsync as jest.Mock).mockRejectedValueOnce(new Error('locked'));

    await expect(clearLearningHistory()).resolves.toBeUndefined();
  });
});

// ── Insight copy ─────────────────────────────────────────────────────────────

describe('learningInsight', () => {
  function withDecisive(count: number, over: Partial<LocalPhoto> = {}): PersonaLearning {
    let l = emptyPersonaLearning();
    for (let i = 0; i < count; i++) l = applyOutcome(l, photo(over), 'promoted');
    return l;
  }

  it('says nothing before the gate opens', () => {
    expect(learningInsight(withDecisive(MIN_DECISIVE_EXAMPLES - 1))).toBeNull();
  });

  it('says nothing for a missing persona', () => {
    expect(learningInsight(undefined)).toBeNull();
    expect(learningInsight(null)).toBeNull();
  });

  it('names the dominant group once the gate opens', () => {
    expect(learningInsight(withDecisive(MIN_DECISIVE_EXAMPLES, { faceCount: 1 })))
      .toContain('solo shots');
  });

  it('reports a percentage', () => {
    expect(learningInsight(withDecisive(MIN_DECISIVE_EXAMPLES, { faceCount: 0 })))
      .toMatch(/\(100%\)/);
  });

  it('counts approvals, not just promotions, in the headline number', () => {
    let l = withDecisive(MIN_DECISIVE_EXAMPLES, { faceCount: 0 });
    l = applyOutcome(l, photo({ faceCount: 0 }), 'kept');

    expect(learningInsight(l)).toContain(`${MIN_DECISIVE_EXAMPLES + 1} past picks`);
  });

  it('says nothing when the gate is open but no approval was recorded', () => {
    let l = emptyPersonaLearning();
    for (let i = 0; i < MIN_DECISIVE_EXAMPLES; i++) l = applyOutcome(l, photo(), 'rejected');

    expect(learningInsight(l)).toBeNull();
  });

  it.each([
    [0, 'no-people shots'],
    [1, 'solo shots'],
    [2, 'small group shots'],
    [6, 'large group shots'],
  ])('describes a face count of %p as "%s"', (faceCount, label) => {
    expect(learningInsight(withDecisive(MIN_DECISIVE_EXAMPLES, { faceCount }))).toContain(label);
  });
});
