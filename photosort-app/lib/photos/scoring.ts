/**
 * Photo quality scoring — per-persona formula + backend sidecar integration.
 */
import * as ImageManipulator from 'expo-image-manipulator';
import { computeLearningBias, loadLearningHistory } from '../learning';
import { ContentMix, LocalPhoto, PersonaType } from '../store/state';

export interface BackendPhotoScore {
  index: number;
  sharpness: number;
  face_count: number;
  happy_face_count: number;
  brightness: number;
  brightness_quality: number;
  contrast: number;
  saturation: number;
  complexity: number;
  shot_type?: 'closeup' | 'medium' | 'wide';
  subject_ratio?: number;
  group_size?: 'none' | 'solo' | 'duo' | 'group';
  phash?: string; // perceptual hash hex string for near-duplicate detection
}

/**
 * Compute a 0–1 quality score for a photo given sidecar signals and the active persona.
 * Each persona has a fundamentally different definition of a "good photo."
 */
export function computePersonaScore(score: BackendPhotoScore, persona: PersonaType | null): number {
  const s   = score.sharpness;
  const bq  = score.brightness_quality ?? 0.5;
  const ct  = score.contrast           ?? 0.5;
  const sat = score.saturation         ?? 0.3;
  const cpx = score.complexity         ?? 0.3;
  const happy   = score.happy_face_count ?? 0;
  const neutral = Math.max(0, score.face_count - happy);
  const effectiveFaces = happy * 1.5 + neutral * 0.5;

  let base: number;
  switch (persona) {
    case 'aesthete':
      // Saturation is the palette proxy — the only persona that treats it as primary.
      // Complexity penalised; faces near-irrelevant.
      base = (
        s          * 0.35 +
        sat        * 0.25 +
        bq         * 0.15 +
        ct         * 0.10 +
        (1 - cpx)  * 0.15 +
        Math.min(effectiveFaces * 0.005, 0.02)
      );
      break;
    case 'social':
      // Happy faces get their own weight — separate from neutral faces.
      // Low per-face weight + a 0.45 cap so the COUNT keeps mattering up to ~5
      // faces: a blurry 5-friend laugh must outscore a sharp 2-face scene.
      base = (
        Math.min(happy   * 0.09, 0.45) +
        Math.min(neutral * 0.10, 0.15) +
        s   * 0.20 +
        bq  * 0.10 +
        ct  * 0.05 +
        sat * 0.05
      );
      break;
    case 'logger':
      // Complexity is POSITIVE — busy, layered scenes = authentic life. No constant floor.
      base = (
        cpx                                    * 0.25 +
        Math.min(effectiveFaces * 0.08, 0.20) +
        bq                                     * 0.20 +
        s                                      * 0.15 +
        ct                                     * 0.10 +
        sat                                    * 0.10
      );
      break;
    case 'storyteller':
      // Brightness quality primary — interesting light creates tonal variety across slides.
      // No constant floor; no complexity preference.
      base = (
        bq  * 0.35 +
        s   * 0.25 +
        ct  * 0.20 +
        Math.min(effectiveFaces * 0.05, 0.10) +
        sat * 0.10
      );
      break;
    case 'mood':
      // Saturation + atmosphere overwhelm everything else.
      // A slightly soft golden-hour shot beats a sharp flat one.
      base = (
        sat * 0.45 +
        bq  * 0.35 +
        ct  * 0.10 +
        s   * 0.10 +
        Math.min(effectiveFaces * 0.005, 0.02)
      );
      break;
    default:
      base = s * 0.35 + Math.min(effectiveFaces * 0.08, 0.15) + 0.25;
  }

  // ── Shot type bonus — applied after base formula ─────────────────────────
  // Intuitive starting points aligned with persona philosophy; the self-learning
  // system will refine these over time for individual users.
  const st = score.shot_type ?? 'wide';
  let shotBonus = 0;
  switch (persona) {
    case 'social':
      // "Tag me in that one" — face filling the frame is the money shot
      shotBonus = st === 'closeup' ? 0.10 : st === 'medium' ? 0.03 : -0.02;
      break;
    case 'aesthete':
      // Wide/medium shots have more compositional room and color field
      shotBonus = st === 'wide' ? 0.05 : st === 'medium' ? 0.03 : -0.03;
      break;
    case 'mood':
      // Wide shots capture more sky/atmosphere; closeups lose the ambient light context
      shotBonus = st === 'wide' ? 0.08 : st === 'medium' ? 0.02 : -0.04;
      break;
    // storyteller, logger, default: no shot-type bias — diversity handled at selection level
  }

  return base + shotBonus;
}

/**
 * Score photos using the backend Python sidecar (OpenCV + DeepFace).
 *
 * Sends top `candidateLimit` photos as 512px JPEG thumbnails to /api/score_photos.
 * Falls back silently to existing fileSize scores if backend is unreachable.
 */
export async function scoreWithBackend(
  photos: LocalPhoto[],
  backendUrl: string,
  options: {
    candidateLimit?: number;
    onProgress?: (msg: string) => void;
    contentMix?: ContentMix;
    persona?: PersonaType | null;
  } = {},
): Promise<LocalPhoto[]> {
  const { candidateLimit = 120, onProgress } = options;

  if (!backendUrl) {
    onProgress?.('⚠ No backend URL — using file-size ranking only');
    return photos;
  }

  const sorted = [...photos].sort((a, b) => b.qualityScore - a.qualityScore);
  const candidates = sorted.slice(0, candidateLimit);
  const rest       = sorted.slice(candidateLimit);

  onProgress?.(`Scoring ${candidates.length} photos (sharpness + faces via OpenCV)...`);

  // Encode in parallel batches of 10
  const ENCODE_BATCH = 10;
  const payload: { index: number; data_b64: string }[] = [];
  for (let start = 0; start < candidates.length; start += ENCODE_BATCH) {
    const batch = candidates.slice(start, start + ENCODE_BATCH);
    const results = await Promise.allSettled(
      batch.map((photo, batchIdx) =>
        ImageManipulator.manipulateAsync(
          photo.localUri,
          [{ resize: { width: 512 } }],
          { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true },
        ).then((r) => ({ index: start + batchIdx, base64: r.base64 }))
      )
    );
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value.base64) {
        payload.push({ index: r.value.index, data_b64: r.value.base64 });
      }
    }
  }

  if (payload.length === 0) {
    onProgress?.('⚠ No photos could be encoded — using file-size ranking');
    return photos;
  }

  try {
    const resp = await fetch(`${backendUrl}/api/score_photos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ photos: payload }),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

    const data = await resp.json() as { scores: BackendPhotoScore[] };
    const persona = options.persona ?? null;
    let totalFaces = 0, happyFaces = 0, photosWithFaces = 0;

    // Load learning history once for the whole batch
    const learningHistory = await loadLearningHistory();

    for (const score of data.scores) {
      const i = score.index;
      if (i < 0 || i >= candidates.length) continue;
      const visionScore = computePersonaScore(score, persona);

      // Store vision metrics on the photo so review-screen edits can be learned from
      candidates[i] = {
        ...candidates[i],
        faceCount:         score.face_count,
        happyFaceCount:    score.happy_face_count,
        sharpness:         score.sharpness,
        brightnessQuality: score.brightness_quality,
        contrast:          score.contrast,
        saturation:        score.saturation,
        complexity:        score.complexity,
        shotType:          score.shot_type,
        subjectRatio:      score.subject_ratio,
        groupSize:         score.group_size,
        phash:             score.phash,
      };

      // Apply persona formula, then nudge with learning bias
      const baseScore    = candidates[i].qualityScore * (0.2 + visionScore * 0.8);
      const learningBias = computeLearningBias(candidates[i], persona, learningHistory);
      candidates[i] = { ...candidates[i], qualityScore: baseScore * learningBias };

      if (score.face_count > 0) { photosWithFaces++; totalFaces += score.face_count; }
      happyFaces += score.happy_face_count ?? 0;
    }

    const personaLabel = persona ? ` [${persona}]` : '';
    const emotionNote  = happyFaces > 0 ? `, ${happyFaces} smiling` : '';
    onProgress?.(`✦ Scored ${data.scores.length} photos${personaLabel} — ${photosWithFaces} with faces (${totalFaces} total${emotionNote})`);
  } catch (err: any) {
    onProgress?.(`⚠ Backend scoring unavailable (${err?.message ?? 'network error'}) — using file-size ranking`);
  }

  return [...candidates, ...rest];
}
