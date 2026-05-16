import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { loadIdentity } from '../../../lib/identity';
import { clearSession, loadPersistedPrefs, persistPrefs, PersonaType, store } from '../../../lib/store';

export function useHomeState() {
  const [dateFrom, setDateFrom] = useState(store.dateFrom);
  const [dateTo, setDateTo]     = useState(store.dateTo);
  const [location, setLocation] = useState(store.locationName);
  const [radius, setRadius]     = useState(String(store.locationRadiusKm));
  const [storyText, setStoryText] = useState(store.vibe);
  const [persona, setPersona]   = useState<PersonaType | null>(store.persona);
  const [method, setMethod]     = useState(store.method);
  const [backendUrl, setBackendUrl] = useState(store.backendUrl);
  const [identitySet, setIdentitySet] = useState(false);
  const [identityUri, setIdentityUri] = useState<string | null>(null);
  const [filterByUserFace, setFilterByUserFace] = useState(store.filterByUserFace);
  const [showRangePicker, setShowRangePicker] = useState(false);

  // Load persisted prefs on mount + check for a saved session to resume
  useEffect(() => {
    loadPersistedPrefs().then(() => {
      setBackendUrl(store.backendUrl);
      setMethod(store.method);
      setPersona(store.persona);
      setFilterByUserFace(store.filterByUserFace);
    });

    // Check if face identity has been set up
    loadIdentity().then((id) => {
      setIdentitySet(!!id);
      setIdentityUri(id?.refPhotoUri ?? null);
    });
  }, []);

  // Refresh identity state when returning from face-setup screen
  useFocusEffect(useCallback(() => {
    loadIdentity().then((id) => {
      setIdentitySet(!!id);
      setIdentityUri(id?.refPhotoUri ?? null);
      // If identity was cleared, also turn off the filter
      if (!id && store.filterByUserFace) {
        store.filterByUserFace = false;
        setFilterByUserFace(false);
        persistPrefs();
      }
    });
  }, []));

  // Persist immediately when backend URL, method, or persona changes
  useEffect(() => { store.backendUrl = backendUrl; persistPrefs(); }, [backendUrl]);
  useEffect(() => { store.method = method; persistPrefs(); }, [method]);
  useEffect(() => { store.persona = persona; persistPrefs(); }, [persona]);

  function confirmRange(from: string, to: string) {
    setDateFrom(from);
    setDateTo(to);
    setShowRangePicker(false);
  }

  function handleNext() {
    store.dateFrom          = dateFrom.trim();
    store.dateTo            = dateTo.trim();
    store.locationName      = location.trim();
    store.locationRadiusKm  = Number(radius) || 50;
    store.vibe              = storyText.trim();
    store.persona           = persona;
    // Derive content mix from persona for backward compat with scoring pipeline
    store.contentMix        = persona === 'social' ? 'people' : 'balanced';
    store.method            = method;
    store.backendUrl        = backendUrl.trim() || 'http://localhost:8000';
    clearSession(); // start fresh
    router.push('/processing');
  }

  return {
    dateFrom,
    dateTo,
    location,
    setLocation,
    radius,
    setRadius,
    storyText,
    setStoryText,
    persona,
    setPersona,
    method,
    setMethod,
    backendUrl,
    setBackendUrl,
    identitySet,
    identityUri,
    filterByUserFace,
    setFilterByUserFace,
    showRangePicker,
    setShowRangePicker,
    confirmRange,
    handleNext,
  };
}
