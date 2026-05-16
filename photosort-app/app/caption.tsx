import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import {
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
import { Caption, store } from '../lib/store';

const SCREEN_W = Dimensions.get('window').width;
const THUMB_SIZE = 56;

const MOOD_META: Record<string, { icon: string; color: string }> = {
  wanderlust: { icon: '✈️', color: '#FF6B35' },
  minimal:    { icon: '◻', color: '#555555' },
  story:      { icon: '📖', color: '#A855F7' },
  playful:    { icon: '🎉', color: '#0095F6' },
};

export default function CaptionScreen() {
  const insets = useSafeAreaInsets();
  const captions: Caption[] = store.captions;
  const [selectedMood, setSelectedMood] = useState<string>(
    captions[0]?.mood ?? 'wanderlust'
  );
  const chosen = captions.find((c) => c.mood === selectedMood) ?? captions[0];
  const [editedText, setEditedText] = useState(chosen?.text ?? '');
  const [showHashtags, setShowHashtags] = useState(true);
  // Pre-fill location from home page location if none already set
  const [postLocation, setPostLocation] = useState(
    store.postLocation || store.locationName || ''
  );

  const PIXORY_CREDIT = 'Curated with Pixory ✨';

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
    // Keep the home-page GPS coords for the Instagram location tag.
    // If the user edited the text to something different, we still use
    // the geocoded coords from the home screen (best approximation).
    store.chosenCaption = {
      mood: selectedMood,
      text: editedText,
      hashtags: showHashtags ? (chosen?.hashtags ?? []) : [],
    };
    router.push('/publish');
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.headerBack}>‹ Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Write Caption</Text>
        <Pressable onPress={handleShare} hitSlop={12}>
          <Text style={styles.headerShare}>Share</Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        >
          {/* Selected photos horizontal strip */}
          <View style={styles.photosStrip}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photosRow}>
              {store.selectedPhotos.map((path) => (
                <Image
                  key={path}
                  source={{ uri: path }}
                  style={styles.photoThumb}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                />
              ))}
            </ScrollView>
            <Text style={styles.photoCount}>
              {store.selectedPhotos.length} photo{store.selectedPhotos.length !== 1 ? 's' : ''}
            </Text>
          </View>

          {/* Mood tabs */}
          {captions.length > 0 && (
            <View style={styles.moodSection}>
              <Text style={styles.sectionLabel}>Caption Style</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.moodRow}>
                {captions.map((c) => {
                  const meta = MOOD_META[c.mood] ?? { icon: '✦', color: '#8E8E8E' };
                  const active = selectedMood === c.mood;
                  return (
                    <Pressable
                      key={c.mood}
                      style={[
                        styles.moodChip,
                        active && { backgroundColor: meta.color, borderColor: meta.color },
                      ]}
                      onPress={() => handleMoodSelect(c.mood)}
                    >
                      <Text style={styles.moodIcon}>{meta.icon}</Text>
                      <Text style={[styles.moodLabel, active && styles.moodLabelActive]}>
                        {c.mood.charAt(0).toUpperCase() + c.mood.slice(1)}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* Caption editor */}
          <View style={styles.editorSection}>
            <View style={styles.editorHeader}>
              <Text style={styles.sectionLabel}>Caption</Text>
              <Text style={styles.charCount}>{editedText.length} chars</Text>
            </View>
            <TextInput
              style={styles.captionEditor}
              value={editedText}
              onChangeText={setEditedText}
              multiline
              placeholder="Write a caption..."
              placeholderTextColor="#8E8E8E"
              textAlignVertical="top"
              scrollEnabled={false}
            />
          </View>

          {/* Hashtags toggle */}
          {chosen?.hashtags?.length ? (
            <View style={styles.hashtagsSection}>
              <View style={styles.hashtagsHeader}>
                <Text style={styles.sectionLabel}>Hashtags</Text>
                <Pressable onPress={() => setShowHashtags((v) => !v)} style={styles.toggleBtn}>
                  <View style={[styles.toggleTrack, showHashtags && styles.toggleTrackOn]}>
                    <View style={[styles.toggleThumb, showHashtags && styles.toggleThumbOn]} />
                  </View>
                </Pressable>
              </View>
              {showHashtags && (
                <Text style={styles.hashtagsText}>
                  {chosen.hashtags.map((h) => `#${h}`).join('  ')}
                </Text>
              )}
            </View>
          ) : null}

          {/* Location tag */}
          <View style={styles.hashtagsSection}>
            <Text style={styles.sectionLabel}>Add Location</Text>
            <TextInput
              style={styles.locationInput}
              placeholder="e.g. Tokyo, Japan"
              placeholderTextColor="#C7C7CC"
              value={postLocation}
              onChangeText={(text) => {
                setPostLocation(text);
                store.postLocation = text;
              }}
              returnKeyType="done"
            />
          </View>

          {/* Pixory credit — always on, not optional */}
          <View style={styles.creditRow}>
            <Text style={styles.creditText}>✨ Curated with Pixory</Text>
          </View>

          {/* Preview box */}
          <View style={styles.previewSection}>
            <Text style={styles.sectionLabel}>Preview</Text>
            <View style={styles.previewCard}>
              {/* IG-style post header */}
              <View style={styles.previewPostHeader}>
                <View style={styles.previewAvatar}>
                  <Text style={styles.previewAvatarText}>You</Text>
                </View>
                <Text style={styles.previewUsername}>your_account</Text>
              </View>
              {/* Photo strip */}
              <View style={styles.previewImageSlot}>
                {store.selectedPhotos[0] ? (
                  <Image
                    source={{ uri: store.selectedPhotos[0] }}
                    style={styles.previewImage}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                  />
                ) : null}
                {store.selectedPhotos.length > 1 && (
                  <View style={styles.carouselBadge}>
                    <Text style={styles.carouselBadgeText}>1/{store.selectedPhotos.length}</Text>
                  </View>
                )}
              </View>
              {/* Caption preview */}
              <View style={styles.previewCaption}>
                <Text style={styles.previewCaptionText} numberOfLines={4}>
                  {fullCaption}
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 13,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#DBDBDB',
  },
  headerBack: {
    color: '#262626',
    fontSize: 16,
  },
  headerTitle: {
    color: '#262626',
    fontSize: 16,
    fontWeight: '600',
  },
  headerShare: {
    color: '#0095F6',
    fontSize: 16,
    fontWeight: '600',
  },
  photosStrip: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#DBDBDB',
    paddingVertical: 12,
  },
  photosRow: {
    paddingHorizontal: 14,
    gap: 6,
  },
  photoThumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: 6,
    backgroundColor: '#EEE',
  },
  photoCount: {
    paddingHorizontal: 14,
    paddingTop: 8,
    fontSize: 12,
    color: '#8E8E8E',
  },
  moodSection: {
    backgroundColor: '#FFFFFF',
    marginTop: 12,
    paddingTop: 14,
    paddingBottom: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#DBDBDB',
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8E8E8E',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  moodRow: {
    paddingHorizontal: 14,
    gap: 8,
    paddingBottom: 14,
  },
  moodChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#DBDBDB',
    backgroundColor: '#FAFAFA',
  },
  moodIcon: {
    fontSize: 14,
  },
  moodLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#262626',
  },
  moodLabelActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  editorSection: {
    backgroundColor: '#FFFFFF',
    marginTop: 12,
    paddingTop: 14,
    paddingBottom: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#DBDBDB',
  },
  editorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingRight: 16,
    marginBottom: 10,
  },
  charCount: {
    fontSize: 11,
    color: '#C7C7CC',
  },
  captionEditor: {
    marginHorizontal: 16,
    fontSize: 15,
    color: '#262626',
    lineHeight: 22,
    minHeight: 100,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#DBDBDB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FAFAFA',
  },
  hashtagsSection: {
    backgroundColor: '#FFFFFF',
    marginTop: 12,
    paddingTop: 14,
    paddingBottom: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#DBDBDB',
  },
  hashtagsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingRight: 16,
    marginBottom: 10,
  },
  toggleBtn: {
    padding: 4,
  },
  toggleTrack: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E5E5EA',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleTrackOn: {
    backgroundColor: '#34C759',
  },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleThumbOn: {
    transform: [{ translateX: 20 }],
  },
  locationInput: {
    marginTop: 8,
    marginHorizontal: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#DBDBDB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1C1C1E',
    backgroundColor: '#F9F9F9',
  },
  creditRow: {
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#DBDBDB',
    backgroundColor: '#FFFFFF',
  },
  creditText: {
    fontSize: 13,
    color: '#8E8E8E',
  },
  hashtagsText: {
    paddingHorizontal: 16,
    fontSize: 14,
    color: '#0095F6',
    lineHeight: 22,
  },
  previewSection: {
    marginTop: 12,
    paddingTop: 14,
    backgroundColor: '#FFFFFF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#DBDBDB',
  },
  previewCard: {
    backgroundColor: '#FFFFFF',
  },
  previewPostHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  previewAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#0095F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewAvatarText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700',
  },
  previewUsername: {
    fontSize: 13,
    fontWeight: '600',
    color: '#262626',
  },
  previewImageSlot: {
    width: SCREEN_W,
    height: SCREEN_W,
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  carouselBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  carouselBadgeText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  previewCaption: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 16,
  },
  previewCaptionText: {
    fontSize: 14,
    color: '#262626',
    lineHeight: 20,
  },
});
