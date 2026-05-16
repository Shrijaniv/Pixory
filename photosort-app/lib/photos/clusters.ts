/**
 * Activity clustering — groups photos into distinct scenes/moments
 * based on time gaps and GPS distance between consecutive photos.
 */
import { LocalPhoto } from '../store/state';
import { haversineKm } from './haversine';

export interface ActivityCluster {
  photos: LocalPhoto[];
  bestPhoto: LocalPhoto;
  bestQuality: number;
  centerLat?: number;
  centerLon?: number;
  startTime: number;
  endTime: number;
}

/**
 * Group photos into location+time clusters.
 *
 * A new cluster starts when EITHER:
 *   - Time gap between consecutive photos > gapMinutes (default 30 min), OR
 *   - GPS distance between consecutive photos > locationGapKm (default 1.5 km)
 */
export function buildActivityClusters(
  sortedPhotos: LocalPhoto[],
  gapMinutes = 30,
  locationGapKm = 1.5,
): ActivityCluster[] {
  if (sortedPhotos.length === 0) return [];

  const clusters: ActivityCluster[] = [];
  let current: LocalPhoto[] = [sortedPhotos[0]];
  const gapMs = gapMinutes * 60 * 1000;

  for (let i = 1; i < sortedPhotos.length; i++) {
    const prev = sortedPhotos[i - 1];
    const curr = sortedPhotos[i];

    const timeGap = curr.creationTime - prev.creationTime > gapMs;

    let locationGap = false;
    if (
      Number.isFinite(prev.lat) && Number.isFinite(prev.lon) &&
      Number.isFinite(curr.lat) && Number.isFinite(curr.lon)
    ) {
      locationGap = haversineKm(prev.lat!, prev.lon!, curr.lat!, curr.lon!) > locationGapKm;
    }

    if (timeGap || locationGap) {
      clusters.push(toCluster(current));
      current = [curr];
    } else {
      current.push(curr);
    }
  }
  clusters.push(toCluster(current));
  return clusters;
}

function toCluster(photos: LocalPhoto[]): ActivityCluster {
  const bestPhoto = photos.reduce((a, b) => (a.qualityScore >= b.qualityScore ? a : b));
  const withCoords = photos.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon));
  const centerLat = withCoords.length
    ? withCoords.reduce((s, p) => s + p.lat!, 0) / withCoords.length
    : undefined;
  const centerLon = withCoords.length
    ? withCoords.reduce((s, p) => s + p.lon!, 0) / withCoords.length
    : undefined;
  return {
    photos,
    bestPhoto,
    bestQuality: bestPhoto.qualityScore,
    centerLat,
    centerLon,
    startTime: photos[0].creationTime,
    endTime:   photos[photos.length - 1].creationTime,
  };
}

/** Human-readable summary of clusters — useful for debug logging. */
export function clusterSummary(photos: LocalPhoto[]): string {
  const sorted = [...photos].sort((a, b) => a.creationTime - b.creationTime);
  const clusters = buildActivityClusters(sorted);
  return clusters.map((c, i) => {
    const start = new Date(c.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const end   = new Date(c.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const loc   = c.centerLat != null
      ? `${c.centerLat.toFixed(3)},${c.centerLon!.toFixed(3)}`
      : 'no GPS';
    return `  Cluster ${i + 1}: ${c.photos.length} photos, ${start}–${end}, GPS: ${loc}`;
  }).join('\n');
}
