/**
 * Burst deduplication — removes near-identical photos taken within a short
 * time window, keeping only the highest-quality one from each burst.
 */
import { LocalPhoto } from '../store/state';

/**
 * Remove burst duplicates: photos within `thresholdSec` of each other
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

  return groups.map((group) =>
    group.reduce((best, p) => (p.qualityScore > best.qualityScore ? p : best))
  );
}
