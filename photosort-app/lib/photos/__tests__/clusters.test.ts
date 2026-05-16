import { buildActivityClusters } from '../clusters';
import type { LocalPhoto } from '../../store/state';

function photo(
  id: string,
  creationTime: number,
  lat?: number,
  lon?: number,
  quality = 0.5,
): LocalPhoto {
  return {
    id,
    uri: `ph://${id}`,
    localUri: `file://${id}.jpg`,
    filename: `${id}.jpg`,
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

const MIN = 60 * 1000;

describe('buildActivityClusters', () => {
  it('returns an empty array for no photos', () => {
    expect(buildActivityClusters([])).toEqual([]);
  });

  it('returns a single cluster for a single photo', () => {
    const clusters = buildActivityClusters([photo('a', 0)]);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].photos).toHaveLength(1);
  });

  it('groups photos at the same GPS location into one cluster', () => {
    const photos = [
      photo('a', 0,          48.8584, 2.2945),
      photo('b', 5 * MIN,    48.8584, 2.2945),
      photo('c', 10 * MIN,   48.8584, 2.2945),
    ];
    const clusters = buildActivityClusters(photos, 30);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].photos).toHaveLength(3);
  });

  it('splits on a 45-minute time gap', () => {
    const photos = [
      photo('a', 0),
      photo('b', 45 * MIN + 1000), // just over 45 min
    ];
    const clusters = buildActivityClusters(photos, 30);
    expect(clusters).toHaveLength(2);
  });

  it('does NOT split on a 20-minute gap (below threshold)', () => {
    const photos = [
      photo('a', 0),
      photo('b', 20 * MIN),
    ];
    const clusters = buildActivityClusters(photos, 30);
    expect(clusters).toHaveLength(1);
  });

  it('splits on a 1.5km GPS distance', () => {
    // Paris Eiffel Tower vs Notre Dame — ~3.3km apart
    const photos = [
      photo('eiffel',  0,         48.8584,  2.2945),
      photo('notredm', 5 * MIN,   48.8530,  2.3499),
    ];
    const clusters = buildActivityClusters(photos, 30, 1.5);
    expect(clusters).toHaveLength(2);
  });

  it('does NOT split when GPS distance is below threshold', () => {
    // Two points ~100m apart
    const photos = [
      photo('a', 0,       48.8584, 2.2945),
      photo('b', 5 * MIN, 48.8585, 2.2946), // ~14m
    ];
    const clusters = buildActivityClusters(photos, 30, 1.5);
    expect(clusters).toHaveLength(1);
  });

  it('bestPhoto in each cluster is the highest-quality one', () => {
    const photos = [
      photo('low',  0,       undefined, undefined, 0.3),
      photo('high', 5 * MIN, undefined, undefined, 0.9),
      photo('mid',  10 * MIN, undefined, undefined, 0.6),
    ];
    const clusters = buildActivityClusters(photos, 30);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].bestPhoto.id).toBe('high');
    expect(clusters[0].bestQuality).toBe(0.9);
  });

  it('computes cluster centerLat/centerLon from photos with GPS', () => {
    // Use points ~14m apart so they don't trigger the location gap split
    const photos = [
      photo('a', 0,       48.8584, 2.2945),
      photo('b', 5 * MIN, 48.8585, 2.2946),
    ];
    const clusters = buildActivityClusters(photos, 30, 1.5);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].centerLat).toBeCloseTo((48.8584 + 48.8585) / 2, 4);
    expect(clusters[0].centerLon).toBeCloseTo((2.2945 + 2.2946) / 2, 4);
  });

  it('omits centerLat/centerLon when no photos have GPS', () => {
    const photos = [photo('a', 0), photo('b', 5 * MIN)];
    const clusters = buildActivityClusters(photos, 30);
    expect(clusters[0].centerLat).toBeUndefined();
    expect(clusters[0].centerLon).toBeUndefined();
  });
});
