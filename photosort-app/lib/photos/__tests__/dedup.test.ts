import { deduplicateBursts } from '../dedup';
import type { LocalPhoto } from '../../store/state';

function photo(id: string, creationTime: number, quality = 0.5): LocalPhoto {
  return {
    id,
    localUri: `file://${id}.jpg`,
    creationTime,
    qualityScore: quality,
    fileSize: 1000,
    width: 1024,
    height: 768,
    isFavorite: false,
  };
}

describe('deduplicateBursts', () => {
  it('returns a single photo unchanged', () => {
    const p = photo('a', 1000);
    expect(deduplicateBursts([p])).toEqual([p]);
  });

  it('returns an empty array unchanged', () => {
    expect(deduplicateBursts([])).toEqual([]);
  });

  it('keeps both photos when gap > threshold', () => {
    const p1 = photo('a', 0);
    const p2 = photo('b', 5000); // 5s gap
    const result = deduplicateBursts([p1, p2], 3);
    expect(result).toHaveLength(2);
  });

  it('keeps only the higher-quality photo from a 2-photo burst', () => {
    const low  = photo('low',  0,    0.3);
    const high = photo('high', 2000, 0.9); // 2s — within 3s threshold
    const result = deduplicateBursts([low, high], 3);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('high');
  });

  it('keeps only the survivor from a 5-photo burst', () => {
    const photos = [
      photo('a', 0,    0.5),
      photo('b', 500,  0.8),
      photo('c', 1000, 0.3),
      photo('d', 1500, 0.7),
      photo('e', 2000, 0.6),
    ];
    const result = deduplicateBursts(photos, 3);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('b');
  });

  it('splits correctly when there is a gap mid-burst', () => {
    // 3 photos in burst A, gap, 2 photos in burst B
    const photos = [
      photo('a1', 0,     0.5),
      photo('a2', 1000,  0.9), // best in burst A
      photo('a3', 2000,  0.4),
      photo('b1', 10000, 0.6), // gap > 3s → new burst
      photo('b2', 11000, 0.8), // best in burst B
    ];
    const result = deduplicateBursts(photos, 3);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('a2');
    expect(result[1].id).toBe('b2');
  });
});
