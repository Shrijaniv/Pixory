/**
 * Session persistence — crash recovery for in-progress curations.
 * Sessions expire after 48 hours.
 */
import * as FileSystem from 'expo-file-system/legacy';
import { store } from './state';

const SESSION_FILE = (FileSystem.documentDirectory ?? '') + 'pixory_session_v1.json';
const SESSION_TTL_MS = 48 * 60 * 60 * 1000;

/** Save the current curation session so it survives app restarts. */
export async function saveSession(): Promise<void> {
  try {
    await FileSystem.writeAsStringAsync(SESSION_FILE, JSON.stringify({
      selectedPhotos:  store.selectedPhotos,
      captions:        store.captions,
      curationNotes:   store.curationNotes,
      storyDescription:store.storyDescription,
      missingBeat:     store.missingBeat,
      photoRolesByUri: store.photoRolesByUri,
      chosenCaption:   store.chosenCaption,
      dateFrom:        store.dateFrom,
      dateTo:          store.dateTo,
      locationName:    store.locationName,
      vibe:            store.vibe,
      method:          store.method,
      savedAt:         Date.now(),
    }));
  } catch { /* ignore */ }
}

/** Load a previously saved session. Returns true if a valid session was found. */
export async function loadSession(): Promise<boolean> {
  try {
    const info = await FileSystem.getInfoAsync(SESSION_FILE);
    if (!info.exists) return false;
    const raw  = await FileSystem.readAsStringAsync(SESSION_FILE);
    const saved = JSON.parse(raw);
    if (!saved.savedAt || Date.now() - saved.savedAt > SESSION_TTL_MS) return false;
    if (!saved.selectedPhotos?.length) return false;

    store.selectedPhotos    = saved.selectedPhotos;
    store.captions          = saved.captions        ?? [];
    store.curationNotes     = saved.curationNotes   ?? '';
    store.storyDescription  = saved.storyDescription ?? '';
    store.missingBeat       = saved.missingBeat     ?? null;
    store.photoRolesByUri   = saved.photoRolesByUri ?? {};
    store.chosenCaption     = saved.chosenCaption   ?? null;
    store.dateFrom          = saved.dateFrom        ?? '';
    store.dateTo            = saved.dateTo          ?? '';
    store.locationName      = saved.locationName    ?? '';
    store.vibe              = saved.vibe            ?? '';
    return true;
  } catch { return false; }
}

/** Clear the session after a successful publish or new curation start. */
export async function clearSession(): Promise<void> {
  try {
    await FileSystem.deleteAsync(SESSION_FILE, { idempotent: true });
  } catch { /* ignore */ }
}
