/**
 * Persistent preferences — survives app restarts.
 * Stores lightweight settings (no photo data).
 */
import * as FileSystem from 'expo-file-system/legacy';
import { ContentMix, PersonaType, store } from './state';

const PREFS_FILE = (FileSystem.documentDirectory ?? '') + 'pixory_prefs_v1.json';

/** The built-in default from state.ts — used to heal stale stored URLs. */
const DEFAULT_BACKEND_URL = store.backendUrl;

/**
 * URLs that are known-stale and should fall back to the current default:
 * the undeployed Railway placeholder and loopback addresses (unreachable
 * from a phone). Keeps the app pointed at a working backend across rebuilds.
 */
const STALE_URL_MARKERS = ['railway.app', 'localhost', '127.0.0.1'];

export async function loadPersistedPrefs(): Promise<void> {
  try {
    const info = await FileSystem.getInfoAsync(PREFS_FILE);
    if (!info.exists) return;
    const raw = await FileSystem.readAsStringAsync(PREFS_FILE);
    const saved = JSON.parse(raw);

    // Heal stale stored URLs by falling back to the current built-in default.
    if (saved.backendUrl && !STALE_URL_MARKERS.some((m) => saved.backendUrl.includes(m))) {
      store.backendUrl = saved.backendUrl;
    } else {
      store.backendUrl = DEFAULT_BACKEND_URL;
      persistPrefs(); // fire-and-forget to write the healed value immediately
    }

    if (saved.method)      store.method      = saved.method;
    if (saved.contentMix)  store.contentMix  = saved.contentMix as ContentMix;
    if (saved.persona)     store.persona     = saved.persona as PersonaType;
    if (saved.filterByUserFace !== undefined) store.filterByUserFace = saved.filterByUserFace;
    // `faceEngine` is deliberately NOT restored (audit F3). Commit c3afb7b moved
    // main to InsightFace-only and removed the engine toggle from the UI, but this
    // function kept honouring a saved value — so a device that once selected
    // DeepFace stayed on it with no way back. That engine counts a face on every
    // image (enforce_detection=False, confidence unchecked), turning every
    // landscape into a solo portrait. The field is dropped on the next write.
    if (saved.profilePhotoUri !== undefined)  store.profilePhotoUri  = saved.profilePhotoUri;
    if (saved.displayName !== undefined)      store.displayName      = saved.displayName;
    if (saved.handle !== undefined)           store.handle           = saved.handle;
  } catch { /* ignore */ }
}

export async function persistPrefs(): Promise<void> {
  try {
    await FileSystem.writeAsStringAsync(PREFS_FILE, JSON.stringify({
      // faceEngine is intentionally absent — see loadPersistedPrefs (audit F3).
      backendUrl:        store.backendUrl,
      method:            store.method,
      contentMix:        store.contentMix,
      persona:           store.persona,
      filterByUserFace:  store.filterByUserFace,
      profilePhotoUri:   store.profilePhotoUri,
      displayName:       store.displayName,
      handle:            store.handle,
    }));
  } catch { /* ignore */ }
}
