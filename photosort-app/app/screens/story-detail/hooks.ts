import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Caption, getStory, Story, store } from '../../../lib/store';

/** Loads a Story by id and exposes the reuse actions (re-share / save / duplicate). */
export function useStoryDetailState(id: string | undefined) {
  const [story, setStory] = useState<Story | null>(null);

  useEffect(() => {
    if (id) getStory(id).then(setStory);
  }, [id]);

  /** Hydrate the global store from this story so the Share flow can reuse it. */
  function loadIntoStore() {
    if (!story) return;
    store.selectedPhotos = story.photoUris;
    store.currentStoryId = story.id;
    store.vibe = story.title;
    store.persona = story.persona ?? null;
    if (story.captionText) {
      const caption: Caption = {
        mood: 'story',
        text: story.captionText,
        hashtags: story.hashtags ?? [],
      };
      store.chosenCaption = caption;
    }
  }

  function reshare() {
    loadIntoStore();
    router.push('/publish');
  }

  function saveAgain() {
    loadIntoStore();
    router.push('/publish?intent=save');
  }

  function duplicate() {
    store.vibe = story?.title ?? '';
    store.persona = story?.persona ?? null;
    router.push('/new-story');
  }

  return { story, reshare, saveAgain, duplicate };
}
