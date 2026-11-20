/**
 * Near-duplicate grouping for the AI prompt.
 *
 * Each candidate photo carries a `dup_group` label, and the system prompt tells
 * the model to pick at most one photo per label. That instruction is only as
 * good as the grouping: if two near-identical photos end up with different
 * labels, the model is free to select both.
 *
 * ## Why union-find
 *
 * The original implementation walked every pair and, on a match, assigned both
 * photos whichever label one of them already had:
 *
 *   const lbl = group.get(a) ?? group.get(b) ?? nextLabel();
 *   group.set(a, lbl); group.set(b, lbl);
 *
 * That relabels only the two endpoints. When a pair bridges two groups that
 * already exist, the other members of the losing group keep their old label and
 * the component silently splits. Worked example with hashes `0000`, `ffff`,
 * `0fff`, `003f` (threshold 6):
 *
 *   pairs within threshold: (0,3)=6, (1,2)=4, (2,3)=6
 *   (0,3) -> both A          A A? ? ?
 *   (1,2) -> both B          A B B A
 *   (2,3) -> photo2 has B, so photo3 becomes B — but photo0 is still A
 *   result: A B B B
 *
 * Photos 0 and 3 are 6 apart, so they are near-duplicates, yet carry different
 * labels and both may be chosen. Union-find merges whole components instead of
 * endpoints, which is what "same scene" actually means: the relation is
 * transitive through the chain even when the end points are far apart.
 */

import { pHashDistance } from './dedup';

/** Hamming distance at or below this makes two photos near-identical. */
export const DUP_DISTANCE_THRESHOLD = 6;

/**
 * Spreadsheet-style labels: A..Z, then AA, AB, ... .
 *
 * The previous code used `String.fromCharCode(65 + n)`, which runs off the end
 * of the alphabet at the 27th group and starts emitting `[`, `\`, `]`. With up
 * to 30 candidates that was reachable, and punctuation labels would read to the
 * model as noise rather than as a group name.
 */
export function groupLabel(index: number): string {
  let label = '';
  let n = index;
  while (n >= 0) {
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26) - 1;
  }
  return label;
}

interface Hashable {
  localUri: string;
  phash?: string;
}

/**
 * Label connected components of near-duplicate photos.
 *
 * Photos in no group at all are absent from the result: a unique photo has no
 * duplicate to be confused with, and emitting a singleton label would waste
 * prompt space and imply a constraint that does not exist.
 *
 * @returns Map from `localUri` to group label, for grouped photos only.
 */
export function buildDupGroups(
  photos: readonly Hashable[],
  threshold = DUP_DISTANCE_THRESHOLD,
): Map<string, string> {
  const parent = photos.map((_, i) => i);

  const find = (i: number): number => {
    let root = i;
    while (parent[root] !== root) root = parent[root];
    // Path compression — keeps repeated lookups flat on large candidate pools.
    let walk = i;
    while (parent[walk] !== root) {
      const next = parent[walk];
      parent[walk] = root;
      walk = next;
    }
    return root;
  };

  const union = (a: number, b: number): void => {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) parent[rootB] = rootA;
  };

  for (let a = 0; a < photos.length; a++) {
    for (let b = a + 1; b < photos.length; b++) {
      if (pHashDistance(photos[a].phash, photos[b].phash) <= threshold) {
        union(a, b);
      }
    }
  }

  // Collect members per component, in first-appearance order so labels are
  // stable and A is the earliest group in the candidate list.
  const members = new Map<number, number[]>();
  for (let i = 0; i < photos.length; i++) {
    const root = find(i);
    const list = members.get(root);
    if (list) list.push(i);
    else members.set(root, [i]);
  }

  const labels = new Map<string, string>();
  let next = 0;
  for (const group of members.values()) {
    if (group.length < 2) continue; // a photo alone is not a duplicate
    const label = groupLabel(next++);
    for (const i of group) labels.set(photos[i].localUri, label);
  }
  return labels;
}
