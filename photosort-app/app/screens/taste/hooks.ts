import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { computeTasteProfile, loadLearningHistory, TasteProfile } from '../../../lib/learning';

export function useTasteState() {
  const [profile, setProfile] = useState<TasteProfile | null>(null);

  useFocusEffect(useCallback(() => {
    loadLearningHistory().then((h) => setProfile(computeTasteProfile(h)));
  }, []));

  return { profile };
}
