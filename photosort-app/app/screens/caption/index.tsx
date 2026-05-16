import { Image } from 'expo-image';
import { router } from 'expo-router';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { store } from '../../../lib/store';
import { useCaptionState } from './hooks';
import styles from './styles';
import { MOOD_META } from './types';

export default function CaptionScreen() {
  const insets = useSafeAreaInsets();
  const {
    captions,
    selectedMood,
    editedText,
    setEditedText,
    showHashtags,
    setShowHashtags,
    postLocation,
    setPostLocation,
    chosen,
    fullCaption,
    handleMoodSelect,
    handleShare,
  } = useCaptionState();

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
