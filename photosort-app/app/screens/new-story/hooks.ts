import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { loadIdentity } from '../../../lib/identity';
import { clearSession, loadPersistedPrefs, persistPrefs, PersonaType, store } from '../../../lib/store';

/**
 * New Story setup state. Collects the brief (story text, dates, place, persona,
 * face filter) and kicks off curation. Selection method + backend URL now live
 * in Profile → Settings, so this hook reads them from the store at submit time.
 */
export function useNewStoryState() {
  const [dateFrom, setDateFrom]   = useState(store.dateFrom);
  const [dateTo, setDateTo]       = useState(store.dateTo);
  const [location, setLocation]   = useState(store.locationName);
  const [storyText, setStoryText] = useState(store.vibe);
  const [persona, setPersona]     = useState<PersonaType | null>(store.persona);
  // Curation engine: false = Auto Select (classic), true = AI (GPT-4o).
  // Initialised from the saved default in Settings; can be overridden per story.
  const [useAi, setUseAi]         = useState(store.method !== 'classic');
  const [identitySet, setIdentitySet] = useState(false);
  const [filterByUserFace, setFilterByUserFace] = useState(store.filterByUserFace);
  const [showRangePicker, setShowRangePicker] = useState(false);

  useEffect(() => {
    loadPersistedPrefs().then(() => {
      setPersona(store.persona);
      setUseAi(store.method !== 'classic');
      setFilterByUserFace(store.filterByUserFace);
    });
    loadIdentity().then((id) => setIdentitySet(!!id));
  }, []);

  // Refresh identity state when returning from face-setup
  useFocusEffect(useCallback(() => {
    loadIdentity().then((id) => {
      setIdentitySet(!!id);
      if (!id && store.filterByUserFace) {
        store.filterByUserFace = false;
        setFilterByUserFace(false);
        persistPrefs();
      } else if (id && !store.filterByUserFace) {
        // Returning from a fresh face setup → enable the filter by default
        store.filterByUserFace = true;
        setFilterByUserFace(true);
        persistPrefs();
      }
    });
  }, []));

  useEffect(() => { store.persona = persona; persistPrefs(); }, [persona]);

  function confirmRange(from: string, to: string) {
    setDateFrom(from);
    setDateTo(to);
    setShowRangePicker(false);
  }

  /** Open the face-setup page to add or change the saved selfie. */
  function openFaceSetup() {
    router.push('/face-setup');
  }

  /** Toggle the filter on/off. With no identity yet, route to setup instead. */
  function setFaceFilter(v: boolean) {
    if (!identitySet) {
      router.push('/face-setup');
      return;
    }
    setFilterByUserFace(v);
    store.filterByUserFace = v;
    persistPrefs();
  }

  function handleNext() {
    store.dateFrom         = dateFrom.trim();
    store.dateTo           = dateTo.trim();
    store.locationName     = location.trim();
    store.vibe             = storyText.trim();
    store.persona          = persona;
    store.contentMix       = persona === 'social' ? 'people' : 'balanced';
    // AI engine defaults to GPT-4o; classic is on-device Auto Select.
    store.method           = useAi ? 'openai' : 'classic';
    clearSession();
    router.push('/processing');
  }

  return {
    dateFrom,
    dateTo,
    location,
    setLocation,
    storyText,
    setStoryText,
    persona,
    setPersona,
    useAi,
    setUseAi,
    identitySet,
    filterByUserFace,
    openFaceSetup,
    setFaceFilter,
    showRangePicker,
    setShowRangePicker,
    confirmRange,
    handleNext,
  };
}
