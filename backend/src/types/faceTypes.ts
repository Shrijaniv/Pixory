/** Types for the /api/register_face and /api/match_faces endpoints. */

export type FaceEngine = 'deepface' | 'insightface';

export interface RegisterFaceBody {
  photo_b64: string;
  face_engine?: FaceEngine;
}

export interface RegisterFaceResult {
  success: boolean;
  embedding?: number[];
  engine?: FaceEngine;
  dim?: number;
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
  face_engine?: FaceEngine;
}

export interface MatchFaceResultItem {
  index: number;
  user_face_present: boolean;
  similarity: number;
}

export interface MatchFacesResult {
  matches: MatchFaceResultItem[];
}
