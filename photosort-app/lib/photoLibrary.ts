import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import * as MediaLibrary from 'expo-media-library';
import { ContentMix, LocalPhoto, PersonaType } from './store';

// Native module — only available in dev builds, not Expo Go.
// Graceful fallback: if unavailable, location comes from getAssetInfoAsync instead.
let nativeGetAssetLocations: ((ids: string[]) => Promise<Array<{ id: string; latitude: number; longitude: number }>>) | null = null;
try {
  const mod = require('../modules/vision-scorer');
  nativeGetAssetLocations = mod.getAssetLocations;
} catch {
  // Expo Go or native module not linked — will fall back to getAssetInfoAsync location
}

// ── Per-persona photo scoring ─────────────────────────────────────────────────
//
// Each persona has a fundamentally different definition of a "good photo."
// The formula uses all signals returned by the OpenCV/DeepFace sidecar.
//
interface BackendPhotoScore {
  index: number;
  sharpness: number;
  face_count: number;
  happy_face_count: number;
  brightness: number;
  brightness_quality: number;
  contrast: number;
  saturation: number;
  complexity: number;
}

function computePersonaScore(score: BackendPhotoScore, persona: PersonaType | null): number {
  const s   = score.sharpness;
  const bq  = score.brightness_quality ?? 0.5;
  const ct  = score.contrast ?? 0.5;
  const sat = score.saturation ?? 0.3;
  const cpx = score.complexity ?? 0.3;
  const happy   = score.happy_face_count ?? 0;
  const neutral = Math.max(0, score.face_count - happy);
  const effectiveFaces = happy * 1.5 + neutral * 0.5;

  switch (persona) {
    case 'aesthete':
      // Palette and technical perfection. Clean compositions. Faces nearly irrelevant.
      return (
        s   * 0.40 +
        bq  * 0.20 +
        ct  * 0.15 +
        sat * 0.10 +
        (1 - cpx) * 0.10 +          // simplicity bonus
        Math.min(effectiveFaces * 0.01, 0.05)
      );

    case 'social':
      // Faces above all. Multiple happy faces in one shot = jackpot.
      return (
        Math.min(effectiveFaces * 0.22, 0.55) +
        s  * 0.20 +
        bq * 0.15 +
        ct * 0.10
      );

    case 'logger':
      // Authenticity over perfection. Rough exposures accepted.
      // A generous 0.35 base ensures imperfect photos aren't buried.
      return (
        s                              * 0.15 +
        Math.min(effectiveFaces * 0.10, 0.20) +
        bq                             * 0.10 +
        ct                             * 0.05 +
        0.35   // generous base — rough edges are fine
      );

    case 'storyteller':
      // Sharpness matters for readability. Visual diversity bonus applied separately
      // in topCandidates() at the set level. Complexity neutral (varied shots welcome).
      return (
        s  * 0.30 +
        bq * 0.15 +
        ct * 0.15 +
        Math.min(effectiveFaces * 0.08, 0.15) +
        0.15
      );

    case 'minimalist':
      // Only the exceptional. Complexity is a heavy penalty. Sharpness is critical.
      return (
        s          * 0.50 +
        bq         * 0.20 +
        ct         * 0.15 +
        (1 - cpx)  * 0.10 +
        Math.min(effectiveFaces * 0.02, 0.05)
      );

    default:
      // null / no persona — original balanced formula
      return s * 0.35 + Math.min(effectiveFaces * 0.08, 0.15) + 0.25;
  }
}

export async function requestPermission(): Promise<{ granted: boolean; limited: boolean }> {
  const result = await MediaLibrary.requestPermissionsAsync();
  const granted = result.status === 'granted';
  // On iOS 14+ the user may grant "Selected Photos" (limited) rather than full access.
  // In limited mode, PHAsset.location is nil for ALL assets — GPS filtering won't work.
  const limited = (result as any).accessPrivileges === 'limited';
  return { granted, limited };
}

/** Fetch photos from the device library filtered by date range. */
export async function getPhotos(options: {
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
  onProgress?: (msg: string) => void;
}): Promise<LocalPhoto[]> {
  const { dateFrom, dateTo, limit = 500, onProgress } = options;

  onProgress?.('Reading photo library...');

  let allAssets: MediaLibrary.Asset[] = [];
  let cursor: string | undefined;

  // Page through until we hit the limit or run out
  do {
    const page = await MediaLibrary.getAssetsAsync({
      mediaType: MediaLibrary.MediaType.photo,
      createdAfter: dateFrom?.getTime(),
      createdBefore: dateTo?.getTime(),
      first: Math.min(limit - allAssets.length, 100),
      after: cursor,
      sortBy: [MediaLibrary.SortBy.creationTime],
    });
    allAssets = [...allAssets, ...page.assets];
    cursor = page.hasNextPage ? page.endCursor : undefined;
  } while (cursor && allAssets.length < limit);

  onProgress?.(`Found ${allAssets.length} photos — reading metadata...`);

  // ── Batch-fetch GPS via PHAsset.location (native module, dev builds only) ──
  // Falls back to getAssetInfoAsync location field if the native module isn't linked.
  let nativeLocationMap = new Map<string, { lat: number; lon: number }>();
  if (nativeGetAssetLocations) {
    try {
      const assetIds = allAssets.map((a) => a.id);
      const locs = await nativeGetAssetLocations(assetIds);
      for (const loc of locs) {
        nativeLocationMap.set(loc.id, { lat: loc.latitude, lon: loc.longitude });
      }
      onProgress?.(`GPS: ${nativeLocationMap.size} of ${allAssets.length} photos have coordinates (via PHAsset)`);
    } catch {
      // fall through to per-asset info.location below
    }
  }

  // Resolve localUri + file size + isFavorite for each asset
  const photos: LocalPhoto[] = [];
  for (let i = 0; i < allAssets.length; i++) {
    const asset = allAssets[i];
    if (i % 20 === 0) {
      onProgress?.(`Loading metadata ${i + 1}/${allAssets.length}...`);
    }
    try {
      const info = await MediaLibrary.getAssetInfoAsync(asset.id, {
        shouldDownloadFromNetwork: false,
      });
      if (!info.localUri) continue; // not locally available (iCloud only)


      // File size on disk is a reliable sharpness proxy:
      // blurry/compressed images have fewer unique blocks → smaller JPEG → lower bytes-per-pixel
      let fileSize: number | undefined;
      try {
        const stat = await FileSystem.getInfoAsync(info.localUri);
        if (stat.exists) fileSize = (stat as any).size as number;
      } catch {
        // size unavailable — fall back to resolution-only scoring
      }

      const resolution = asset.width * asset.height;
      // bytes-per-pixel capped at 4 to prevent raw/ProRAW files from dominating
      const bpp = fileSize ? Math.min(fileSize / resolution, 4) : 1;
      let qualityScore = resolution * bpp;

      // Favorites get a strong boost — the user already told us they love this photo.
      // isFavorite lives on AssetInfo (getAssetInfoAsync result), not on the basic Asset.
      const isFavorite = (info as any).isFavorite === true;
      if (isFavorite) qualityScore *= 2.0;

      // Prefer native PHAsset.location (more reliable); fall back to getAssetInfoAsync field.
      // Note: expo-media-library returns latitude/longitude as strings on some iOS versions —
      // always parse to float before the isFinite check.
      const nativeLoc = nativeLocationMap.get(asset.id);
      const rawLat = parseFloat(info.location?.latitude as any);
      const rawLon = parseFloat(info.location?.longitude as any);
      const lat = nativeLoc?.lat ?? (Number.isFinite(rawLat) ? rawLat : undefined);
      const lon = nativeLoc?.lon ?? (Number.isFinite(rawLon) ? rawLon : undefined);

      photos.push({
        id: asset.id,
        uri: asset.uri,
        localUri: info.localUri,
        filename: asset.filename,
        creationTime: asset.creationTime,
        lat,
        lon,
        width: asset.width,
        height: asset.height,
        fileSize,
        qualityScore,
        isFavorite,
      });
    } catch {
      // skip unavailable assets
    }
  }

  const withGps = photos.filter((p) => p.lat != null && p.lon != null).length;
  if (withGps === 0 && photos.length > 0) {
    onProgress?.(`⚠ 0 of ${photos.length} photos have GPS data — location filter will be skipped`);
  } else if (withGps > 0 && !nativeGetAssetLocations) {
    // Only log again if native module wasn't used (otherwise already logged above)
    onProgress?.(`${withGps} of ${photos.length} photos have GPS coordinates`);
  }

  return photos;
}

/** Filter photos within radiusKm of a lat/lon point. */
export function filterByLocation(
  photos: LocalPhoto[],
  lat: number,
  lon: number,
  radiusKm: number,
): LocalPhoto[] {
  return photos.filter((p) => {
    if (!Number.isFinite(p.lat) || !Number.isFinite(p.lon)) return false;
    return haversineKm(p.lat!, p.lon!, lat, lon) <= radiusKm;
  });
}

/**
 * Remove burst duplicates: photos taken within `thresholdSec` of each other
 * are treated as a burst — only the highest-quality one is kept.
 */
export function deduplicateBursts(photos: LocalPhoto[], thresholdSec = 3): LocalPhoto[] {
  if (photos.length === 0) return photos;

  const sorted = [...photos].sort((a, b) => a.creationTime - b.creationTime);
  const groups: LocalPhoto[][] = [];
  let current: LocalPhoto[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const gapSec = (sorted[i].creationTime - sorted[i - 1].creationTime) / 1000;
    if (gapSec <= thresholdSec) {
      current.push(sorted[i]);
    } else {
      groups.push(current);
      current = [sorted[i]];
    }
  }
  groups.push(current);

  // Keep the best photo from each burst group
  return groups.map((group) =>
    group.reduce((best, p) => (p.qualityScore > best.qualityScore ? p : best))
  );
}

/** One distinct scene/moment — a group of photos from the same location & time. */
interface ActivityCluster {
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
 *
 * Using both signals means a drive between locations always starts a new cluster
 * even if the drive took less than 30 minutes — exactly what the user expects.
 */
function buildActivityClusters(
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

    // Location gap: only check when both photos have valid GPS coords
    let locationGap = false;
    if (
      Number.isFinite(prev.lat) && Number.isFinite(prev.lon) &&
      Number.isFinite(curr.lat) && Number.isFinite(curr.lon)
    ) {
      const dist = haversineKm(prev.lat!, prev.lon!, curr.lat!, curr.lon!);
      locationGap = dist > locationGapKm;
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

  // Compute centre GPS of the cluster (mean of available coords)
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
    endTime: photos[photos.length - 1].creationTime,
  };
}

/** Return a human-readable summary of clusters for debug logging. */
export function clusterSummary(photos: LocalPhoto[]): string {
  const sorted = [...photos].sort((a, b) => a.creationTime - b.creationTime);
  const clusters = buildActivityClusters(sorted);
  return clusters.map((c, i) => {
    const start = new Date(c.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const end   = new Date(c.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const loc   = c.centerLat != null ? `${c.centerLat.toFixed(3)},${c.centerLon!.toFixed(3)}` : 'no GPS';
    return `  Cluster ${i + 1}: ${c.photos.length} photos, ${start}–${end}, GPS: ${loc}`;
  }).join('\n');
}

/**
 * Select top `count` candidates for AI curation.
 *
 * Problem with pure quality ranking: morning/evening golden-hour photos always
 * outscore midday photos, so entire locations get dropped before the AI ever
 * sees them.
 *
 * Algorithm:
 *   1. Build activity clusters (45-min gap = new activity)
 *   2. Divide the full time range into TIME_WINDOWS equal windows
 *   3. Give each window a guaranteed slot budget (minPerWindow), so every
 *      part of the day is represented in the candidate set
 *   4. Fill each window's budget with its best clusters by quality score
 *   5. Remaining slots (after guaranteed budgets) go to best clusters overall
 *   6. Within chosen clusters, fill extra slots round-robin by quality
 *   7. Return chronologically sorted so the AI sees the story in order
 */
export function topCandidates(
  photos: LocalPhoto[],
  count = 30,
  persona?: PersonaType | null,
): LocalPhoto[] {
  if (photos.length === 0) return [];
  if (photos.length <= count) return [...photos].sort((a, b) => a.creationTime - b.creationTime);

  const sorted = [...photos].sort((a, b) => a.creationTime - b.creationTime);
  const clusters = buildActivityClusters(sorted);

  const minTime = sorted[0].creationTime;
  const maxTime = sorted[sorted.length - 1].creationTime;
  const span = maxTime - minTime;

  // How many equal time windows to divide the day into.
  // More windows = stricter spread enforcement.
  // 4 windows ≈ morning / late-morning / afternoon / evening.
  const TIME_WINDOWS = 4;

  // Minimum slots each non-empty window is guaranteed in the candidate set.
  // e.g. count=30, 4 windows → at least 4 guaranteed per window (16 total),
  // leaving 14 slots for pure-quality top-up.
  const minPerWindow = Math.max(2, Math.floor(count / TIME_WINDOWS / 2));

  const selected: LocalPhoto[] = [];
  const selectedIds = new Set<string>();

  // ── Step 1: Guaranteed slots per time window ──────────────────────────────
  if (span > 0) {
    for (let w = 0; w < TIME_WINDOWS; w++) {
      const wStart = minTime + (w / TIME_WINDOWS) * span;
      const wEnd   = minTime + ((w + 1) / TIME_WINDOWS) * span;

      // All clusters whose best photo falls in this window, sorted by quality.
      // Use <= for the last window so photos at exactly maxTime are not excluded.
      const isLastWindow = w === TIME_WINDOWS - 1;
      const windowClusters = clusters
        .filter((c) => c.bestPhoto.creationTime >= wStart && (isLastWindow ? c.bestPhoto.creationTime <= wEnd : c.bestPhoto.creationTime < wEnd))
        .sort((a, b) => b.bestQuality - a.bestQuality);

      let addedForWindow = 0;
      for (const cluster of windowClusters) {
        if (addedForWindow >= minPerWindow) break;
        if (!selectedIds.has(cluster.bestPhoto.id)) {
          selected.push(cluster.bestPhoto);
          selectedIds.add(cluster.bestPhoto.id);
          addedForWindow++;
        }
      }
    }
  }

  // ── Step 2: Fill remaining slots with best clusters overall ───────────────
  const byQuality = [...clusters].sort((a, b) => b.bestQuality - a.bestQuality);

  for (const cluster of byQuality) {
    if (selected.length >= count) break;
    if (!selectedIds.has(cluster.bestPhoto.id)) {
      selected.push(cluster.bestPhoto);
      selectedIds.add(cluster.bestPhoto.id);
    }
  }

  // ── Step 3: Fill remaining slots proportionally to cluster size ───────────
  // A cluster with 50 photos gets proportionally more candidates than one with 5.
  // Within each cluster, photos are still drawn best-first by quality score.
  {
    const slotsLeft = count - selected.length;
    const totalPhotoCount = clusters.reduce((s, c) => s + c.photos.length, 0);

    if (slotsLeft > 0 && totalPhotoCount > 0) {
      // Compute proportional quota for each cluster, sorted best-first
      const quotas = byQuality.map((cluster) => ({
        cluster,
        quota: Math.max(1, Math.round((cluster.photos.length / totalPhotoCount) * slotsLeft)),
        drawn: 0,
      }));

      // Honour quota pass — each cluster contributes up to its proportional share
      let madeProgress = true;
      while (selected.length < count && madeProgress) {
        madeProgress = false;
        for (const item of quotas) {
          if (selected.length >= count) break;
          if (item.drawn >= item.quota) continue;
          const next = item.cluster.photos
            .filter((p) => !selectedIds.has(p.id))
            .sort((a, b) => b.qualityScore - a.qualityScore)[0];
          if (next) {
            selected.push(next);
            selectedIds.add(next.id);
            item.drawn++;
            madeProgress = true;
          }
        }
      }

      // Overflow pass — if still short (rounding / small clusters exhausted),
      // draw from any cluster regardless of quota
      madeProgress = true;
      while (selected.length < count && madeProgress) {
        madeProgress = false;
        for (const item of quotas) {
          if (selected.length >= count) break;
          const next = item.cluster.photos
            .filter((p) => !selectedIds.has(p.id))
            .sort((a, b) => b.qualityScore - a.qualityScore)[0];
          if (next) {
            selected.push(next);
            selectedIds.add(next.id);
            madeProgress = true;
          }
        }
      }
    }
  }

  // ── Storyteller diversity bonus ───────────────────────────────────────────
  // The Storyteller needs variety across shot types and locations. A photo that
  // is the ONLY representative of its activity cluster in the candidate set gets
  // a +10% quality boost — it's irreplaceable in the sequence.
  if (persona === 'storyteller') {
    const clusterRepCount = new Map<string, number>();
    for (const cluster of clusters) {
      const clusterKey = `${cluster.photos[0].id}`;
      for (const photo of selected) {
        if (cluster.photos.some((p) => p.id === photo.id)) {
          clusterRepCount.set(clusterKey, (clusterRepCount.get(clusterKey) ?? 0) + 1);
        }
      }
    }
    // Give the solo representative of each cluster a diversity boost
    for (let i = 0; i < selected.length; i++) {
      for (const cluster of clusters) {
        if (cluster.photos.some((p) => p.id === selected[i].id)) {
          const reps = clusterRepCount.get(`${cluster.photos[0].id}`) ?? 1;
          if (reps === 1) {
            selected[i] = { ...selected[i], qualityScore: selected[i].qualityScore * 1.10 };
          }
          break;
        }
      }
    }
  }

  return selected.sort((a, b) => a.creationTime - b.creationTime);
}

/**
 * Select the best `maxCount` photos using activity-based temporal windowing.
 *
 * Algorithm:
 *   1. Sort chronologically (burst dedup already applied upstream)
 *   2. Group into activity clusters (< 45-min gap = same activity)
 *   3. For each cluster → select the single highest-scoring photo
 *   4. Time-spread enforcement: divide the date range into 5 equal halves;
 *      ensure ≥1 activity per half (promote nearest if a half is empty)
 *   5. Fill remaining slots greedily by cluster quality score
 *      (ties → 2nd-best photo from the top-quality cluster)
 *   6. Return chronologically sorted
 *
 * Also returns runnerUps: next 20 best candidates not in the selection,
 * for use in the review screen runner-up tray.
 *
 * @param photos  - Array of photos (dedup + Vision scoring already applied)
 * @param maxCount - How many to select (default 10)
 */
export function selectBestPhotos(
  photos: LocalPhoto[],
  maxCount = 10,
): { selected: LocalPhoto[]; runnerUps: LocalPhoto[] } {
  if (photos.length === 0) return { selected: [], runnerUps: [] };

  // Sort chronologically
  const sorted = [...photos].sort((a, b) => a.creationTime - b.creationTime);

  if (sorted.length <= maxCount) {
    return { selected: sorted, runnerUps: [] };
  }

  // Build activity clusters
  const clusters = buildActivityClusters(sorted);

  // Always fill up to maxCount even if there are fewer clusters than maxCount.
  // Fall through to the greedy fill below.

  // Time-spread enforcement: 5 equal halves of the full date span
  const minTime = sorted[0].creationTime;
  const maxTime = sorted[sorted.length - 1].creationTime;
  const span = maxTime - minTime;
  const NUM_HALVES = 5;

  const forcedIds = new Set<string>();

  if (span > 0) {
    for (let h = 0; h < NUM_HALVES; h++) {
      const halfStart = minTime + (h / NUM_HALVES) * span;
      const halfEnd = minTime + ((h + 1) / NUM_HALVES) * span;

      // Check if any cluster already has its best photo in this half
      const alreadyCovered = clusters.some(
        (c) => !forcedIds.has(c.bestPhoto.id) &&
               c.bestPhoto.creationTime >= halfStart &&
               c.bestPhoto.creationTime <= halfEnd,
      );

      if (!alreadyCovered) {
        // Find the cluster whose best photo is nearest to the half's midpoint
        const midpoint = (halfStart + halfEnd) / 2;
        const nearest = clusters
          .filter((c) => !forcedIds.has(c.bestPhoto.id))
          .sort((a, b) => Math.abs(a.bestPhoto.creationTime - midpoint) - Math.abs(b.bestPhoto.creationTime - midpoint))[0];
        if (nearest) forcedIds.add(nearest.bestPhoto.id);
      }
    }
  }

  // Sort clusters by quality (descending) for greedy selection
  const clustersByQuality = [...clusters].sort((a, b) => b.bestQuality - a.bestQuality);

  const selectedPhotos: LocalPhoto[] = [];
  const selectedIds = new Set<string>();

  // First: add forced (spread-enforcement) photos
  for (const id of forcedIds) {
    if (selectedPhotos.length >= maxCount) break;
    const photo = sorted.find((p) => p.id === id);
    if (photo) { selectedPhotos.push(photo); selectedIds.add(photo.id); }
  }

  // Second: greedily fill remaining slots from best clusters
  for (const cluster of clustersByQuality) {
    if (selectedPhotos.length >= maxCount) break;
    if (!selectedIds.has(cluster.bestPhoto.id)) {
      selectedPhotos.push(cluster.bestPhoto);
      selectedIds.add(cluster.bestPhoto.id);
    }
  }

  // Third: fill remaining slots proportionally to cluster size
  {
    const slotsLeft = maxCount - selectedPhotos.length;
    const totalPhotoCount = clusters.reduce((s, c) => s + c.photos.length, 0);
    if (slotsLeft > 0 && totalPhotoCount > 0) {
      const quotas = clustersByQuality.map((cluster) => ({
        cluster,
        quota: Math.max(1, Math.round((cluster.photos.length / totalPhotoCount) * slotsLeft)),
        drawn: 0,
      }));
      // Honour quota pass — each cluster contributes up to its proportional share
      let madeProgress = true;
      while (selectedPhotos.length < maxCount && madeProgress) {
        madeProgress = false;
        for (const item of quotas) {
          if (selectedPhotos.length >= maxCount) break;
          if (item.drawn >= item.quota) continue;
          const next = item.cluster.photos
            .filter((p) => !selectedIds.has(p.id))
            .sort((a, b) => b.qualityScore - a.qualityScore)[0];
          if (next) {
            selectedPhotos.push(next);
            selectedIds.add(next.id);
            item.drawn++;
            madeProgress = true;
          }
        }
      }
      // Overflow pass — draw from any cluster if still short
      madeProgress = true;
      while (selectedPhotos.length < maxCount && madeProgress) {
        madeProgress = false;
        for (const item of quotas) {
          if (selectedPhotos.length >= maxCount) break;
          const next = item.cluster.photos
            .filter((p) => !selectedIds.has(p.id))
            .sort((a, b) => b.qualityScore - a.qualityScore)[0];
          if (next) {
            selectedPhotos.push(next);
            selectedIds.add(next.id);
            madeProgress = true;
          }
        }
      }
    }
  }

  const selected = selectedPhotos.sort((a, b) => a.creationTime - b.creationTime);

  // Runner-ups: next best candidates not in selection (up to 20)
  const runnerUps = sorted
    .filter((p) => !selectedIds.has(p.id))
    .sort((a, b) => b.qualityScore - a.qualityScore)
    .slice(0, 20);

  return { selected, runnerUps };
}

/**
 * Score photos using the backend Python sidecar (OpenCV + optional DeepFace).
 *
 * Sends the top `candidateLimit` photos (by initial fileSize-based qualityScore)
 * to /api/score_photos as 512px JPEG thumbnails. The backend computes:
 *   - Sharpness via Laplacian variance (OpenCV)
 *   - Face count via Haar cascade or DeepFace
 *
 * Composite score formula (same weights as prior iOS Vision module):
 *   sharpness  × 0.35
 *   face bonus + min(faceCount × 0.15, 0.40)
 *   saliency   + 0.25  (fixed default — cv2 saliency not used)
 *
 * Falls back silently to existing fileSize scores if the backend is unreachable.
 */
export async function scoreWithBackend(
  photos: LocalPhoto[],
  backendUrl: string,
  options: {
    candidateLimit?: number;
    onProgress?: (msg: string) => void;
    contentMix?: ContentMix;   // used only when persona is null
    persona?: PersonaType | null;
  } = {},
): Promise<LocalPhoto[]> {
  const { candidateLimit = 60, onProgress } = options;

  if (!backendUrl) {
    onProgress?.('⚠ No backend URL — using file-size ranking only');
    return photos;
  }

  // Only score the top candidates by initial quality to keep network payload small
  const sorted = [...photos].sort((a, b) => b.qualityScore - a.qualityScore);
  const candidates = sorted.slice(0, candidateLimit);
  const rest = sorted.slice(candidateLimit);

  onProgress?.(`Scoring ${candidates.length} photos (sharpness + faces via OpenCV)...`);

  // Encode in parallel batches of 10 — sequential encoding was the main bottleneck
  // (60 photos × ~80ms each = ~5s before the sidecar even starts).
  const ENCODE_BATCH = 10;
  const payload: { index: number; data_b64: string }[] = [];
  for (let start = 0; start < candidates.length; start += ENCODE_BATCH) {
    const batch = candidates.slice(start, start + ENCODE_BATCH);
    const results = await Promise.allSettled(
      batch.map((photo, batchIdx) =>
        ImageManipulator.manipulateAsync(
          photo.localUri,
          [{ resize: { width: 512 } }],
          { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true },
        ).then((r) => ({ index: start + batchIdx, base64: r.base64 }))
      )
    );
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value.base64) {
        payload.push({ index: r.value.index, data_b64: r.value.base64 });
      }
    }
  }

  if (payload.length === 0) {
    onProgress?.('⚠ No photos could be encoded — using file-size ranking');
    return photos;
  }

  try {
    const resp = await fetch(`${backendUrl}/api/score_photos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ photos: payload }),
    });

    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

    const data = await resp.json() as { scores: BackendPhotoScore[] };

    let totalFaces = 0;
    let happyFaces = 0;
    let photosWithFaces = 0;
    const persona = options.persona ?? null;

    for (const score of data.scores) {
      const i = score.index;
      if (i < 0 || i >= candidates.length) continue;

      const visionScore = computePersonaScore(score, persona);
      candidates[i] = {
        ...candidates[i],
        qualityScore: candidates[i].qualityScore * (0.4 + visionScore * 0.6),
        faceCount: score.face_count,
      };
      if (score.face_count > 0) { photosWithFaces++; totalFaces += score.face_count; }
      happyFaces += score.happy_face_count ?? 0;
    }

    const personaLabel = persona ? ` [${persona}]` : '';
    const emotionNote  = happyFaces > 0 ? `, ${happyFaces} smiling` : '';
    onProgress?.(
      `✦ Scored ${data.scores.length} photos${personaLabel} — ${photosWithFaces} with faces (${totalFaces} total${emotionNote})`
    );
  } catch (err: any) {
    onProgress?.(`⚠ Backend scoring unavailable (${err?.message ?? 'network error'}) — using file-size ranking`);
    // Silently fall back — not a fatal error
  }

  return [...candidates, ...rest];
}

/** Read a local photo as a base64 JPEG for sending to AI APIs. */
export async function photoToBase64(localUri: string, maxDim = 1024): Promise<string> {
  // expo-file-system can read the file directly
  const base64 = await FileSystem.readAsStringAsync(localUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return base64;
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
