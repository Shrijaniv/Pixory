/**
 * Photo selection algorithms — picks the best photos for a carousel
 * with temporal spread and proportional cluster representation.
 */
import { LocalPhoto, PersonaType } from '../store/state';
import { ActivityCluster, buildActivityClusters } from './clusters';

/**
 * Select top `count` candidates to send to the AI for final curation.
 *
 * Uses time-window guarantees so every part of the day is represented,
 * then fills remaining slots proportionally by cluster size.
 */
export function topCandidates(
  photos: LocalPhoto[],
  count = 30,
  persona?: PersonaType | null,
): LocalPhoto[] {
  if (photos.length === 0) return [];
  if (photos.length <= count) return [...photos].sort((a, b) => a.creationTime - b.creationTime);

  const sorted   = [...photos].sort((a, b) => a.creationTime - b.creationTime);
  const clusters = buildActivityClusters(sorted);

  const minTime = sorted[0].creationTime;
  const maxTime = sorted[sorted.length - 1].creationTime;
  const span    = maxTime - minTime;

  const TIME_WINDOWS = 4;
  const minPerWindow = Math.max(2, Math.floor(count / TIME_WINDOWS / 2));

  const selected: LocalPhoto[] = [];
  const selectedIds = new Set<string>();

  // Step 1: Guaranteed slots per time window
  if (span > 0) {
    for (let w = 0; w < TIME_WINDOWS; w++) {
      const wStart = minTime + (w / TIME_WINDOWS) * span;
      const wEnd   = minTime + ((w + 1) / TIME_WINDOWS) * span;
      const isLast = w === TIME_WINDOWS - 1;
      const windowClusters = clusters
        .filter((c) =>
          c.bestPhoto.creationTime >= wStart &&
          (isLast ? c.bestPhoto.creationTime <= wEnd : c.bestPhoto.creationTime < wEnd)
        )
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

  // Step 2: Fill remaining slots with best clusters overall
  const byQuality = [...clusters].sort((a, b) => b.bestQuality - a.bestQuality);
  for (const cluster of byQuality) {
    if (selected.length >= count) break;
    if (!selectedIds.has(cluster.bestPhoto.id)) {
      selected.push(cluster.bestPhoto);
      selectedIds.add(cluster.bestPhoto.id);
    }
  }

  // Step 3: Fill remaining slots proportionally to cluster size
  fillProportionally(selected, selectedIds, byQuality, count);

  // Storyteller diversity bonus: sole representative of a cluster gets +10%
  if (persona === 'storyteller') {
    applyDiversityBonus(selected, clusters);
  }

  return selected.sort((a, b) => a.creationTime - b.creationTime);
}

/**
 * Select the best `maxCount` photos for Classic mode using activity-based
 * temporal windowing with guaranteed spread across the date range.
 *
 * Returns both the selection and runner-ups for the review tray.
 */
export function selectBestPhotos(
  photos: LocalPhoto[],
  maxCount = 10,
): { selected: LocalPhoto[]; runnerUps: LocalPhoto[] } {
  if (photos.length === 0) return { selected: [], runnerUps: [] };

  const sorted = [...photos].sort((a, b) => a.creationTime - b.creationTime);
  if (sorted.length <= maxCount) return { selected: sorted, runnerUps: [] };

  const clusters = buildActivityClusters(sorted);
  const minTime = sorted[0].creationTime;
  const maxTime = sorted[sorted.length - 1].creationTime;
  const span    = maxTime - minTime;
  const NUM_HALVES = 5;

  const forcedIds = new Set<string>();

  // Time-spread enforcement: ensure ≥1 photo per fifth of the date range
  if (span > 0) {
    for (let h = 0; h < NUM_HALVES; h++) {
      const halfStart = minTime + (h / NUM_HALVES) * span;
      const halfEnd   = minTime + ((h + 1) / NUM_HALVES) * span;
      const covered   = clusters.some(
        (c) => !forcedIds.has(c.bestPhoto.id) &&
               c.bestPhoto.creationTime >= halfStart &&
               c.bestPhoto.creationTime <= halfEnd,
      );
      if (!covered) {
        const midpoint = (halfStart + halfEnd) / 2;
        const nearest  = clusters
          .filter((c) => !forcedIds.has(c.bestPhoto.id))
          .sort((a, b) =>
            Math.abs(a.bestPhoto.creationTime - midpoint) -
            Math.abs(b.bestPhoto.creationTime - midpoint)
          )[0];
        if (nearest) forcedIds.add(nearest.bestPhoto.id);
      }
    }
  }

  const clustersByQuality = [...clusters].sort((a, b) => b.bestQuality - a.bestQuality);
  const selectedPhotos: LocalPhoto[] = [];
  const selectedIds = new Set<string>();

  // First: forced spread photos
  for (const id of forcedIds) {
    if (selectedPhotos.length >= maxCount) break;
    const photo = sorted.find((p) => p.id === id);
    if (photo) { selectedPhotos.push(photo); selectedIds.add(photo.id); }
  }

  // Second: best-cluster photos
  for (const cluster of clustersByQuality) {
    if (selectedPhotos.length >= maxCount) break;
    if (!selectedIds.has(cluster.bestPhoto.id)) {
      selectedPhotos.push(cluster.bestPhoto);
      selectedIds.add(cluster.bestPhoto.id);
    }
  }

  // Third: fill proportionally
  fillProportionally(selectedPhotos, selectedIds, clustersByQuality, maxCount);

  const selected  = selectedPhotos.sort((a, b) => a.creationTime - b.creationTime);
  const runnerUps = sorted
    .filter((p) => !selectedIds.has(p.id))
    .sort((a, b) => b.qualityScore - a.qualityScore)
    .slice(0, 20);

  return { selected, runnerUps };
}

// ── Shared helpers ────────────────────────────────────────────────────────────

function fillProportionally(
  selected: LocalPhoto[],
  selectedIds: Set<string>,
  byQuality: ActivityCluster[],
  count: number,
): void {
  const slotsLeft = count - selected.length;
  const total     = byQuality.reduce((s, c) => s + c.photos.length, 0);
  if (slotsLeft <= 0 || total === 0) return;

  const quotas = byQuality.map((cluster) => ({
    cluster,
    quota: Math.max(1, Math.round((cluster.photos.length / total) * slotsLeft)),
    drawn: 0,
  }));

  // Honour-quota pass
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

  // Overflow pass
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

function applyDiversityBonus(selected: LocalPhoto[], clusters: ActivityCluster[]): void {
  const clusterRepCount = new Map<string, number>();
  for (const cluster of clusters) {
    const key = cluster.photos[0].id;
    let count = 0;
    for (const photo of selected) {
      if (cluster.photos.some((p) => p.id === photo.id)) count++;
    }
    clusterRepCount.set(key, count);
  }
  for (let i = 0; i < selected.length; i++) {
    for (const cluster of clusters) {
      if (cluster.photos.some((p) => p.id === selected[i].id)) {
        if ((clusterRepCount.get(cluster.photos[0].id) ?? 1) === 1) {
          selected[i] = { ...selected[i], qualityScore: selected[i].qualityScore * 1.10 };
        }
        break;
      }
    }
  }
}
