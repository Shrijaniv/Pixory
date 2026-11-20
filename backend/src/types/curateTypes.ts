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

export interface PhotoMetadata {
  shot_type?: 'closeup' | 'medium' | 'wide';
  group_size?: 'none' | 'solo' | 'duo' | 'group';
  face_count?: number;        // exact number of people
  happy_face_count?: number;  // how many are smiling/laughing
  is_user?: boolean;          // true when the poster themselves is in the photo
  quality?: number;           // 0–1 composite on-device quality score
  taken_at?: number;          // capture time, ms epoch
  dup_group?: string;         // shared label for near-duplicate photos (e.g. "A")
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
  /** Base64 JPEG of the user's own face (from face identity setup). When present,
   *  the AI is instructed to exclude photos where faces appear but the user is absent. */
  user_face_b64?: string;
  /** Per-photo sidecar metadata (shot type + group size) for objective AI tagging. */
  photo_metadata?: PhotoMetadata[];
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
