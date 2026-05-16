/**
 * Persistent preferences — survives app restarts.
 * Stores lightweight settings (no photo data).
 */
import * as FileSystem from 'expo-file-system/legacy';
import { ContentMix, PersonaType, store } from './state';

const PREFS_FILE = (FileSystem.documentDirectory ?? '') + 'pixory_prefs_v1.json';

export async function loadPersistedPrefs(): Promise<void> {
  try {
    const info = await FileSystem.getInfoAsync(PREFS_FILE);
    if (!info.exists) return;
    const raw = await FileSystem.readAsStringAsync(PREFS_FILE);
    const saved = JSON.parse(raw);
    if (saved.backendUrl)  store.backendUrl  = saved.backendUrl;
    if (saved.method)      store.method      = saved.method;
    if (saved.contentMix)  store.contentMix  = saved.contentMix as ContentMix;
    if (saved.persona)     store.persona     = saved.persona as PersonaType;
    if (saved.filterByUserFace !== undefined) store.filterByUserFace = saved.filterByUserFace;
    if (saved.profilePhotoUri !== undefined)  store.profilePhotoUri  = saved.profilePhotoUri;
    if (saved.displayName !== undefined)      store.displayName      = saved.displayName;
  } catch { /* ignore */ }
}

export async function persistPrefs(): Promise<void> {
  try {
    await FileSystem.writeAsStringAsync(PREFS_FILE, JSON.stringify({
      backendUrl:        store.backendUrl,
      method:            store.method,
      contentMix:        store.contentMix,
      persona:           store.persona,
      filterByUserFace:  store.filterByUserFace,
      profilePhotoUri:   store.profilePhotoUri,
      displayName:       store.displayName,
    }));
  } catch { /* ignore */ }
}
