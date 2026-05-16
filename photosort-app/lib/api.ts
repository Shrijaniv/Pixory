/**
 * Pixory backend API client.
 *
 * All functions accept an explicit `backendUrl` from store.backendUrl so the
 * user can point the app at localhost (dev) or their Railway instance (prod).
 */

export async function assignRoles(params: {
  photosBase64: string[];
  photoNames: string[];
  vibe?: string;
  story?: string;
  persona?: string;
  provider: 'claude' | 'openai';
  backendUrl: string;
  signal?: AbortSignal;
}): Promise<{
  success: boolean;
  photo_roles?: Array<{ index: number; role: string; reason: string }>;
  ordering?: number[];
  story?: string;
  missing?: string | null;
  error?: string;
}> {
  const res = await fetch(`${params.backendUrl}/api/assign_roles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      photos_b64: params.photosBase64,
      photo_names: params.photoNames,
      vibe: params.vibe,
      story: params.story,
      persona: params.persona,
      provider: params.provider,
    }),
    signal: params.signal,
  });
  return res.json();
}

export async function registerFace(params: {
  photoBase64: string;
  backendUrl: string;
}): Promise<{ success: boolean; embedding?: number[]; error?: string }> {
  const res = await fetch(`${params.backendUrl}/api/register_face`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ photo_b64: params.photoBase64 }),
  });
  return res.json();
}

export async function matchFaces(params: {
  referenceEmbedding: number[];
  photos: Array<{ index: number; data_b64: string }>;
  backendUrl: string;
}): Promise<{ matches: Array<{ index: number; user_face_present: boolean; similarity: number }> }> {
  try {
    const res = await fetch(`${params.backendUrl}/api/match_faces`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reference_embedding: params.referenceEmbedding,
        photos: params.photos,
      }),
    });
    return res.json();
  } catch {
    // Fail-open: return all photos as user-present so curation continues
    return { matches: params.photos.map((p) => ({ index: p.index, user_face_present: true, similarity: 0.5 })) };
  }
}

export async function searchLocation(params: {
  username: string;
  password: string;
  lat?: number;
  lon?: number;
  name?: string;
  backendUrl: string;
}): Promise<{ locations: Array<{ pk: string; name: string; lat?: number; lon?: number }> }> {
  try {
    const res = await fetch(`${params.backendUrl}/api/search_location`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: params.username,
        password: params.password,
        lat: params.lat,
        lon: params.lon,
        name: params.name,
      }),
    });
    return res.json();
  } catch {
    return { locations: [] };
  }
}

export async function publishFromDevice(params: {
  photosBase64: string[];
  caption: string;
  username: string;
  password: string;
  backendUrl: string;
  locationLat?: number;
  locationLon?: number;
  locationName?: string;
}): Promise<{ success: boolean; post_id?: string; error?: string }> {
  const res = await fetch(`${params.backendUrl}/api/publish_from_device`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      photos_b64: params.photosBase64,
      caption: params.caption,
      username: params.username,
      password: params.password,
      location_lat: params.locationLat,
      location_lon: params.locationLon,
      location_name: params.locationName,
    }),
  });
  return res.json();
}

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
  // 120s timeout — GPT-4o vision with 30 images can take 45-60s over local WiFi
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120_000);
  // Also abort if the caller's signal fires (e.g. user cancels curation)
  params.signal?.addEventListener('abort', () => controller.abort());
  try {
    const res = await fetch(`${params.backendUrl}/api/curate_device_photos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        photos_b64: params.photosBase64,
        photo_names: params.photoNames,
        favorite_indices: params.favoriteIndices,
        vibe: params.vibe,
        max_select: params.maxSelect ?? 10,
        provider: params.provider,
        face_profiles: params.faceProfiles,
        content_mix: params.contentMix,
        persona: params.persona,
      }),
    });
    return res.json();
  } finally {
    clearTimeout(timer);
  }
}
