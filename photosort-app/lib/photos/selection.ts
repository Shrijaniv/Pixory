/**
 * Photo selection algorithms — picks the best photos for a carousel
 * with temporal spread and proportional cluster representation.
 */
import { LocalPhoto, PersonaType } from '../store/state';
import { ActivityCluster, buildActivityClusters } from './clusters';

// ── Shot type balance ─────────────────────────────────────────────────────────

type ShotType = 'closeup' | 'medium' | 'wide';

/**
 * Target shot-type distribution per persona, expressed as counts out of 10 slots.
 * Scaled proportionally for carousels smaller than 10.
 */
const SHOT_TYPE_TARGETS: Record<string, { closeup: number; medium: number; wide: number }> = {
  social:      { closeup: 5, medium: 3, wide: 2 },
  aesthete:    { closeup: 1, medium: 4, wide: 5 },
  mood:        { closeup: 1, medium: 3, wide: 6 },  // wide shots capture sky/atmosphere
  storyteller: { closeup: 3, medium: 4, wide: 3 },
  logger:      { closeup: 3, medium: 4, wide: 3 },
  default:     { closeup: 2, medium: 5, wide: 3 },
};

/**
 * Fill `needed` slots from `pool` using two-pass shot-type balance.
 * Pass 1: fill each shot-type bucket up to its proportional target.
 * Pass 2: fill remaining slots by quality score from whatever's left.
 *
 * `alreadySelected` accounts for forced/guaranteed photos already chosen,
 * so targets are computed relative to the full carousel size.
 */
function shotBalancedFill(
  pool: LocalPhoto[],
  needed: number,
  totalCount: number,
  persona: PersonaType | null | undefined,
  alreadySelected: LocalPhoto[],
): LocalPhoto[] {
  if (needed <= 0 || pool.length === 0) return [];

  const target = SHOT_TYPE_TARGETS[persona ?? 'default'] ?? SHOT_TYPE_TARGETS.default;
  const sorted = [...pool].sort((a, b) => b.qualityScore - a.qualityScore);

  // Partition into buckets (score order preserved within each bucket)
  const buckets: Record<ShotType, LocalPhoto[]> = { closeup: [], medium: [], wide: [] };
  for (const p of sorted) {
    const st = (p.shotType ?? 'wide') as ShotType;
    buckets[st].push(p);
  }

  // Count what's already selected per shot type
  const counts: Record<ShotType, number> = { closeup: 0, medium: 0, wide: 0 };
  for (const p of alreadySelected) {
    const st = (p.shotType ?? 'wide') as ShotType;
    counts[st]++;
  }

  const selected: LocalPhoto[] = [];

  // Pass 1: fill each bucket up to its proportional share of the total carousel
  for (const st of ['closeup', 'medium', 'wide'] as ShotType[]) {
    const totalTarget = Math.round((target[st] / 10) * totalCount);
    const stillNeeded = Math.max(0, totalTarget - counts[st]);
    const toAdd = buckets[st].splice(0, Math.min(stillNeeded, buckets[st].length));
    selected.push(...toAdd);
  }

  // Pass 2: fill remaining by quality from whatever's left across all buckets
  const overflow = [...buckets.closeup, ...buckets.medium, ...buckets.wide]
    .sort((a, b) => b.qualityScore - a.qualityScore);
  while (selected.length < needed && overflow.length > 0) {
    selected.push(overflow.shift()!);
  }

  return selected;
}

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

  // Step 2: Fill remaining slots using shot-type balanced selection
  const byQuality = [...clusters].sort((a, b) => b.bestQuality - a.bestQuality);
  const pool = byQuality
    .flatMap((c) => c.photos)
    .filter((p) => !selectedIds.has(p.id))
    .sort((a, b) => b.qualityScore - a.qualityScore);

  const filled = shotBalancedFill(pool, count - selected.length, count, persona, selected);
  for (const p of filled) {
    if (!selectedIds.has(p.id)) { selected.push(p); selectedIds.add(p.id); }
  }

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

  // Second: fill remaining slots using shot-type balanced selection
  const pool = clustersByQuality
    .flatMap((c) => c.photos)
    .filter((p) => !selectedIds.has(p.id))
    .sort((a, b) => b.qualityScore - a.qualityScore);

  const filled = shotBalancedFill(pool, maxCount - selectedPhotos.length, maxCount, null, selectedPhotos);
  for (const p of filled) {
    if (!selectedIds.has(p.id)) { selectedPhotos.push(p); selectedIds.add(p.id); }
  }

  const selected  = selectedPhotos.sort((a, b) => a.creationTime - b.creationTime);
  const runnerUps = sorted
    .filter((p) => !selectedIds.has(p.id))
    .sort((a, b) => b.qualityScore - a.qualityScore)
    .slice(0, 20);

  return { selected, runnerUps };
}

// ── Shared helpers ────────────────────────────────────────────────────────────

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
