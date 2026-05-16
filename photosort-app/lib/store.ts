import * as FileSystem from 'expo-file-system/legacy';

export interface Caption {
  mood: string;
  text: string;
  hashtags: string[];
}

export type StoryRole = 'hook' | 'world' | 'life' | 'detail' | 'closer';

export interface LocalPhoto {
  id: string;
  uri: string;       // ph:// on iOS, used for display
  localUri: string;  // file:// path, used for reading bytes
  filename: string;
  creationTime: number; // ms since epoch
  lat?: number;
  lon?: number;
  width: number;
  height: number;
  fileSize?: number;   // bytes on disk — proxy for sharpness/detail
  qualityScore: number;
  faceCount?: number;   // faces detected by sidecar (set by scoreWithBackend)
  isFavorite?: boolean; // marked as favorite in iOS Photos
}

export type ContentMix = 'people' | 'balanced' | 'places';

export type PersonaType =
  | 'aesthete'      // palette coherence > emotional impact; complexity penalised
  | 'social'        // people in every frame, taggable moments
  | 'logger'        // documentary, authentic, rough edges ok; isFavorite = gold
  | 'storyteller'   // sequence & transitions above all; visual diversity critical
  | 'minimalist';   // fewer but perfect — AI caps at 5, user can add more up to 10

export interface AppStore {
  dateFrom: string;
  dateTo: string;
  locationName: string;
  locationLat: number | null;
  locationLon: number | null;
  locationRadiusKm: number;
  vibe: string;          // "what's the story" free-text, per-session
  persona: PersonaType | null; // persistent posting style identity
  method: string;
  contentMix: ContentMix;
  backendUrl: string;

  localPhotos: LocalPhoto[];
  selectedPhotos: string[];
  runnerUpPhotos: LocalPhoto[];
  captions: Caption[];
  curationNotes: string;
  storyDescription: string;           // AI-written one-sentence narrative for this carousel
  missingBeat: string | null;         // AI note about a missing story beat (or null)
  photoRolesByUri: Record<string, StoryRole>; // localUri → story role assigned by AI
  chosenCaption: Caption | null;
  postLocation: string;     // location tag added by user on caption screen
  filterByUserFace: boolean; // exclude photos with faces that don't include the user
}

export const store: AppStore = {
  dateFrom: '',
  dateTo: '',
  locationName: '',
  locationLat: null,
  locationLon: null,
  locationRadiusKm: 50,
  vibe: '',
  persona: null as PersonaType | null,
  method: 'classic',
  contentMix: 'balanced',
  backendUrl: 'http://localhost:8000',

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
};

// Prefs file — works in both Expo Go and dev builds (no native module needed)
const PREFS_FILE = (FileSystem.documentDirectory ?? '') + 'pixory_prefs_v1.json';

export async function loadPersistedPrefs() {
  try {
    const info = await FileSystem.getInfoAsync(PREFS_FILE);
    if (!info.exists) return;
    const raw = await FileSystem.readAsStringAsync(PREFS_FILE);
    const saved = JSON.parse(raw);
    if (saved.backendUrl) store.backendUrl = saved.backendUrl;
    if (saved.method)     store.method = saved.method;
    if (saved.contentMix) store.contentMix = saved.contentMix as ContentMix;
    if (saved.persona)    store.persona = saved.persona as PersonaType;
    if (saved.filterByUserFace !== undefined) store.filterByUserFace = saved.filterByUserFace;
  } catch { /* ignore */ }
}

export async function persistPrefs() {
  try {
    await FileSystem.writeAsStringAsync(PREFS_FILE, JSON.stringify({
      backendUrl: store.backendUrl,
      method: store.method,
      contentMix: store.contentMix,
      persona: store.persona,
      filterByUserFace: store.filterByUserFace,
    }));
  } catch { /* ignore */ }
}

// ── Session persistence (crash recovery) ────────────────────────────────────
const SESSION_FILE = (FileSystem.documentDirectory ?? '') + 'pixory_session_v1.json';

/** Save the current curation session so it survives app restarts. */
export async function saveSession() {
  try {
    await FileSystem.writeAsStringAsync(SESSION_FILE, JSON.stringify({
      selectedPhotos: store.selectedPhotos,
      captions: store.captions,
      curationNotes: store.curationNotes,
      storyDescription: store.storyDescription,
      missingBeat: store.missingBeat,
      photoRolesByUri: store.photoRolesByUri,
      chosenCaption: store.chosenCaption,
      dateFrom: store.dateFrom,
      dateTo: store.dateTo,
      locationName: store.locationName,
      vibe: store.vibe,
      method: store.method,
      savedAt: Date.now(),
    }));
  } catch { /* ignore */ }
}

/** Load a previously saved session. Returns true if a valid session was found. */
export async function loadSession(): Promise<boolean> {
  try {
    const info = await FileSystem.getInfoAsync(SESSION_FILE);
    if (!info.exists) return false;
    const raw = await FileSystem.readAsStringAsync(SESSION_FILE);
    const saved = JSON.parse(raw);
    // Only restore sessions from the last 48 hours
    if (!saved.savedAt || Date.now() - saved.savedAt > 48 * 60 * 60 * 1000) return false;
    if (!saved.selectedPhotos?.length) return false;
    store.selectedPhotos   = saved.selectedPhotos;
    store.captions         = saved.captions ?? [];
    store.curationNotes    = saved.curationNotes ?? '';
    store.storyDescription = saved.storyDescription ?? '';
    store.missingBeat      = saved.missingBeat ?? null;
    store.photoRolesByUri  = saved.photoRolesByUri ?? {};
    store.chosenCaption    = saved.chosenCaption ?? null;
    store.dateFrom       = saved.dateFrom ?? '';
    store.dateTo         = saved.dateTo ?? '';
    store.locationName   = saved.locationName ?? '';
    store.vibe           = saved.vibe ?? '';
    return true;
  } catch { return false; }
}

/** Clear the session after a successful publish or new curation start. */
export async function clearSession() {
  try {
    await FileSystem.deleteAsync(SESSION_FILE, { idempotent: true });
  } catch { /* ignore */ }
}
