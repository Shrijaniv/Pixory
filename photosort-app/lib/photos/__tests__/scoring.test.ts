import { computePersonaScore } from '../scoring';
import type { BackendPhotoScore } from '../scoring';

/** Standard archetypal photo scores used across persona tests. */
const ARCHETYPES: Record<string, BackendPhotoScore> = {
  perfectLandscape: {
    index: 0, sharpness: 0.95, face_count: 0, happy_face_count: 0,
    brightness: 0.5, brightness_quality: 0.90, contrast: 0.75,
    saturation: 0.60, complexity: 0.20,
  },
  blurryGroupLaugh: {
    index: 1, sharpness: 0.15, face_count: 5, happy_face_count: 5,
    brightness: 0.5, brightness_quality: 0.65, contrast: 0.40,
    saturation: 0.50, complexity: 0.70,
  },
  sharpPortrait: {
    index: 2, sharpness: 0.85, face_count: 1, happy_face_count: 1,
    brightness: 0.5, brightness_quality: 0.80, contrast: 0.70,
    saturation: 0.45, complexity: 0.30,
  },
  blurryBoatMoment: {
    index: 3, sharpness: 0.10, face_count: 2, happy_face_count: 1,
    brightness: 0.4, brightness_quality: 0.40, contrast: 0.30,
    saturation: 0.35, complexity: 0.60,
  },
  minimalClean: {
    index: 4, sharpness: 0.90, face_count: 0, happy_face_count: 0,
    brightness: 0.5, brightness_quality: 0.85, contrast: 0.60,
    saturation: 0.20, complexity: 0.05,
  },
  busyMarket: {
    index: 5, sharpness: 0.70, face_count: 3, happy_face_count: 2,
    brightness: 0.5, brightness_quality: 0.55, contrast: 0.65,
    saturation: 0.75, complexity: 0.90,
  },
};

function score(name: keyof typeof ARCHETYPES, persona: Parameters<typeof computePersonaScore>[1]) {
  return computePersonaScore(ARCHETYPES[name], persona);
}

describe('computePersonaScore — aesthete', () => {
  it('ranks perfectLandscape above blurryGroupLaugh', () => {
    expect(score('perfectLandscape', 'aesthete')).toBeGreaterThan(score('blurryGroupLaugh', 'aesthete'));
  });
  it('ranks minimalClean above busyMarket', () => {
    expect(score('minimalClean', 'aesthete')).toBeGreaterThan(score('busyMarket', 'aesthete'));
  });
});

describe('computePersonaScore — social', () => {
  it('ranks blurryGroupLaugh above perfectLandscape', () => {
    expect(score('blurryGroupLaugh', 'social')).toBeGreaterThan(score('perfectLandscape', 'social'));
  });
  it('ranks sharpPortrait above minimalClean', () => {
    expect(score('sharpPortrait', 'social')).toBeGreaterThan(score('minimalClean', 'social'));
  });
});

describe('computePersonaScore — logger', () => {
  it('scores blurryBoatMoment higher than null persona does', () => {
    // Logger has a 0.35 base — rough photos not penalised as heavily
    expect(score('blurryBoatMoment', 'logger')).toBeGreaterThan(score('blurryBoatMoment', null));
  });
  it('all scores are between 0 and 1', () => {
    for (const name of Object.keys(ARCHETYPES) as Array<keyof typeof ARCHETYPES>) {
      const s = score(name, 'logger');
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(1);
    }
  });
});

describe('computePersonaScore — minimalist', () => {
  it('ranks minimalClean above busyMarket', () => {
    expect(score('minimalClean', 'minimalist')).toBeGreaterThan(score('busyMarket', 'minimalist'));
  });
  it('ranks perfectLandscape above blurryGroupLaugh', () => {
    expect(score('perfectLandscape', 'minimalist')).toBeGreaterThan(score('blurryGroupLaugh', 'minimalist'));
  });
  it('blurryBoatMoment gets lowest score among archetypes', () => {
    const boatScore = score('blurryBoatMoment', 'minimalist');
    for (const name of (['perfectLandscape', 'sharpPortrait', 'minimalClean'] as const)) {
      expect(boatScore).toBeLessThan(score(name, 'minimalist'));
    }
  });
});

describe('computePersonaScore — null (default)', () => {
  it('returns a value between 0 and 1 for all archetypes', () => {
    for (const name of Object.keys(ARCHETYPES) as Array<keyof typeof ARCHETYPES>) {
      const s = score(name, null);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(1);
    }
  });
  it('rewards sharpness: perfectLandscape beats blurryGroupLaugh', () => {
    expect(score('perfectLandscape', null)).toBeGreaterThan(score('blurryGroupLaugh', null));
  });
});
