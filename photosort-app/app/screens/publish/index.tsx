import { Image } from 'expo-image';
import { router } from 'expo-router';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePublishState } from './hooks';
import { styles } from './styles';
import { PREVIEW_H, SCREEN_W } from './types';

export default function PublishScreen() {
  const insets = useSafeAreaInsets();
  const {
    currentIdx,
    setCurrentIdx,
    photos,
    saveStatus,
    saveMsg,
    albumName,
    saveBusy,
    handleSaveToPhotos,
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
    captionText,
    handleCopyCaption,
  } = usePublishState();

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
              {[...new Set(photos)].map((uri, i) => (
                <Image key={`${uri}-${i}`} source={{ uri }} style={{ width: SCREEN_W, height: PREVIEW_H }} contentFit="cover" />
              ))}
            </ScrollView>
            <View style={styles.dotsRow}>
              {[...new Set(photos)].slice(0, 10).map((_, i) => (
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
