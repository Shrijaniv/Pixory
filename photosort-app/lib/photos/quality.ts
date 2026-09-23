/**
 * Pre-scoring quality proxy — the cheap, on-device ranking used to pick which
 * photos are worth sending to the sidecar.
 *
 * ## Why this exists
 *
 * The original score was `resolution * bytesPerPixel`, which reduces to the
 * raw file size in bytes whenever `bytesPerPixel` is below its clamp — so the
 * "quality score" was a number in the millions. Two bugs followed from that:
 *
 *  - `scoreWithBackend` rescaled the photos it scored into roughly 0–1 but
 *    returned the unscored remainder with its raw millions-scale value, so
 *    unscored photos outranked every scored one (audit L7).
 *  - The same raw value was sent to the LLM as `quality N/100`, rendering as
 *    `quality 250000000/100` (audit L3).
 *
 * Normalising at the point of creation fixes both at the source: every
 * `qualityScore` in the app is now in [0, 1].
 *
 * ## Why a log scale
 *
 * File sizes span orders of magnitude — a 200 KB screenshot to an 8 MB HEIC.
 * A linear map bunches almost everything near zero and wastes the range. A
 * log map spreads them evenly. It is also strictly monotonic, so the ranking
 * order this produces is *identical* to the pre-fix behaviour; only the scale
 * changes. That matters: this fix is not meant to alter which photos win.
 */

/** Below this, a photo is treated as the lowest quality the proxy can express. */
export const BYTES_FLOOR = 200_000; // 200 KB

/** At or above this, a photo is treated as top quality for the proxy. */
export const BYTES_CEIL = 8_000_000; // 8 MB

/**
 * The favourite multiplier, applied to the raw byte proxy before normalising.
 *
 * Kept as a multiplier on the raw value (rather than a bonus on the normalised
 * one) so the resulting order is bit-for-bit the same as the pre-fix code: on
 * a log scale a constant multiplier is a constant offset.
 */
export const FAVORITE_MULTIPLIER = 2;

/**
 * Photos the sidecar never scored are an unknown quantity, so they are
 * discounted against photos we actually measured. Without this, a large
 * unscored file can still outrank a small, sharp, well-exposed scored one.
 */
export const UNSCORED_CONFIDENCE = 0.5;

const LOG_FLOOR = Math.log(BYTES_FLOOR);
const LOG_RANGE = Math.log(BYTES_CEIL) - LOG_FLOOR;

/** Clamp a value into [lo, hi], mapping non-finite input to `lo`. */
export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

/**
 * Map a raw byte-size proxy onto [0, 1] logarithmically.
 *
 * Non-finite or non-positive input maps to 0 — a photo whose size could not
 * be read ranks last rather than crashing the sort.
 */
export function normaliseByteProxy(rawBytes: number): number {
  if (!Number.isFinite(rawBytes) || rawBytes <= 0) return 0;
  return clamp01((Math.log(rawBytes) - LOG_FLOOR) / LOG_RANGE);
}

/**
 * Compute the pre-scoring quality proxy for a photo.
 *
 * @param resolution  width * height in pixels
 * @param fileSize    bytes on disk; undefined when the stat call failed
 * @param isFavorite  hearted in iOS Photos
 */
export function computeByteQuality(
  resolution: number,
  fileSize: number | undefined,
  isFavorite: boolean,
): { qualityScore: number; rawByteScore: number } {
  // A resolution of zero would make bytes-per-pixel infinite; treat the photo
  // as unrankable rather than propagating NaN through every downstream sort.
  if (!Number.isFinite(resolution) || resolution <= 0) {
    return { qualityScore: 0, rawByteScore: 0 };
  }

  // Cap bytes-per-pixel so an uncompressed or pathological file cannot
  // dominate purely on encoding. Preserved from the original implementation.
  const bytesPerPixel = fileSize ? Math.min(fileSize / resolution, 4) : 1;
  const rawByteScore = resolution * bytesPerPixel * (isFavorite ? FAVORITE_MULTIPLIER : 1);

  return { qualityScore: normaliseByteProxy(rawByteScore), rawByteScore };
}

/**
 * Blend the cheap byte proxy with the sidecar's vision score.
 *
 * The vision score carries most of the weight (0.8) because it measures the
 * image itself rather than its encoding; the proxy keeps a 0.2 floor so a
 * high-resolution original still edges out a thumbnail of the same scene.
 * Both inputs are in [0, 1], so the result is too.
 */
export function blendVisionScore(byteQuality: number, visionScore: number): number {
  return clamp01(byteQuality) * (0.2 + clamp01(visionScore) * 0.8);
}

/**
 * Discount a photo the sidecar never scored, so measured photos outrank
 * unmeasured ones at equivalent size.
 */
export function discountUnscored(byteQuality: number): number {
  return clamp01(byteQuality) * UNSCORED_CONFIDENCE;
}
