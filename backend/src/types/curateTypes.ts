/** Types for the /api/curate_device_photos and /api/assign_roles endpoints. */

export interface Caption {
  mood: 'wanderlust' | 'minimal' | 'story' | 'playful';
  text: string;
  hashtags: string[];
}

export interface FaceProfile {
  name: string;
  samplePhotoB64: string;
}

export interface CurateBody {
  photos_b64: string[];
  photo_names: string[];
  favorite_indices?: number[];
  vibe?: string;
  max_select?: number;
  provider?: 'claude' | 'openai';
  face_profiles?: FaceProfile[];
  content_mix?: 'people' | 'balanced' | 'places';
  persona?: string;
}

export interface PhotoRole {
  index: number;
  role: 'hook' | 'world' | 'life' | 'detail' | 'closer';
  reason: string;
}

export interface CurateResult {
  success: boolean;
  selected_indices?: number[];
  photo_roles?: PhotoRole[];
  ordering?: number[];
  story?: string;
  missing?: string | null;
  captions?: Caption[];
  notes?: string;
  error?: string;
}

export interface AssignRolesBody {
  photos_b64: string[];
  photo_names?: string[];
  vibe?: string;
  story?: string;
  persona?: string;
  provider?: 'claude' | 'openai';
}

export interface AssignRolesResult {
  photo_roles: PhotoRole[];
  ordering: number[];
  story: string;
  missing: string | null;
}
