import { selectBestPhotos, topCandidates } from '../selection';
import type { LocalPhoto } from '../../store/state';

const MIN = 60 * 1000;

function photo(
  id: string,
  creationTime: number,
  quality = 0.5,
  lat?: number,
  lon?: number,
): LocalPhoto {
  return {
    id,
    localUri: `file://${id}.jpg`,
    creationTime,
    qualityScore: quality,
    fileSize: 1000,
    width: 1024,
    height: 768,
    isFavorite: false,
    lat,
    lon,
  };
}

describe('selectBestPhotos', () => {
  it('returns empty when given no photos', () => {
    const { selected, runnerUps } = selectBestPhotos([], 10);
    expect(selected).toHaveLength(0);
    expect(runnerUps).toHaveLength(0);
  });

  it('returns all photos when count ≤ maxCount', () => {
    const photos = [photo('a', 0), photo('b', MIN), photo('c', 2 * MIN)];
    const { selected, runnerUps } = selectBestPhotos(photos, 10);
    expect(selected).toHaveLength(3);
    expect(runnerUps).toHaveLength(0);
  });

  it('never returns more than maxCount photos', () => {
    const photos = Array.from({ length: 50 }, (_, i) => photo(`p${i}`, i * MIN, Math.random()));
    const { selected } = selectBestPhotos(photos, 10);
    expect(selected.length).toBeLessThanOrEqual(10);
  });

  it('selected photos are sorted chronologically', () => {
    const photos = Array.from({ length: 20 }, (_, i) => photo(`p${i}`, i * MIN * 2));
    const { selected } = selectBestPhotos(photos, 10);
    for (let i = 1; i < selected.length; i++) {
      expect(selected[i].creationTime).toBeGreaterThanOrEqual(selected[i - 1].creationTime);
    }
  });

  it('provides spread across the time range (time-window enforcement)', () => {
    // 25 photos spanning 10 hours, but all clustered in first 2 hours unless we enforce spread
    const earlyPhotos = Array.from({ length: 20 }, (_, i) =>
      photo(`early${i}`, i * 5 * MIN, 0.9), // high quality → would dominate without spread
    );
    const latePhotos = Array.from({ length: 5 }, (_, i) =>
      photo(`late${i}`, (8 * 60 + i * 10) * MIN, 0.1), // low quality, but only ones in late range
    );

    const { selected } = selectBestPhotos([...earlyPhotos, ...latePhotos], 10);

    // At least one photo from the late range must be included due to time-spread enforcement
    const hasLateCoverage = selected.some((p) => p.creationTime >= 8 * 60 * MIN);
    expect(hasLateCoverage).toBe(true);
  });

  it('runner-ups are not in the selected set', () => {
    const photos = Array.from({ length: 30 }, (_, i) => photo(`p${i}`, i * MIN, Math.random()));
    const { selected, runnerUps } = selectBestPhotos(photos, 10);
    const selectedIds = new Set(selected.map((p) => p.id));
    for (const ru of runnerUps) {
      expect(selectedIds.has(ru.id)).toBe(false);
    }
  });
});

describe('topCandidates', () => {
  it('returns empty when given no photos', () => {
    expect(topCandidates([], 30)).toHaveLength(0);
  });

  it('returns all photos when count ≤ requested', () => {
    const photos = [photo('a', 0), photo('b', MIN)];
    expect(topCandidates(photos, 30)).toHaveLength(2);
  });

  it('never returns more than count photos', () => {
    const photos = Array.from({ length: 100 }, (_, i) => photo(`p${i}`, i * MIN, Math.random()));
    const candidates = topCandidates(photos, 30);
    expect(candidates.length).toBeLessThanOrEqual(30);
  });
});
