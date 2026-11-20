/**
 * Photo quality scoring — per-persona formula + backend sidecar integration.
 */
import * as ImageManipulator from 'expo-image-manipulator';
import { computeLearningBias, loadLearningHistory } from '../learning';
import { ContentMix, LocalPhoto, PersonaType } from '../store/state';
import { blendVisionScore, discountUnscored } from './quality';

/** Wall-clock budget for the sidecar scoring call. */
export const SCORING_TIMEOUT_MS = 120_000;

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
 * Outcome of a sidecar scoring pass.
 *
 * `scored` is the part callers must branch on. Previously this function
 * returned a bare array, so a total scoring failure was indistinguishable
 * from success with zero faces — and the my-face filter, which drops every
 * photo lacking a face count, would silently empty the entire curation
 * (audit F2). Callers must not apply score-dependent filters when
 * `scored` is false.
 */
export interface ScoringResult {
  /** Every input photo, scored where possible. Never shorter than the input. */
  photos: LocalPhoto[];
  /** True only when the sidecar returned a usable response. */
  scored: boolean;
  /** How many photos actually carry sidecar features. */
  scoredCount: number;
  /** Human-readable failure reason, present only when `scored` is false. */
  error?: string;
}

/**
 * Score photos using the backend Python sidecar (OpenCV + InsightFace).
 *
 * Sends the top `candidateLimit` photos as 512px JPEG thumbnails to
 * /api/score_photos. On any failure the photos are returned unchanged with
 * `scored: false` so the caller can surface it rather than degrade silently.
 */
export async function scoreWithBackend(
  photos: LocalPhoto[],
  backendUrl: string,
  options: {
    candidateLimit?: number;
    onProgress?: (msg: string) => void;
    contentMix?: ContentMix;
    persona?: PersonaType | null;
    faceEngine?: 'deepface' | 'insightface';
    /** Abort the request from the caller (navigation, cancel). */
    signal?: AbortSignal;
    /** Wall-clock budget for the sidecar call. */
    timeoutMs?: number;
  } = {},
): Promise<ScoringResult> {
  const { candidateLimit = 120, onProgress, faceEngine } = options;

  if (!backendUrl) {
    const error = 'No backend URL configured';
    onProgress?.(`⚠ ${error} — photos cannot be scored`);
    return { photos, scored: false, scoredCount: 0, error };
  }

  const sorted = [...photos].sort((a, b) => b.qualityScore - a.qualityScore);
  const candidates = sorted.slice(0, candidateLimit);
  const rest       = sorted.slice(candidateLimit);

  onProgress?.(`Scoring ${candidates.length} photos (sharpness + faces via OpenCV)...`);

  // Cancellation is wired up before encoding starts, for two reasons: a caller
  // signal that is ALREADY aborted must be honoured (addEventListener never
  // fires for those), and encoding 120 photos is slow enough that continuing
  // after a cancel wastes real time.
  const controller = new AbortController();
  const onCallerAbort = () => controller.abort();
  if (options.signal) {
    if (options.signal.aborted) controller.abort();
    else options.signal.addEventListener('abort', onCallerAbort);
  }
  const detach = () => options.signal?.removeEventListener('abort', onCallerAbort);

  const abortedResult = (): ScoringResult => {
    detach();
    return { photos, scored: false, scoredCount: 0, error: 'Scoring cancelled' };
  };

  if (controller.signal.aborted) return abortedResult();

  // Encode in parallel batches of 10
  const ENCODE_BATCH = 10;
  const payload: { index: number; data_b64: string }[] = [];
  for (let start = 0; start < candidates.length; start += ENCODE_BATCH) {
    if (controller.signal.aborted) return abortedResult();
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
    detach();
    const error = 'No photos could be encoded for scoring';
    onProgress?.(`⚠ ${error}`);
    return { photos, scored: false, scoredCount: 0, error };
  }

  // Bound the request itself. Without this a dropped backend hangs the run
  // forever (audit O6). The timer starts here, not before encoding, so slow
  // encoding does not eat the network budget.
  const timeoutMs = options.timeoutMs ?? SCORING_TIMEOUT_MS;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let scoredCount = 0;
  try {
    const resp = await fetch(`${backendUrl}/api/score_photos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ photos: payload, face_engine: faceEngine }),
      signal: controller.signal,
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

    const data = await resp.json() as { scores: BackendPhotoScore[] };
    if (!Array.isArray(data?.scores)) throw new Error('Malformed sidecar response');
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

      // Apply persona formula, then nudge with learning bias. Both inputs are
      // in [0, 1] so the result stays on the same scale as unscored photos.
      const baseScore    = blendVisionScore(candidates[i].qualityScore, visionScore);
      const learningBias = computeLearningBias(candidates[i], persona, learningHistory);
      candidates[i] = { ...candidates[i], qualityScore: baseScore * learningBias };

      scoredCount++;
      if (score.face_count > 0) { photosWithFaces++; totalFaces += score.face_count; }
      happyFaces += score.happy_face_count ?? 0;
    }

    const personaLabel = persona ? ` [${persona}]` : '';
    const emotionNote  = happyFaces > 0 ? `, ${happyFaces} smiling` : '';
    onProgress?.(`✦ Scored ${scoredCount} photos${personaLabel} — ${photosWithFaces} with faces (${totalFaces} total${emotionNote})`);
  } catch (err: any) {
    const aborted = err?.name === 'AbortError';
    const error = !aborted
      ? `Backend scoring unavailable (${err?.message ?? 'network error'})`
      : options.signal?.aborted
        ? 'Scoring cancelled'
        : `Scoring timed out after ${Math.round(timeoutMs / 1000)}s`;
    // Loud, not silent: the caller decides whether to continue (audit F2).
    onProgress?.(`⚠ ${error}`);
    return { photos, scored: false, scoredCount: 0, error };
  } finally {
    clearTimeout(timer);
    detach();
  }

  // Photos past the candidate limit were never measured, so discount them
  // rather than letting a large unscored file outrank a measured one (L7).
  const discounted = rest.map((p) => ({ ...p, qualityScore: discountUnscored(p.qualityScore) }));
  return { photos: [...candidates, ...discounted], scored: true, scoredCount };
}
