/**
 * Global app state — singleton store shared across all screens.
 */

export interface Caption {
  mood: string;
  text: string;
  hashtags: string[];
}

export type StoryRole = 'hook' | 'world' | 'life' | 'detail' | 'closer';

export interface LocalPhoto {
  id: string;
  uri: string;        // ph:// on iOS, used for display
  localUri: string;   // file:// path, used for reading bytes
  filename: string;
  creationTime: number; // ms since epoch
  lat?: number;
  lon?: number;
  width: number;
  height: number;
  fileSize?: number;      // bytes on disk — proxy for sharpness/detail
  qualityScore: number;
  faceCount?: number;     // faces detected by sidecar (set by scoreWithBackend)
  happyFaceCount?: number;
  isFavorite?: boolean;   // marked as favourite in iOS Photos
  // Vision metric fields — populated by scoreWithBackend, used for self-learning
  sharpness?: number;
  brightnessQuality?: number;
  contrast?: number;
  saturation?: number;
  complexity?: number;
  // Composition signals — populated by scoreWithBackend
  shotType?: 'closeup' | 'medium' | 'wide';
  subjectRatio?: number;   // largest face/subject area as fraction of frame (0–1)
  groupSize?: 'none' | 'solo' | 'duo' | 'group';
  phash?: string;          // perceptual hash hex string for near-duplicate detection
}

export type ContentMix = 'people' | 'balanced' | 'places';

export type PersonaType =
  | 'aesthete'      // saturation-primary palette coherence; complexity penalised
  | 'social'        // happy faces dominate; taggable moments
  | 'logger'        // complexity = authentic life; rough edges valued
  | 'storyteller'   // light quality drives scene variety; arc above all
  | 'mood';         // saturation + atmosphere primary; vibe-only posting

export interface AppStore {
  dateFrom: string;
  dateTo: string;
  locationName: string;
  locationLat: number | null;
  locationLon: number | null;
  locationRadiusKm: number;
  vibe: string;
  persona: PersonaType | null;
  method: string;
  contentMix: ContentMix;
  backendUrl: string;

  localPhotos: LocalPhoto[];
  selectedPhotos: string[];
  runnerUpPhotos: LocalPhoto[];
  captions: Caption[];
  curationNotes: string;
  storyDescription: string;
  missingBeat: string | null;
  photoRolesByUri: Record<string, StoryRole>;
  chosenCaption: Caption | null;
  postLocation: string;
  filterByUserFace: boolean;
  profilePhotoUri: string | null;
  displayName: string;
}

export const store: AppStore = {
  dateFrom: '',
  dateTo: '',
  locationName: '',
  locationLat: null,
  locationLon: null,
  locationRadiusKm: 50,
  vibe: '',
  persona: null,
  method: 'classic',
  contentMix: 'balanced',
  backendUrl: 'https://pixory-backend-production.up.railway.app',

  localPhotos: [],
  selectedPhotos: [],
  runnerUpPhotos: [],
  captions: [],
  curationNotes: '',
  storyDescription: '',
  missingBeat: null,
  photoRolesByUri: {},
  chosenCaption: null,
  postLocation: '',
  filterByUserFace: false,
  profilePhotoUri: null,
  displayName: '',
};
