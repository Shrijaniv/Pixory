/**
 * Persistent preferences — survives app restarts.
 * Stores lightweight settings (no photo data).
 */
import * as FileSystem from 'expo-file-system/legacy';
import { ContentMix, PersonaType, store } from './state';

const PREFS_FILE = (FileSystem.documentDirectory ?? '') + 'pixory_prefs_v1.json';

/**
 * Previously this module "healed" a stored backend URL by replacing anything
 * containing localhost, 127.0.0.1 or railway.app with the built-in default.
 *
 * That was actively harmful (audit O4). The built-in default was a developer's
 * own LAN address committed to the repo, so the healing overwrote a URL the
 * user had deliberately entered with an address that resolves nowhere on their
 * network. Loopback is also perfectly correct on a simulator, where it reaches
 * the host machine — so the rule broke the most common development setup.
 *
 * A URL the user typed is now always restored as typed.
 */

export async function loadPersistedPrefs(): Promise<void> {
  try {
    const info = await FileSystem.getInfoAsync(PREFS_FILE);
    if (!info.exists) return;
    const raw = await FileSystem.readAsStringAsync(PREFS_FILE);
    const saved = JSON.parse(raw);

    // A stored URL is the user's own choice — restore it verbatim.
    if (typeof saved.backendUrl === 'string') store.backendUrl = saved.backendUrl;

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
