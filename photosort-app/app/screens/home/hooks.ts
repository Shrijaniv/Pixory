import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import { loadIdentity } from '../../../lib/identity';
import { deleteStory, loadPersistedPrefs, loadStories, Story, store } from '../../../lib/store';

/** Max stories shown on the Home hub. */
export const HOME_STORY_LIMIT = 4;

/**
 * Home hub state — loads the stories history and the user's avatar.
 * Refreshes on focus so a newly published/saved story appears on return.
 */
export function useHomeState() {
  const [stories, setStories] = useState<Story[]>([]);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);

  const refresh = useCallback(() => {
    loadStories().then(setStories);
    loadPersistedPrefs().then(() => setAvatarUri(store.profilePhotoUri));
    // Fall back to the face-identity reference photo if no profile photo is set
    if (!store.profilePhotoUri) {
      loadIdentity().then((id) => setAvatarUri((prev) => prev ?? id?.refPhotoUri ?? null));
    }
  }, []);

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  function openStory(story: Story) {
    if (story.status === 'published') {
      router.push(`/story-detail?id=${story.id}`);
    } else {
      // Draft → resume in review (selection snapshot lives in the store/session)
      store.selectedPhotos = story.photoUris;
      store.currentStoryId = story.id;
      router.push('/review');
    }
  }

  function confirmDelete(story: Story) {
    Alert.alert(
      'Delete story',
      `Remove “${story.title}”? This can’t be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => { await deleteStory(story.id); refresh(); },
        },
      ],
    );
  }

  // Only the most recent stories are surfaced on the hub.
  const visibleStories = stories.slice(0, HOME_STORY_LIMIT);

  return { stories: visibleStories, avatarUri, refresh, openStory, confirmDelete };
}
