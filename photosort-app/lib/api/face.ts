/** Face identity registration and matching API calls. */

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
        photos:              params.photos,
      }),
    });
    return res.json();
  } catch {
    // Fail-open: if sidecar unreachable, treat all photos as user-present
    return {
      matches: params.photos.map((p) => ({
        index: p.index, user_face_present: true, similarity: 0.5,
      })),
    };
  }
}
