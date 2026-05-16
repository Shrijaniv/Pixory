import { Image } from 'expo-image';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { registerFace } from '../lib/api';
import {
  FaceIdentity,
  clearIdentity,
  loadIdentity,
  saveIdentity,
} from '../lib/faceIdentity';
import { store } from '../lib/store';

type Status = 'loading' | 'idle' | 'processing' | 'success' | 'error';

export default function FaceSetupScreen() {
  const insets = useSafeAreaInsets();
  const [status, setStatus] = useState<Status>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [currentIdentity, setCurrentIdentity] = useState<FaceIdentity | null>(null);
  const [pickedUri, setPickedUri] = useState<string | null>(null);
  const [pickedBase64, setPickedBase64] = useState<string | null>(null);

  // Load existing identity on mount
  useEffect(() => {
    loadIdentity().then((id) => {
      setCurrentIdentity(id);
      setStatus('idle');
    });
  }, []);

  async function handlePickPhoto() {
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
    setPickedBase64(null); // clear any previous encoding
    setStatus('idle');
    setErrorMsg('');
  }

  async function handleConfirm() {
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
      setPickedBase64(null);
      setStatus('success');
    } catch (e: any) {
      setStatus('error');
      setErrorMsg(e?.message ?? 'Something went wrong');
    }
  }

  async function handleClear() {
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
            const { persistPrefs } = require('../lib/store');
            await persistPrefs();
            setCurrentIdentity(null);
            setPickedUri(null);
            setStatus('idle');
          },
        },
      ]
    );
  }

  if (status === 'loading') {
    return (
      <View style={[styles.root, styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color="#0095F6" />
      </View>
    );
  }

  const showPreview = pickedUri && status !== 'success';

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.headerBack}>‹ Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Who Are You?</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Current identity */}
        {currentIdentity && status !== 'success' && (
          <View style={styles.currentCard}>
            <Image
              source={{ uri: currentIdentity.refPhotoUri }}
              style={styles.currentThumb}
              contentFit="cover"
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.currentTitle}>Identity set ✓</Text>
              <Text style={styles.currentSub}>
                Set {new Date(currentIdentity.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </Text>
              <Text style={styles.currentSub}>Tap "Change photo" to update it</Text>
            </View>
            <Pressable onPress={handleClear} hitSlop={8}>
              <Text style={styles.clearBtn}>Clear</Text>
            </Pressable>
          </View>
        )}

        {/* Success state */}
        {status === 'success' && (
          <View style={styles.successCard}>
            <Text style={styles.successIcon}>✓</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.successTitle}>You're all set!</Text>
              <Text style={styles.successSub}>
                Pixory now knows what you look like. Turn on "Only photos with me" on the home screen to filter your curations.
              </Text>
            </View>
          </View>
        )}

        {/* Explainer */}
        <View style={styles.explainerCard}>
          <Text style={styles.explainerTitle}>How it works</Text>
          <Text style={styles.explainerBody}>
            Pick a photo where your face is clearly visible. Pixory extracts a face signature
            and stores it only on this device — it's never uploaded or shared.{'\n\n'}
            During curation, photos that contain faces but not yours are automatically removed.
            Landscapes, food, and no-face photos are always kept.
          </Text>
        </View>

        {/* Photo preview */}
        {showPreview && (
          <View style={styles.previewSection}>
            <Image
              source={{ uri: pickedUri }}
              style={styles.previewImage}
              contentFit="cover"
            />
            <Text style={styles.previewHint}>Make sure your face is clearly visible and well-lit</Text>
          </View>
        )}

        {/* Error */}
        {status === 'error' && (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>⚠ {errorMsg}</Text>
          </View>
        )}

        {/* Actions */}
        {status !== 'success' && (
          <>
            <Pressable style={styles.pickBtn} onPress={handlePickPhoto} disabled={status === 'processing'}>
              <Text style={styles.pickBtnText}>
                {currentIdentity ? '📷  Change photo' : '📷  Pick a photo of yourself'}
              </Text>
            </Pressable>

            {showPreview && (
              <Pressable
                style={[styles.confirmBtn, status === 'processing' && styles.btnDisabled]}
                onPress={status === 'processing' ? undefined : handleConfirm}
              >
                {status === 'processing' ? (
                  <><ActivityIndicator color="#FFF" /><Text style={styles.confirmBtnText}>  Analysing...</Text></>
                ) : (
                  <Text style={styles.confirmBtnText}>Confirm — That's Me</Text>
                )}
              </Pressable>
            )}
          </>
        )}

        {status === 'success' && (
          <Pressable style={styles.doneBtn} onPress={() => router.back()}>
            <Text style={styles.doneBtnText}>Done</Text>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FAFAFA' },
  center: { alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 13,
    backgroundColor: '#FFF', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#DBDBDB',
  },
  headerBack: { color: '#262626', fontSize: 16, width: 50 },
  headerTitle: { color: '#262626', fontSize: 16, fontWeight: '600' },

  scroll: { padding: 16, gap: 16 },

  // Current identity card
  currentCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#F0FFF4', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: '#BBDDC8',
  },
  currentThumb: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#DDD' },
  currentTitle: { fontSize: 14, fontWeight: '600', color: '#1A472A' },
  currentSub: { fontSize: 12, color: '#4A7C59', marginTop: 2 },
  clearBtn: { color: '#FF3B30', fontSize: 13, fontWeight: '500' },

  // Success state
  successCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    backgroundColor: '#F0FFF4', borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: '#BBDDC8',
  },
  successIcon: { fontSize: 28, color: '#34C759' },
  successTitle: { fontSize: 15, fontWeight: '700', color: '#1A472A', marginBottom: 4 },
  successSub: { fontSize: 13, color: '#4A7C59', lineHeight: 19 },

  // Explainer
  explainerCard: {
    backgroundColor: '#FFF', borderRadius: 12, padding: 16,
    borderWidth: StyleSheet.hairlineWidth, borderColor: '#DBDBDB',
  },
  explainerTitle: { fontSize: 13, fontWeight: '700', color: '#262626', marginBottom: 8 },
  explainerBody: { fontSize: 13, color: '#6E6E6E', lineHeight: 20 },

  // Preview
  previewSection: { alignItems: 'center', gap: 8 },
  previewImage: { width: 220, height: 220, borderRadius: 12, backgroundColor: '#EEE' },
  previewHint: { fontSize: 12, color: '#8E8E8E', textAlign: 'center' },

  // Error
  errorCard: { backgroundColor: '#FFF0F0', borderRadius: 10, padding: 14 },
  errorText: { color: '#FF3B30', fontSize: 13, lineHeight: 18 },

  // Buttons
  pickBtn: {
    backgroundColor: '#F5F5F5', borderRadius: 12, paddingVertical: 15,
    alignItems: 'center', borderWidth: 1.5, borderColor: '#DBDBDB',
  },
  pickBtnText: { fontSize: 15, fontWeight: '600', color: '#262626' },

  confirmBtn: {
    backgroundColor: '#0095F6', borderRadius: 12, paddingVertical: 15,
    alignItems: 'center', flexDirection: 'row', justifyContent: 'center',
  },
  confirmBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  btnDisabled: { opacity: 0.5 },

  doneBtn: {
    backgroundColor: '#34C759', borderRadius: 12, paddingVertical: 15, alignItems: 'center',
  },
  doneBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});
