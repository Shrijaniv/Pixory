import { router } from 'expo-router';
import { useState } from 'react';
import { Caption, store } from '../../../lib/store';
import { PIXORY_CREDIT } from './types';

export function useCaptionState() {
  const captions: Caption[] = store.captions;
  const [selectedMood, setSelectedMood] = useState<string>(
    captions[0]?.mood ?? 'wanderlust'
  );
  const chosen = captions.find((c) => c.mood === selectedMood) ?? captions[0];
  const [editedText, setEditedText] = useState(chosen?.text ?? '');
  const [showHashtags, setShowHashtags] = useState(true);
  const [postLocation, setPostLocation] = useState(
    store.postLocation || store.locationName || ''
  );

  const fullCaption = [
    editedText,
    showHashtags && chosen?.hashtags?.length
      ? '\n\n' + chosen.hashtags.map((h) => `#${h}`).join(' ')
      : '',
    '\n\n' + PIXORY_CREDIT,
  ].join('');

  function handleMoodSelect(mood: string) {
    const cap = captions.find((c) => c.mood === mood);
    if (cap) {
      setSelectedMood(mood);
      setEditedText(cap.text);
    }
  }

  function handleShare() {
    store.postLocation = postLocation.trim();
    store.chosenCaption = {
      mood: selectedMood,
      text: editedText,
      hashtags: showHashtags ? (chosen?.hashtags ?? []) : [],
    };
    router.push('/publish');
  }

  return {
    captions,
    selectedMood,
    editedText,
    setEditedText,
    showHashtags,
    setShowHashtags,
    postLocation,
    setPostLocation,
    chosen,
    fullCaption,
    handleMoodSelect,
    handleShare,
  };
}
