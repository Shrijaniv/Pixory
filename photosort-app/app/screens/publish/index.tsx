import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenHeader } from '../../../components/ui';
import { store } from '../../../lib/store';
import { Gradients } from '../../../lib/theme';
import { usePublishState } from './hooks';
import { styles } from './styles';

export default function PublishScreen() {
  const insets = useSafeAreaInsets();
  const { intent } = useLocalSearchParams<{ intent?: string }>();
  const {
    photos,
    saveStatus,
    saveMsg,
    saveBusy,
    handleSaveToPhotos,
    igStatus,
    igMsg,
    igConnected,
    igBusy,
    handlePostToInstagram,
    captionText,
  } = usePublishState();

  // Navigate to Success when an action completes
  useEffect(() => {
    if (igStatus === 'success') router.replace('/success?mode=publish');
  }, [igStatus]);
  useEffect(() => {
    if (saveStatus === 'success') router.replace('/success?mode=save');
  }, [saveStatus]);

  // Story Detail "Save again" deep-links here with intent=save → auto-run once
  const autoRan = useRef(false);
  useEffect(() => {
    if (intent === 'save' && !autoRan.current) {
      autoRan.current = true;
      handleSaveToPhotos();
    }
  }, [intent]);

  function onPostToInstagram() {
    if (igConnected) handlePostToInstagram();
    else router.push('/instagram-connect');
  }

  const busy = saveBusy || igBusy;
  const title = store.vibe || 'Your story';

  return (
    <View style={styles.root}>
      <ScreenHeader title="Ready to share" onBack={() => router.back()} />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Confirm strip */}
        <View style={styles.confirm}>
          <View style={styles.coverWrap}>
            {photos[0] ? (
              <Image source={{ uri: photos[0] }} style={styles.cover} contentFit="cover" cachePolicy="memory-disk" />
            ) : (
              <View style={styles.cover} />
            )}
            <View style={styles.coverBadge}><Text style={styles.coverBadgeText}>{photos.length}</Text></View>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.confirmTitle} numberOfLines={1}>{title}</Text>
            <Text style={styles.confirmMeta}>{photos.length} photos · carousel</Text>
            {captionText ? <Text style={styles.confirmReady}>✓ Caption ready</Text> : null}
          </View>
        </View>

        {/* Action 1 — Post to Instagram */}
        <Pressable onPress={onPostToInstagram} disabled={busy}>
          <LinearGradient colors={Gradients.accentHero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.actionPrimary}>
            <Text style={styles.actionIcon}>↗</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.actionPrimaryTitle}>Post to Instagram</Text>
              <Text style={styles.actionPrimarySub}>Connect once · publishes the carousel</Text>
            </View>
            {igBusy ? <ActivityIndicator color="#FFF" /> : <Text style={styles.actionChevron}>›</Text>}
          </LinearGradient>
        </Pressable>

        {/* Action 2 — Save to Pixory album */}
        <Pressable style={styles.actionSecondary} onPress={handleSaveToPhotos} disabled={busy}>
          <Text style={styles.actionIconDark}>⤓</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.actionSecondaryTitle}>Save to Pixory album</Text>
            <Text style={styles.actionSecondarySub}>Post later, straight from Photos</Text>
          </View>
          {saveBusy ? <ActivityIndicator color="#FFF" /> : <Text style={styles.actionChevronDark}>›</Text>}
        </Pressable>

        {(saveMsg || igMsg) ? <Text style={styles.status}>{saveMsg || igMsg}</Text> : null}

        {/* Privacy */}
        <View style={styles.privacy}>
          <Text style={styles.privacyText}>🔒  Instagram login stays on-device. Nothing is sent anywhere except to Instagram.</Text>
        </View>
      </ScrollView>
    </View>
  );
}
