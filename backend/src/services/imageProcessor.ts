/** Image resizing utilities using sharp. */
import sharp from 'sharp';

/**
 * Resize a base64-encoded JPEG to fit within maxPx × maxPx,
 * re-encode as JPEG at 80% quality, and return as base64.
 */
export async function resizeToBase64(b64: string, maxPx = 1024): Promise<string> {
  const buf = Buffer.from(b64, 'base64');
  const resized = await sharp(buf)
    .resize(maxPx, maxPx, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toBuffer();
  return resized.toString('base64');
}
