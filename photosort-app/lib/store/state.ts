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

/** Which on-device face model the sidecar uses (experimental A/B). */
export type FaceEngine = 'deepface' | 'insightface';

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
  faceEngine: FaceEngine;
  profilePhotoUri: string | null;
  displayName: string;
  handle: string;
  /** id of the Story record for the in-progress curation (set when Review is reached). */
  currentStoryId: string | null;
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
  backendUrl: 'http://192.168.0.74:8000',

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
  faceEngine: 'deepface',
  profilePhotoUri: null,
  displayName: '',
  handle: '',
  currentStoryId: null,
};

/**
 * Clear the per-story brief (story text, dates, place) when starting a NEW
 * curation. Persona / face-filter / engine are settings, so they're preserved.
 * Not called on back-navigation or Duplicate, which intentionally prefill.
 */
export function resetStoryBrief(): void {
  store.vibe = '';
  store.dateFrom = '';
  store.dateTo = '';
  store.locationName = '';
  store.locationLat = null;
  store.locationLon = null;
  store.postLocation = '';
  store.currentStoryId = null;
}
