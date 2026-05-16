import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { registerFace } from '../../../lib/api';
import {
  FaceIdentity,
  clearIdentity,
  loadIdentity,
  saveIdentity,
} from '../../../lib/identity';
import { store } from '../../../lib/store';
import { Status } from './types';

export function useFaceSetupState() {
  const [status, setStatus] = useState<Status>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [currentIdentity, setCurrentIdentity] = useState<FaceIdentity | null>(null);
  const [pickedUri, setPickedUri] = useState<string | null>(null);

  // Load existing identity on mount
  useEffect(() => {
    loadIdentity().then((id) => {
      setCurrentIdentity(id);
      setStatus('idle');
    });
  }, []);

  async function pickPhoto() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow photo access so you can pick a reference photo.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],   // square crop encourages a clear face shot
      quality: 0.9,
      base64: false,    // we'll encode manually after resize
    });

    if (result.canceled || !result.assets[0]) return;
    setPickedUri(result.assets[0].uri);
    setStatus('idle');
    setErrorMsg('');
  }

  async function confirmIdentity() {
    if (!pickedUri) return;

    setStatus('processing');
    setErrorMsg('');

    try {
      // Resize to 512px before sending — keeps payload small, sufficient for Facenet
      const manipulated = await ImageManipulator.manipulateAsync(
        pickedUri,
        [{ resize: { width: 512 } }],
        { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );

      if (!manipulated.base64) throw new Error('Failed to encode photo');

      const result = await registerFace({
        photoBase64: manipulated.base64,
        backendUrl: store.backendUrl,
      });

      if (!result.success || !result.embedding) {
        throw new Error(result.error ?? 'No face detected');
      }

      // Save identity locally — embedding + reference photo URI
      const identity: FaceIdentity = {
        embedding: result.embedding,
        refPhotoUri: pickedUri,
        createdAt: Date.now(),
      };
      await saveIdentity(identity);
      setCurrentIdentity(identity);
      setPickedUri(null);
      setStatus('success');
    } catch (e: any) {
      setStatus('error');
      setErrorMsg(e?.message ?? 'Something went wrong');
    }
  }

  async function clearIdentityHandler() {
    Alert.alert(
      'Clear identity',
      'Remove your saved face? The "Only photos with me" filter will be disabled until you set up again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            await clearIdentity();
            // Also turn off the filter so processing.tsx doesn't try to use a missing identity
            store.filterByUserFace = false;
            const { persistPrefs } = require('../../../lib/store');
            await persistPrefs();
            setCurrentIdentity(null);
            setPickedUri(null);
            setStatus('idle');
          },
        },
      ]
    );
  }

  return {
    status,
    errorMsg,
    currentIdentity,
    pickedUri,
    pickPhoto,
    confirmIdentity,
    clearIdentityHandler,
    goBack: () => router.back(),
  };
}
