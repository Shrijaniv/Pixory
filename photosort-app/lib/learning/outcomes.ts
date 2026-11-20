/**
 * Resolving what the user's review-screen edits actually mean.
 *
 * ## Why this is derived rather than recorded as it happens
 *
 * v2 wrote to disk on every edit: `deselect` recorded a rejection, `promote`
 * recorded a promotion. Toggling a photo therefore recorded twice, and
 * deselect-then-re-add recorded the same photo in both buckets (audit L5).
 *
 * The fix is to stop treating edits as events. What the user ended up with,
 * compared to what the AI proposed, is all the information there is — and it
 * cannot double-count no matter how much the user fiddles:
 *
 *   in the final carousel, AI proposed it      -> kept       (mild approval)
 *   in the final carousel, AI did not propose  -> promoted   (real preference)
 *   not in the carousel,  AI proposed it       -> rejected   (real preference)
 *   not in the carousel,  AI did not propose   -> no signal
 *
 * The last row matters: a runner-up the user never touched says nothing. They
 * may not have scrolled that far.
 */

import type { LocalPhoto } from '../store/state';
import type { Outcome } from './storage';

export interface ResolvedOutcome {
  photo: LocalPhoto;
  outcome: Outcome;
}

/**
 * Work out one outcome per photo from the final selection.
 *
 * @param finalUris  what the user is shipping, in `localUri` terms
 * @param proposedUris  what the algorithm or AI originally selected
 * @param photoFor  resolves a URI to its scored record; returns undefined for
 *                  photos with no sidecar measurements (e.g. added straight
 *                  from the device library), which are skipped
 */
export function resolveOutcomes(
  finalUris: Iterable<string>,
  proposedUris: ReadonlySet<string>,
  photoFor: (uri: string) => LocalPhoto | undefined,
): ResolvedOutcome[] {
  const resolved: ResolvedOutcome[] = [];
  const seen = new Set<string>();

  for (const uri of finalUris) {
    if (seen.has(uri)) continue; // a duplicated URI is still one decision
    seen.add(uri);
    const photo = photoFor(uri);
    if (!photo) continue;
    resolved.push({ photo, outcome: proposedUris.has(uri) ? 'kept' : 'promoted' });
  }

  for (const uri of proposedUris) {
    if (seen.has(uri)) continue;
    seen.add(uri);
    const photo = photoFor(uri);
    if (!photo) continue;
    resolved.push({ photo, outcome: 'rejected' });
  }

  return resolved;
}
