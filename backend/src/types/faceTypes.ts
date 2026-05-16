/** Types for the /api/register_face and /api/match_faces endpoints. */

export interface RegisterFaceBody {
  photo_b64: string;
}

export interface RegisterFaceResult {
  success: boolean;
  embedding?: number[];
  error?: string;
}

export interface MatchFaceItem {
  index: number;
  data_b64: string;
}

export interface MatchFacesBody {
  reference_embedding: number[];
  photos: MatchFaceItem[];
  threshold?: number;
}

export interface MatchFaceResultItem {
  index: number;
  user_face_present: boolean;
  similarity: number;
}

export interface MatchFacesResult {
  matches: MatchFaceResultItem[];
}
