import {
  BYTES_CEIL,
  BYTES_FLOOR,
  FAVORITE_MULTIPLIER,
  UNSCORED_CONFIDENCE,
  blendVisionScore,
  clamp01,
  computeByteQuality,
  discountUnscored,
  normaliseByteProxy,
} from '../quality';

describe('clamp01', () => {
  it.each([
    ['below range', -1, 0],
    ['at zero', 0, 0],
    ['mid range', 0.42, 0.42],
    ['at one', 1, 1],
    ['above range', 5, 1],
  ])('maps %s', (_label, input, expected) => {
    expect(clamp01(input)).toBe(expected);
  });

  it.each([NaN, Infinity, -Infinity])('maps the non-finite value %p to 0', (v) => {
    expect(clamp01(v)).toBe(0);
  });
});

describe('normaliseByteProxy', () => {
  it('maps the floor to 0 and the ceiling to 1', () => {
    expect(normaliseByteProxy(BYTES_FLOOR)).toBeCloseTo(0, 10);
    expect(normaliseByteProxy(BYTES_CEIL)).toBeCloseTo(1, 10);
  });

  it('saturates outside the range rather than exceeding [0, 1]', () => {
    expect(normaliseByteProxy(BYTES_FLOOR / 100)).toBe(0);
    expect(normaliseByteProxy(BYTES_CEIL * 100)).toBe(1);
  });

  it.each([0, -1, NaN, Infinity])('maps the unusable input %p to 0', (v) => {
    expect(normaliseByteProxy(v)).toBe(0);
  });

  it('is strictly monotonic, so ranking order is preserved', () => {
    const sizes = [250_000, 500_000, 1_000_000, 2_000_000, 4_000_000, 7_000_000];
    const scores = sizes.map(normaliseByteProxy);
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeGreaterThan(scores[i - 1]);
    }
  });

  it('keeps every output within [0, 1] across four orders of magnitude', () => {
    for (let bytes = 1_000; bytes <= 100_000_000; bytes *= 2) {
      const score = normaliseByteProxy(bytes);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    }
  });

  it('spreads mid-range sizes away from the extremes, unlike a linear map', () => {
    // 1.26 MB is the geometric mean of floor and ceiling, so it lands mid-scale.
    const geometricMean = Math.sqrt(BYTES_FLOOR * BYTES_CEIL);
    expect(normaliseByteProxy(geometricMean)).toBeCloseTo(0.5, 6);
  });
});

describe('computeByteQuality', () => {
  const RESOLUTION = 4032 * 3024; // 12 MP

  it('reduces to file size when bytes-per-pixel is under the clamp', () => {
    const { rawByteScore } = computeByteQuality(RESOLUTION, 2_500_000, false);
    expect(rawByteScore).toBeCloseTo(2_500_000, 5);
  });

  it('clamps pathological bytes-per-pixel so encoding cannot dominate', () => {
    const absurd = RESOLUTION * 50; // 50 bytes per pixel
    const { rawByteScore } = computeByteQuality(RESOLUTION, absurd, false);
    expect(rawByteScore).toBe(RESOLUTION * 4);
  });

  it('falls back to one byte per pixel when the file size is unknown', () => {
    const { rawByteScore } = computeByteQuality(RESOLUTION, undefined, false);
    expect(rawByteScore).toBe(RESOLUTION);
  });

  it('treats a zero file size as unknown rather than as zero quality', () => {
    const { rawByteScore } = computeByteQuality(RESOLUTION, 0, false);
    expect(rawByteScore).toBe(RESOLUTION);
  });

  it(`multiplies the raw proxy by ${FAVORITE_MULTIPLIER} for favourites`, () => {
    const plain = computeByteQuality(RESOLUTION, 2_000_000, false);
    const fav = computeByteQuality(RESOLUTION, 2_000_000, true);
    expect(fav.rawByteScore).toBe(plain.rawByteScore * FAVORITE_MULTIPLIER);
    expect(fav.qualityScore).toBeGreaterThan(plain.qualityScore);
  });

  it.each([
    ['zero', 0],
    ['negative', -100],
    ['NaN', NaN],
    ['Infinity', Infinity],
  ])('returns zero for a %s resolution instead of propagating NaN', (_label, resolution) => {
    const result = computeByteQuality(resolution, 2_000_000, false);
    expect(result).toEqual({ qualityScore: 0, rawByteScore: 0 });
  });

  it('always produces a normalised score within [0, 1]', () => {
    const cases: Array<[number, number | undefined, boolean]> = [
      [RESOLUTION, 500_000, false],
      [RESOLUTION, 9_000_000, true],
      [1179 * 2556, 3_000_000, false], // screenshot
      [640 * 480, 40_000, false],      // tiny thumbnail
      [8000 * 6000, 80_000_000, true], // huge raw-ish file
    ];
    for (const [res, size, fav] of cases) {
      const { qualityScore } = computeByteQuality(res, size, fav);
      expect(qualityScore).toBeGreaterThanOrEqual(0);
      expect(qualityScore).toBeLessThanOrEqual(1);
    }
  });

  it('preserves the pre-fix ranking order (regression guard for audit L7)', () => {
    // The old score was `resolution * bpp * (fav ? 2 : 1)`. Normalisation is
    // monotonic, so sorting by the new score must match sorting by the old.
    const inputs: Array<{ res: number; size: number; fav: boolean }> = [
      { res: 4032 * 3024, size: 2_500_000, fav: false },
      { res: 4032 * 3024, size: 5_000_000, fav: false },
      { res: 1179 * 2556, size: 3_000_000, fav: false },
      { res: 4032 * 3024, size: 1_200_000, fav: true },
      { res: 1920 * 1080, size: 800_000, fav: false },
    ];
    const byOld = [...inputs].sort(
      (a, b) =>
        b.res * Math.min(b.size / b.res, 4) * (b.fav ? 2 : 1) -
        a.res * Math.min(a.size / a.res, 4) * (a.fav ? 2 : 1),
    );
    const byNew = [...inputs].sort(
      (a, b) =>
        computeByteQuality(b.res, b.size, b.fav).qualityScore -
        computeByteQuality(a.res, a.size, a.fav).qualityScore,
    );
    expect(byNew).toEqual(byOld);
  });
});

describe('blendVisionScore', () => {
  it('gives the vision score 80% of the weight and keeps a 20% proxy floor', () => {
    expect(blendVisionScore(1, 0)).toBeCloseTo(0.2, 10);
    expect(blendVisionScore(1, 1)).toBeCloseTo(1, 10);
    expect(blendVisionScore(1, 0.5)).toBeCloseTo(0.6, 10);
  });

  it('scales with the byte proxy so an original beats a thumbnail of the same scene', () => {
    expect(blendVisionScore(0.8, 0.7)).toBeGreaterThan(blendVisionScore(0.4, 0.7));
  });

  it('never leaves [0, 1] even for out-of-range inputs', () => {
    for (const q of [-5, 0, 0.5, 1, 99, NaN]) {
      for (const v of [-5, 0, 0.5, 1, 99, NaN]) {
        const out = blendVisionScore(q, v);
        expect(out).toBeGreaterThanOrEqual(0);
        expect(out).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('discountUnscored', () => {
  it(`applies the ${UNSCORED_CONFIDENCE} confidence factor`, () => {
    expect(discountUnscored(1)).toBe(UNSCORED_CONFIDENCE);
    expect(discountUnscored(0.5)).toBe(0.5 * UNSCORED_CONFIDENCE);
    expect(discountUnscored(0)).toBe(0);
  });

  it('ranks a measured photo above an unmeasured one of equal size (audit L7)', () => {
    const size = 0.9;
    // Even a mediocre vision score must beat the same photo left unmeasured.
    expect(blendVisionScore(size, 0.5)).toBeGreaterThan(discountUnscored(size));
  });

  it('clamps out-of-range input', () => {
    expect(discountUnscored(99)).toBe(UNSCORED_CONFIDENCE);
    expect(discountUnscored(NaN)).toBe(0);
  });
});
