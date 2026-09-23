/**
 * Persisted-preference tests.
 *
 * The behaviour that matters here is what is *not* restored: a `faceEngine`
 * saved by a build that still offered the DeepFace toggle must never route a
 * current install back onto that engine (audit F3).
 */
import * as FileSystem from 'expo-file-system/legacy';
import { loadPersistedPrefs, persistPrefs } from '../persistence';
import { store } from '../state';

const PREFS_FILE = 'file:///mock-doc-dir/pixory_prefs_v1.json';

const fs = new Map<string, string>();

/** Snapshot of the pristine store, restored between tests. */
const DEFAULTS = { ...store };

beforeEach(() => {
  fs.clear();
  Object.assign(store, DEFAULTS);

  (FileSystem.getInfoAsync as jest.Mock).mockImplementation(async (p: string) => ({
    exists: fs.has(p),
  }));
  (FileSystem.readAsStringAsync as jest.Mock).mockImplementation(async (p: string) => {
    if (!fs.has(p)) throw new Error('not found');
    return fs.get(p)!;
  });
  (FileSystem.writeAsStringAsync as jest.Mock).mockImplementation(
    async (p: string, data: string) => {
      fs.set(p, data);
    },
  );
});

function seed(prefs: Record<string, unknown>) {
  fs.set(PREFS_FILE, JSON.stringify(prefs));
}

describe('faceEngine is never restored (audit F3)', () => {
  it('ignores a saved deepface preference', async () => {
    seed({ faceEngine: 'deepface', backendUrl: 'http://192.168.1.5:8000' });

    await loadPersistedPrefs();

    expect(store.faceEngine).toBe('insightface');
  });

  it('ignores a saved insightface preference too — the field is simply not read', async () => {
    store.faceEngine = 'insightface';
    seed({ faceEngine: 'deepface' });

    await loadPersistedPrefs();

    expect(store.faceEngine).toBe('insightface');
  });

  it('drops the field entirely on the next write', async () => {
    seed({ faceEngine: 'deepface' });
    await loadPersistedPrefs();

    await persistPrefs();

    expect(JSON.parse(fs.get(PREFS_FILE)!)).not.toHaveProperty('faceEngine');
  });
});

describe('loadPersistedPrefs', () => {
  it('does nothing when no preferences file exists', async () => {
    await loadPersistedPrefs();

    expect(store.persona).toBe(DEFAULTS.persona);
    expect(store.method).toBe(DEFAULTS.method);
  });

  it('restores the settings it does own', async () => {
    seed({
      backendUrl: 'http://192.168.1.5:8000',
      method: 'openai',
      contentMix: 'people',
      persona: 'social',
      filterByUserFace: true,
      profilePhotoUri: 'file:///avatar.jpg',
      displayName: 'Sam',
      handle: 'samples',
    });

    await loadPersistedPrefs();

    expect(store).toMatchObject({
      backendUrl: 'http://192.168.1.5:8000',
      method: 'openai',
      contentMix: 'people',
      persona: 'social',
      filterByUserFace: true,
      profilePhotoUri: 'file:///avatar.jpg',
      displayName: 'Sam',
      handle: 'samples',
    });
  });

  it('restores filterByUserFace when it is false, not just when truthy', async () => {
    store.filterByUserFace = true;
    seed({ filterByUserFace: false });

    await loadPersistedPrefs();

    expect(store.filterByUserFace).toBe(false);
  });

  it('survives a corrupt preferences file', async () => {
    fs.set(PREFS_FILE, '{ not json');

    await expect(loadPersistedPrefs()).resolves.toBeUndefined();
    expect(store.persona).toBe(DEFAULTS.persona);
  });

  it('survives an unreadable preferences file', async () => {
    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValueOnce({ exists: true });
    (FileSystem.readAsStringAsync as jest.Mock).mockRejectedValueOnce(new Error('EIO'));

    await expect(loadPersistedPrefs()).resolves.toBeUndefined();
  });

  it('ignores absent optional keys rather than writing undefined into the store', async () => {
    seed({ method: 'classic' });

    await loadPersistedPrefs();

    expect(store.displayName).toBe(DEFAULTS.displayName);
    expect(store.handle).toBe(DEFAULTS.handle);
  });
});

describe('persistPrefs', () => {
  it('writes every owned setting', async () => {
    store.method = 'openai';
    store.persona = 'mood';
    store.filterByUserFace = true;
    store.displayName = 'Sam';

    await persistPrefs();

    expect(JSON.parse(fs.get(PREFS_FILE)!)).toMatchObject({
      method: 'openai',
      persona: 'mood',
      filterByUserFace: true,
      displayName: 'Sam',
    });
  });

  it('never throws when the disk write fails', async () => {
    (FileSystem.writeAsStringAsync as jest.Mock).mockRejectedValueOnce(new Error('disk full'));

    await expect(persistPrefs()).resolves.toBeUndefined();
  });

  it('round-trips through load without losing a setting', async () => {
    store.method = 'openai';
    store.persona = 'logger';
    store.contentMix = 'places';
    store.filterByUserFace = true;
    await persistPrefs();

    Object.assign(store, DEFAULTS);
    await loadPersistedPrefs();

    expect(store).toMatchObject({
      method: 'openai',
      persona: 'logger',
      contentMix: 'places',
      filterByUserFace: true,
    });
  });
});
