import * as ImageManipulator from 'expo-image-manipulator';
import * as MediaLibrary from 'expo-media-library';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useEffect, useState } from 'react';
import { Alert, Clipboard } from 'react-native';
import { publishFromDevice } from '../../../lib/api';
import { store } from '../../../lib/store';
import { IG_PASS_KEY, IG_USER_KEY, IgStatus, SaveStatus } from './types';

export function usePublishState() {
  const [currentIdx, setCurrentIdx] = useState(0);

  // ── Photos album state ────────────────────────────────────────────────────
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [saveMsg, setSaveMsg] = useState('');
  const [albumName, setAlbumName] = useState('');

  // ── Instagram direct post state ───────────────────────────────────────────
  const [igUsername, setIgUsername] = useState('');
  const [igPassword, setIgPassword] = useState('');
  const [igStatus, setIgStatus] = useState<IgStatus>('idle');
  const [igMsg, setIgMsg] = useState('');
  const [igConnected, setIgConnected] = useState(false); // credentials saved

  const caption = store.chosenCaption;
  const captionText = caption
    ? [
        caption.text,
        caption.hashtags.length ? caption.hashtags.map((h) => `#${h}`).join(' ') : '',
        store.postLocation ? `📍 ${store.postLocation}` : '',
        'Curated with Pixory ✨',
      ].filter(Boolean).join('\n\n')
    : '';
  const photos = store.selectedPhotos;

  // Load saved Instagram credentials on mount
  useEffect(() => {
    (async () => {
      try {
        const u = await SecureStore.getItemAsync(IG_USER_KEY);
        const p = await SecureStore.getItemAsync(IG_PASS_KEY);
        if (u && p) {
          setIgUsername(u);
          setIgPassword(p);
          setIgConnected(true);
        }
      } catch { /* no saved creds */ }
    })();
  }, []);

  // ── Save to Photos ────────────────────────────────────────────────────────

  async function handleSaveToPhotos() {
    setSaveStatus('saving');
    setSaveMsg('Requesting permission...');
    try {
      const { status: perm } = await MediaLibrary.requestPermissionsAsync();
      if (perm !== 'granted') throw new Error('Photos permission denied. Enable it in Settings → Privacy → Photos.');

      const savedAssets: MediaLibrary.Asset[] = [];
      for (let i = 0; i < photos.length; i++) {
        setSaveMsg(`Saving photo ${i + 1} of ${photos.length}...`);
        const manipulated = await ImageManipulator.manipulateAsync(
          photos[i], [], { compress: 0.95, format: ImageManipulator.SaveFormat.JPEG }
        );
        savedAssets.push(await MediaLibrary.createAssetAsync(manipulated.uri));
      }

      const date = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const name = `Pixory ${date}`;
      setSaveMsg(`Creating album "${name}"...`);
      const album = await MediaLibrary.createAlbumAsync(name, savedAssets[0], true);
      if (savedAssets.length > 1) await MediaLibrary.addAssetsToAlbumAsync(savedAssets.slice(1), album, true);

      setAlbumName(name);
      setSaveStatus('success');
      setSaveMsg('');
      // Auto-copy caption
      if (captionText) Clipboard.setString(captionText);
    } catch (e: any) {
      setSaveStatus('error');
      setSaveMsg(e?.message ?? 'Failed to save photos');
    }
  }

  // ── Post to Instagram directly ────────────────────────────────────────────

  async function handlePostToInstagram() {
    if (!igUsername.trim() || !igPassword.trim()) {
      Alert.alert('Missing credentials', 'Enter your Instagram username and password.');
      return;
    }
    if (!store.backendUrl) {
      Alert.alert('No backend', 'Set your backend URL on the home screen first.');
      return;
    }

    setIgStatus('posting');
    setIgMsg('Converting photos...');

    try {
      // Save credentials for next time
      await SecureStore.setItemAsync(IG_USER_KEY, igUsername.trim());
      await SecureStore.setItemAsync(IG_PASS_KEY, igPassword);
      setIgConnected(true);

      // Convert to JPEG for instagram-private-api
      const photosBase64: string[] = [];
      for (let i = 0; i < photos.length; i++) {
        setIgMsg(`Converting ${i + 1}/${photos.length}...`);
        const m = await ImageManipulator.manipulateAsync(
          photos[i],
          [{ resize: { width: 1080 } }],
          { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG, base64: true }
        );
        if (m.base64) photosBase64.push(m.base64);
      }

      setIgMsg('Posting to Instagram...');
      const result = await publishFromDevice({
        photosBase64,
        caption: captionText,
        username: igUsername.trim(),
        password: igPassword,
        backendUrl: store.backendUrl,
        // Pass GPS coords so instagrapi can tag the post with an Instagram location
        locationLat: store.locationLat ?? undefined,
        locationLon: store.locationLon ?? undefined,
        locationName: store.postLocation || store.locationName || undefined,
      });

      if (!result.success) throw new Error(result.error ?? 'Post failed');

      setIgStatus('success');
      setIgMsg(result.post_id ? `Posted! ID: ${result.post_id}` : 'Posted successfully!');
    } catch (e: any) {
      setIgStatus('error');
      setIgMsg(e?.message ?? 'Failed to post');
    }
  }

  async function handleDisconnect() {
    Alert.alert('Disconnect Instagram', 'Remove saved credentials?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Disconnect', style: 'destructive', onPress: async () => {
          await SecureStore.deleteItemAsync(IG_USER_KEY);
          await SecureStore.deleteItemAsync(IG_PASS_KEY);
          // Also clear session on backend
          if (store.backendUrl && igUsername) {
            fetch(`${store.backendUrl}/api/session/${igUsername}`, { method: 'DELETE' }).catch(() => {});
          }
          setIgUsername('');
          setIgPassword('');
          setIgConnected(false);
          setIgStatus('idle');
          setIgMsg('');
        },
      },
    ]);
  }

  function handleCopyCaption() {
    Clipboard.setString(captionText);
    Alert.alert('Copied', 'Caption copied to clipboard.');
  }

  const saveBusy = saveStatus === 'saving';
  const igBusy = igStatus === 'posting';

  return {
    // Carousel
    currentIdx,
    setCurrentIdx,
    photos,
    // Save to Photos
    saveStatus,
    saveMsg,
    albumName,
    saveBusy,
    handleSaveToPhotos,
    // Instagram
    igUsername,
    setIgUsername,
    igPassword,
    setIgPassword,
    igStatus,
    igMsg,
    igConnected,
    igBusy,
    handlePostToInstagram,
    handleDisconnect,
    // Caption
    captionText,
    handleCopyCaption,
  };
}
