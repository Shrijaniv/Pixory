import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { registerFace } from '../../../lib/api';
import {
  FaceIdentity,
  IdentityEngine,
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
      mediaTypes: ['images'],
      allowsEditing: false,  // no crop — let DeepFace work on the full photo
      quality: 0.9,
      base64: false,    // we'll encode manually after resize
    });

    if (result.canceled || !result.assets[0]) return;
    setPickedUri(result.assets[0].uri);
    setStatus('idle');
    setErrorMsg('');
  }

  async function takePhoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Camera needed', 'Allow camera access to take a selfie.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      cameraType: ImagePicker.CameraType.front,
      allowsEditing: false,
      quality: 0.9,
      base64: false,
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
      // Resize to 1024px — larger than curation candidates so DeepFace has
      // enough resolution to detect faces that aren't filling the whole frame
      const manipulated = await ImageManipulator.manipulateAsync(
        pickedUri,
        [{ resize: { width: 1024 } }],
        { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );

      if (!manipulated.base64) throw new Error('Failed to encode photo');

      const engine: IdentityEngine = store.faceEngine;
      let result;
      try {
        result = await registerFace({
          photoBase64: manipulated.base64,
          backendUrl: store.backendUrl,
          faceEngine: engine,
        });
      } catch (netErr: any) {
        // Surface the exact URL so connection problems are diagnosable
        throw new Error(`Can't reach backend at ${store.backendUrl} — ${netErr?.message ?? 'network error'}`);
      }
      if (!result.success || !result.embedding) {
        throw new Error(result.error ?? 'No face detected');
      }

      const identity: FaceIdentity = {
        embedding: result.embedding,
        embeddings: { [engine]: result.embedding },
        engine,
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
    takePhoto,
    confirmIdentity,
    clearIdentityHandler,
    goBack: () => router.back(),
  };
}
