import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { loadIdentity } from '../../../lib/identity';
import {
  FaceEngine,
  loadPersistedPrefs,
  loadStories,
  persistPrefs,
  PersonaType,
  Story,
  store,
} from '../../../lib/store';
import { PERSONAS } from '../new-story/types';

export type ProfileTab = 'stories' | 'saved' | 'settings';

const IG_USER_KEY = 'ig_username';

export function useProfileState() {
  const [tab, setTab] = useState<ProfileTab>('stories');
  const [stories, setStories] = useState<Story[]>([]);
  const [identitySet, setIdentitySet] = useState(false);
  const [filterByUserFace, setFilterByUserFace] = useState(store.filterByUserFace);
  const [igHandle, setIgHandle] = useState<string | null>(null);
  const [persona, setPersona] = useState<PersonaType | null>(store.persona);
  const [method, setMethod] = useState(store.method);
  const [faceEngine, setFaceEngine] = useState<FaceEngine>(store.faceEngine);
  const [backendUrl, setBackendUrl] = useState(store.backendUrl);
  const [notifications, setNotifications] = useState(true);
  const [displayName, setDisplayName] = useState(store.displayName);
  const [handle, setHandle] = useState(store.handle);
  const [avatarUri, setAvatarUri] = useState<string | null>(store.profilePhotoUri);

  useFocusEffect(useCallback(() => {
    loadStories().then(setStories);
    loadPersistedPrefs().then(() => {
      setPersona(store.persona);
      setMethod(store.method);
      setFaceEngine(store.faceEngine);
      setFilterByUserFace(store.filterByUserFace);
      setBackendUrl(store.backendUrl);
      setDisplayName(store.displayName);
      setHandle(store.handle);
      setAvatarUri(store.profilePhotoUri);
    });
    loadIdentity().then((id) => {
      setIdentitySet(!!id);
      if (!store.profilePhotoUri && id?.refPhotoUri) setAvatarUri(id.refPhotoUri);
    });
    SecureStore.getItemAsync(IG_USER_KEY).then((u) => setIgHandle(u ?? null));
  }, []));

  const counts = {
    stories: stories.length,
    published: stories.filter((s) => s.status === 'published').length,
    saved: stories.filter((s) => s.savedToAlbum).length,
  };

  function openFaceSetup() {
    router.push('/face-setup');
  }

  function toggleFaceFilter(v: boolean) {
    if (!identitySet) {
      router.push('/face-setup');
      return;
    }
    setFilterByUserFace(v);
    store.filterByUserFace = v;
    persistPrefs();
  }

  function choosePersona(next: PersonaType | null) {
    setPersona(next);
    store.persona = next;
    persistPrefs();
  }

  function cycleMethod() {
    // Default engine: Auto Select ↔ AI (GPT-4o). Claude is parked for now.
    const next = method === 'classic' ? 'openai' : 'classic';
    setMethod(next);
    store.method = next;
    persistPrefs();
  }

  function cycleFaceEngine() {
    const next: FaceEngine = faceEngine === 'deepface' ? 'insightface' : 'deepface';
    setFaceEngine(next);
    store.faceEngine = next;
    persistPrefs();
  }

  function updateBackendUrl(v: string) {
    setBackendUrl(v);
    store.backendUrl = v;
    persistPrefs();
  }

  function openInstagram() {
    router.push('/instagram-connect');
  }

  const personaName = PERSONAS.find((p) => p.id === persona)?.name ?? 'No preference';
  const methodLabel = method === 'classic' ? 'Auto Select (on-device)' : 'AI · GPT-4o';
  const faceEngineLabel = faceEngine === 'deepface' ? 'DeepFace (TensorFlow)' : 'InsightFace (onnx)';

  return {
    tab,
    setTab,
    stories,
    counts,
    identitySet,
    filterByUserFace,
    toggleFaceFilter,
    openFaceSetup,
    igHandle,
    persona,
    personaName,
    choosePersona,
    methodLabel,
    cycleMethod,
    faceEngineLabel,
    cycleFaceEngine,
    backendUrl,
    updateBackendUrl,
    notifications,
    setNotifications,
    displayName,
    handle,
    avatarUri,
    openInstagram,
  };
}
