/** AI curation and role-assignment API calls. */

export async function curateDevicePhotos(params: {
  photosBase64: string[];
  photoNames: string[];
  favoriteIndices?: number[];
  vibe?: string;
  maxSelect?: number;
  provider: 'claude' | 'openai';
  backendUrl: string;
  faceProfiles?: Array<{ name: string; samplePhotoB64: string }>;
  contentMix?: 'people' | 'balanced' | 'places';
  persona?: string;
  /** Base64 JPEG of the user's reference face from face identity setup.
   *  When present, the AI will visually exclude photos where faces appear but the user is absent. */
  userFaceB64?: string;
  /** Per-photo metadata attached as objective tags on each photo label for the AI. */
  photoMetadata?: Array<{
    shot_type?: string;
    group_size?: string;
    face_count?: number;
    happy_face_count?: number;
    is_user?: boolean;
    quality?: number;
    taken_at?: number;
    dup_group?: string;
  }>;
  signal?: AbortSignal;
}): Promise<{
  success: boolean;
  selected_indices?: number[];
  photo_roles?: Array<{ index: number; role: string; reason: string }>;
  ordering?: number[];
  story?: string;
  missing?: string | null;
  captions?: Array<{ mood: string; text: string; hashtags: string[] }>;
  notes?: string;
  error?: string;
}> {
  // 120s timeout — GPT-4o vision with 30 images can take 45–60s over local WiFi
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120_000);
  params.signal?.addEventListener('abort', () => controller.abort());
  try {
    const res = await fetch(`${params.backendUrl}/api/curate_device_photos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        photos_b64:       params.photosBase64,
        photo_names:      params.photoNames,
        favorite_indices: params.favoriteIndices,
        vibe:             params.vibe,
        max_select:       params.maxSelect ?? 10,
        provider:         params.provider,
        face_profiles:    params.faceProfiles,
        content_mix:      params.contentMix,
        persona:          params.persona,
        user_face_b64:    params.userFaceB64,
        photo_metadata:   params.photoMetadata,
      }),
    });
    return res.json();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Budget for the review screen's re-label call. Shorter than the initial
 * curation's 120s: this runs on at most 10 already-selected photos and fires
 * on every edit, so a slow response is worse than no response (audit O6).
 */
export const ASSIGN_ROLES_TIMEOUT_MS = 60_000;

export async function assignRoles(params: {
  photosBase64: string[];
  photoNames: string[];
  vibe?: string;
  story?: string;
  persona?: string;
  provider: 'claude' | 'openai';
  backendUrl: string;
  signal?: AbortSignal;
  timeoutMs?: number;
}): Promise<{
  success: boolean;
  photo_roles?: Array<{ index: number; role: string; reason: string }>;
  ordering?: number[];
  story?: string;
  missing?: string | null;
  error?: string;
}> {
  // Own timeout, linked to the caller's signal. Without this a dropped backend
  // leaves the review screen spinning "Reorganizing the story arc…" forever.
  const controller = new AbortController();
  const onCallerAbort = () => controller.abort();
  if (params.signal) {
    if (params.signal.aborted) controller.abort();
    else params.signal.addEventListener('abort', onCallerAbort);
  }
  const timer = setTimeout(() => controller.abort(), params.timeoutMs ?? ASSIGN_ROLES_TIMEOUT_MS);

  try {
    const res = await fetch(`${params.backendUrl}/api/assign_roles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        photos_b64:  params.photosBase64,
        photo_names: params.photoNames,
        vibe:        params.vibe,
        story:       params.story,
        persona:     params.persona,
        provider:    params.provider,
      }),
      signal: controller.signal,
    });
    return await res.json();
  } finally {
    clearTimeout(timer);
    params.signal?.removeEventListener('abort', onCallerAbort);
  }
}
