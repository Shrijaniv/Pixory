import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
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
import { Chip } from '../../../components/ui';
import { store } from '../../../lib/store';
import { Colors, Gradients } from '../../../lib/theme';
import { useCaptionState } from './hooks';
import { styles } from './styles';

export default function CaptionScreen() {
  const insets = useSafeAreaInsets();
  const {
    captions,
    selectedMood,
    editedText,
    setEditedText,
    showHashtags,
    chosen,
    postLocation,
    setPostLocation,
    handleMoodSelect,
    handleShare,
  } = useCaptionState();

  const photos = store.selectedPhotos;
  const handle = store.handle || 'your_account';
  const hashtagLine = chosen?.hashtags?.length ? chosen.hashtags.map((h) => `#${h}`).join(' ') : '';

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.back}>‹</Text>
        </Pressable>
        <Text style={styles.title}>Caption</Text>
        <Pressable onPress={handleShare} hitSlop={12}>
          <Text style={styles.next}>Next</Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 24, gap: 16 }}
        >
          {/* Live IG preview */}
          <View style={styles.preview}>
            <View style={styles.previewHeader}>
              <LinearGradient colors={Gradients.ig} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }} style={styles.pvAvatarRing}>
                <View style={styles.pvAvatarInner} />
              </LinearGradient>
              <Text style={styles.pvHandle}>{handle}</Text>
              <Text style={styles.pvDots}>···</Text>
            </View>

            <View style={styles.pvImageSlot}>
              {photos[0] ? (
                <Image source={{ uri: photos[0] }} style={styles.pvImage} contentFit="cover" cachePolicy="memory-disk" />
              ) : null}
              {photos.length > 1 && (
                <View style={styles.pvCountBadge}>
                  <Text style={styles.pvCountText}>1/{photos.length}</Text>
                </View>
              )}
              {photos.length > 1 && (
                <View style={styles.pvDotsRow}>
                  {photos.slice(0, 5).map((_, i) => (
                    <View key={i} style={[styles.pvDot, i === 0 && styles.pvDotActive]} />
                  ))}
                </View>
              )}
            </View>

            <View style={styles.pvActions}>
              <Text style={styles.pvActionIcon}>♡</Text>
              <Text style={styles.pvActionIcon}>▢</Text>
              <Text style={styles.pvActionIcon}>➤</Text>
              <View style={{ flex: 1 }} />
              <Text style={styles.pvActionIcon}>⊟</Text>
            </View>

            <View style={styles.pvCaption}>
              <Text style={styles.pvCaptionText} numberOfLines={2}>
                <Text style={styles.pvCaptionHandle}>{handle} </Text>
                {editedText}
              </Text>
            </View>
          </View>

          {/* Caption style chips */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {captions.map((c) => (
              <Chip
                key={c.mood}
                label={c.mood.charAt(0).toUpperCase() + c.mood.slice(1)}
                active={selectedMood === c.mood}
                onPress={() => handleMoodSelect(c.mood)}
              />
            ))}
          </ScrollView>

          {/* Caption editor */}
          <View style={styles.editor}>
            <TextInput
              style={styles.editorInput}
              value={editedText}
              onChangeText={setEditedText}
              multiline
              placeholder="Write a caption…"
              placeholderTextColor={Colors.textFaint}
              textAlignVertical="top"
              scrollEnabled={false}
            />
            {showHashtags && hashtagLine ? (
              <Text style={styles.hashtags}>{hashtagLine}</Text>
            ) : null}
          </View>

          {/* Location */}
          <TextInput
            style={styles.location}
            placeholder="📍 Add location (optional)"
            placeholderTextColor={Colors.textFaint}
            value={postLocation}
            onChangeText={(t) => { setPostLocation(t); store.postLocation = t; }}
            returnKeyType="done"
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
