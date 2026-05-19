/**
 * Burst deduplication — removes near-identical photos taken within a short
 * time window, keeping only the highest-quality one from each burst.
 *
 * A second pass uses perceptual hashing (pHash) to catch visually identical
 * photos that fall outside the burst window (e.g. two shots of the same sign
 * taken 30 seconds apart).
 */
import { LocalPhoto } from '../store/state';

// Ported from instagram_sorter/app/core/deduplicator.py.
// imagehash returns a hex string; we compute Hamming distance bit-by-bit.
function pHashDistance(h1: string, h2: string): number {
  if (!h1 || !h2 || h1.length !== h2.length) return Infinity;
  let distance = 0;
  for (let i = 0; i < h1.length; i += 2) {
    let xor = parseInt(h1.slice(i, i + 2), 16) ^ parseInt(h2.slice(i, i + 2), 16);
    while (xor) { distance += xor & 1; xor >>>= 1; }
  }
  return distance;
}

const PHASH_THRESHOLD = 10; // matches DUPLICATE_HASH_THRESHOLD in instagram_sorter settings.py

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

/**
 * Remove perceptual duplicates using pHash Hamming distance.
 * Requires photos to have been scored by the backend (phash field populated).
 * When duplicates are found, keeps the highest-quality photo from each cluster.
 * Safe to call even if some photos have no phash — those are passed through unchanged.
 */
export function deduplicateByHash(photos: LocalPhoto[]): LocalPhoto[] {
  if (photos.length === 0) return photos;

  const kept: LocalPhoto[] = [];
  const seenHashes: string[] = [];

  // Sort best-first so the highest-quality photo wins when a cluster is found
  const sorted = [...photos].sort((a, b) => b.qualityScore - a.qualityScore);

  for (const photo of sorted) {
    if (!photo.phash) {
      kept.push(photo);
      continue;
    }
    const isDuplicate = seenHashes.some((h) => pHashDistance(photo.phash!, h) <= PHASH_THRESHOLD);
    if (!isDuplicate) {
      kept.push(photo);
      seenHashes.push(photo.phash);
    }
  }

  return kept;
}
