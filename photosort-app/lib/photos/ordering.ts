/**
 * Carousel ordering by story beat.
 *
 * Only three beats are pinned: HOOK → first, WORLD → second, CLOSER → last.
 * Everything else (life, detail, un-roled) keeps its existing relative order —
 * the caller passes `uris` already in the desired base order, and a stable sort
 * preserves that order within each rank.
 */
const BEAT_RANK: Record<string, number> = { hook: 0, world: 1, closer: 3 };

export function orderByBeats(uris: string[], roleOf: (uri: string) => string | undefined): string[] {
  const rank = (uri: string) => BEAT_RANK[roleOf(uri) ?? ''] ?? 2; // life/detail/none → middle
  return uris
    .map((u, i) => ({ u, i }))
    .sort((a, b) => (rank(a.u) - rank(b.u)) || (a.i - b.i))
    .map((x) => x.u);
}
