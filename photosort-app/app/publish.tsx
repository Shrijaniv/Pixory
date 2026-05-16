import { Image } from 'expo-image';
import * as ImageManipulator from 'expo-image-manipulator';
import * as MediaLibrary from 'expo-media-library';
import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Clipboard,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { publishFromDevice } from '../lib/api';
import { store } from '../lib/store';

const SCREEN_W = Dimensions.get('window').width;
const PREVIEW_H = 240;
const IG_USER_KEY = 'ig_username';
const IG_PASS_KEY = 'ig_password';

type SaveStatus = 'idle' | 'saving' | 'success' | 'error';
type IgStatus = 'idle' | 'posting' | 'success' | 'error';

export default function PublishScreen() {
  const insets = useSafeAreaInsets();
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

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12} disabled={saveBusy || igBusy}>
            <Text style={[styles.headerBack, (saveBusy || igBusy) && { color: '#CCC' }]}>‹ Back</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Share</Text>
          <View style={{ width: 50 }} />
        </View>

        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 40 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Photo carousel preview */}
          <View style={styles.previewSection}>
            <ScrollView
              horizontal pagingEnabled showsHorizontalScrollIndicator={false}
              style={{ height: PREVIEW_H }}
              onMomentumScrollEnd={(e) => setCurrentIdx(Math.round(e.nativeEvent.contentOffset.x / SCREEN_W))}
            >
              {photos.map((uri) => (
                <Image key={uri} source={{ uri }} style={{ width: SCREEN_W, height: PREVIEW_H }} contentFit="cover" />
              ))}
            </ScrollView>
            <View style={styles.dotsRow}>
              {photos.slice(0, 10).map((_, i) => (
                <View key={i} style={[styles.dot, i === currentIdx && styles.dotActive]} />
              ))}
            </View>
            <Text style={styles.carouselHint}>{photos.length} photo{photos.length !== 1 ? 's' : ''} · swipe to preview</Text>
          </View>

          {/* Caption preview + copy */}
          <View style={styles.captionCard}>
            <Text style={styles.captionLabel}>CAPTION</Text>
            <Text style={styles.captionText}>{captionText || 'No caption'}</Text>
            <Pressable style={styles.copyBtn} onPress={handleCopyCaption}>
              <Text style={styles.copyBtnText}>Copy Caption</Text>
            </Pressable>
          </View>

          {/* ── Option A: Save to Photos ─────────────────────────────────── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Option A — Save to Photos Album</Text>
            <Text style={styles.sectionHint}>
              Creates a <Text style={styles.bold}>Pixory</Text> album in your Photos app. Then open Instagram → New Post → Select Multiple → pick from the album.
            </Text>

            {saveStatus === 'error' && (
              <View style={styles.errorBox}><Text style={styles.errorText}>{saveMsg}</Text></View>
            )}

            {saveStatus === 'success' ? (
              <View style={styles.successInline}>
                <Text style={styles.successInlineIcon}>✓</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.successInlineTitle}>Saved to "{albumName}"</Text>
                  <Text style={styles.successInlineSub}>Open Instagram → ＋ → Select Multiple → "{albumName}" album → paste caption</Text>
                </View>
              </View>
            ) : (
              <Pressable
                style={[styles.primaryBtn, saveBusy && styles.btnDisabled]}
                onPress={!saveBusy ? handleSaveToPhotos : undefined}
              >
                {saveBusy
                  ? <><ActivityIndicator color="#FFF" /><Text style={styles.primaryBtnText}>  {saveMsg}</Text></>
                  : <Text style={styles.primaryBtnText}>📷  Save {photos.length} Photos to Album</Text>
                }
              </Pressable>
            )}
          </View>

          {/* ── Option B: Post directly to Instagram ─────────────────────── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Option B — Post Directly to Instagram</Text>
            <Text style={styles.sectionHint}>
              Posts the carousel straight from the app via your Instagram account. Credentials are saved securely on this device.
            </Text>

            {igConnected ? (
              /* Connected state — show username, offer disconnect */
              <View style={styles.connectedRow}>
                <View style={styles.connectedAvatar}>
                  <Text style={styles.connectedAvatarText}>{igUsername[0]?.toUpperCase() ?? '@'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.connectedName}>@{igUsername}</Text>
                  <Text style={styles.connectedSub}>Credentials saved</Text>
                </View>
                <Pressable onPress={handleDisconnect} hitSlop={8}>
                  <Text style={styles.disconnectBtn}>Disconnect</Text>
                </Pressable>
              </View>
            ) : (
              /* Not connected — show login form */
              <View style={styles.credFields}>
                <TextInput
                  style={styles.input}
                  placeholder="Instagram username"
                  placeholderTextColor="#8E8E8E"
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={igUsername}
                  onChangeText={setIgUsername}
                  editable={!igBusy}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Password"
                  placeholderTextColor="#8E8E8E"
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={igPassword}
                  onChangeText={setIgPassword}
                  editable={!igBusy}
                />
              </View>
            )}

            {igStatus === 'error' && (
              <View style={styles.errorBox}><Text style={styles.errorText}>{igMsg}</Text></View>
            )}

            {igStatus === 'success' ? (
              <View style={styles.successInline}>
                <Text style={styles.successInlineIcon}>✓</Text>
                <Text style={styles.successInlineTitle}>{igMsg}</Text>
              </View>
            ) : (
              <Pressable
                style={[styles.igBtn, igBusy && styles.btnDisabled]}
                onPress={!igBusy ? handlePostToInstagram : undefined}
              >
                {igBusy
                  ? <><ActivityIndicator color="#FFF" /><Text style={styles.igBtnText}>  {igMsg}</Text></>
                  : <Text style={styles.igBtnText}>Post to Instagram</Text>
                }
              </Pressable>
            )}

            {!igConnected && (
              <Text style={styles.privacyNote}>
                Your password is stored only on this device using iOS Secure Enclave and is never sent anywhere except directly to Instagram.
              </Text>
            )}
          </View>

          {(saveStatus === 'success' || igStatus === 'success') && (
            <Pressable style={styles.doneBtn} onPress={() => router.replace('/')}>
              <Text style={styles.doneBtnText}>Done</Text>
            </Pressable>
          )}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FAFAFA' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 13,
    backgroundColor: '#FFF', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#DBDBDB',
  },
  headerBack: { color: '#262626', fontSize: 16, width: 50 },
  headerTitle: { color: '#262626', fontSize: 16, fontWeight: '600' },
  scroll: { gap: 0 },

  previewSection: { backgroundColor: '#000' },
  dotsRow: { flexDirection: 'row', justifyContent: 'center', gap: 5, paddingVertical: 8 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.3)' },
  dotActive: { backgroundColor: '#FFF', width: 18 },
  carouselHint: { color: '#8E8E8E', fontSize: 12, textAlign: 'center', paddingBottom: 10 },

  captionCard: {
    backgroundColor: '#FFF', margin: 12, borderRadius: 12,
    padding: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: '#DBDBDB',
  },
  captionLabel: { fontSize: 10, fontWeight: '700', color: '#8E8E8E', letterSpacing: 0.8, marginBottom: 8 },
  captionText: { fontSize: 14, color: '#262626', lineHeight: 21, marginBottom: 12 },
  copyBtn: {
    borderWidth: 1.5, borderColor: '#0095F6', borderRadius: 8,
    paddingVertical: 9, alignItems: 'center',
  },
  copyBtnText: { color: '#0095F6', fontSize: 14, fontWeight: '600' },

  section: {
    backgroundColor: '#FFF', marginHorizontal: 12, marginBottom: 12, borderRadius: 12,
    padding: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: '#DBDBDB', gap: 12,
  },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#262626' },
  sectionHint: { fontSize: 13, color: '#8E8E8E', lineHeight: 19 },
  bold: { fontWeight: '700', color: '#262626' },

  errorBox: { backgroundColor: '#FFF0F0', borderRadius: 8, padding: 12 },
  errorText: { color: '#FF3B30', fontSize: 13, lineHeight: 18 },

  primaryBtn: {
    backgroundColor: '#0095F6', borderRadius: 10,
    paddingVertical: 15, alignItems: 'center', flexDirection: 'row', justifyContent: 'center',
  },
  primaryBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },

  // Instagram gradient-ish button
  igBtn: {
    borderRadius: 10, paddingVertical: 15, alignItems: 'center',
    flexDirection: 'row', justifyContent: 'center',
    backgroundColor: '#C13584', // Instagram brand purple-pink
  },
  igBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },

  btnDisabled: { opacity: 0.5 },

  // Connected state
  connectedRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#F5F5F5', borderRadius: 10, padding: 12,
  },
  connectedAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#C13584', alignItems: 'center', justifyContent: 'center',
  },
  connectedAvatarText: { color: '#FFF', fontSize: 18, fontWeight: '700' },
  connectedName: { color: '#262626', fontSize: 14, fontWeight: '600' },
  connectedSub: { color: '#8E8E8E', fontSize: 12, marginTop: 1 },
  disconnectBtn: { color: '#FF3B30', fontSize: 13, fontWeight: '500' },

  // Credential inputs
  credFields: { gap: 10 },
  input: {
    backgroundColor: '#F5F5F5', borderRadius: 10, paddingHorizontal: 14,
    paddingVertical: 13, fontSize: 14, color: '#262626',
    borderWidth: StyleSheet.hairlineWidth, borderColor: '#DBDBDB',
  },

  privacyNote: { fontSize: 11, color: '#AAAAAA', lineHeight: 16, textAlign: 'center' },

  // Inline success
  successInline: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  successInlineIcon: { fontSize: 22, color: '#34C759' },
  successInlineTitle: { fontSize: 14, fontWeight: '600', color: '#262626', flex: 1, flexWrap: 'wrap' },
  successInlineSub: { fontSize: 12, color: '#8E8E8E', marginTop: 3, lineHeight: 17 },

  doneBtn: {
    marginHorizontal: 12, marginTop: 4,
    backgroundColor: '#34C759', borderRadius: 10, paddingVertical: 15, alignItems: 'center',
  },
  doneBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});
