/**
 * Turning face-match results into a set of confirmed photos.
 *
 * Two separate hazards make this worth its own function rather than inline
 * code at the call site.
 *
 * 1. **Only a positive match may assert presence.** The `is_user` flag is sent
 *    to the vision model, which renders it as "you're in it" and is told to
 *    treat it as objective on-device measurement. It was previously derived
 *    from a single "the filter ran" boolean, so when encoding or the match
 *    request failed — paths that deliberately keep every photo rather than
 *    drop them — every surviving face photo was still asserted to contain the
 *    user. That told the model the opposite of the truth about photos of other
 *    people, which is precisely what the my-face filter exists to prevent.
 *
 * 2. **Indices address the submitted list, not the original one.** Matches
 *    carry the index of the photo *as submitted*, and photos whose encode
 *    failed are never submitted. Resolving an index against the wrong array
 *    silently attributes one photo's result to another — the same class of
 *    off-by-one that misaligned AI selections in the curation path.
 */

export interface FaceMatch {
  index: number;
  user_face_present: boolean;
  similarity?: number;
}

interface Identifiable {
  localUri: string;
}

/**
 * Collect the URIs the matcher positively confirmed as containing the user.
 *
 * A photo absent from `matches` — because its encode failed, or because the
 * request errored — is deliberately absent from the result. "Not confirmed"
 * is the correct state for it; it is neither asserted nor denied.
 *
 * @param matches     results as returned by the matcher
 * @param submitted   the photos those indices address, in submission order
 */
export function confirmedUserUris(
  matches: readonly FaceMatch[] | undefined | null,
  submitted: readonly Identifiable[],
): Set<string> {
  const confirmed = new Set<string>();
  if (!matches) return confirmed;

  for (const match of matches) {
    if (!match?.user_face_present) continue;
    const photo = submitted[match.index];
    if (photo?.localUri) confirmed.add(photo.localUri);
  }
  return confirmed;
}
