import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { PrimaryButton, ScreenHeader } from '../../../components/ui';
import { Colors, Radius, Spacing, Typography } from '../../../lib/theme';
import { useStoryDetailState } from './hooks';

export default function StoryDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { story, reshare, saveAgain, duplicate } = useStoryDetailState(id);

  const dateLabel = story
    ? new Date(story.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase()
    : '';

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={story?.title ?? 'Story'}
        onBack={() => router.back()}
        rightElement={<Text style={styles.dots}>···</Text>}
      />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Cover */}
        <View style={styles.coverWrap}>
          {story?.coverUri ? (
            <Image source={{ uri: story.coverUri }} style={styles.cover} contentFit="cover" />
          ) : (
            <View style={styles.cover} />
          )}
          <View style={styles.countBadge}>
            <Text style={styles.countText}>1/{story?.photoCount ?? 0}</Text>
          </View>
          {story?.status === 'published' && (
            <View style={styles.pubPill}>
              <Text style={styles.pubText}>✓ PUBLISHED · {dateLabel}</Text>
            </View>
          )}
        </View>

        {/* Caption recap */}
        {story?.captionText ? (
          <Text style={styles.caption}>
            {story.captionText}
            {story.hashtags && story.hashtags.length > 0 && (
              <Text style={styles.hashtags}>{'  ' + story.hashtags.map((h) => `#${h}`).join(' ')}</Text>
            )}
          </Text>
        ) : null}

        {/* Actions */}
        <View style={styles.actions}>
          <PrimaryButton label="↗ Re-share" variant="gradient" onPress={reshare} />
          <View style={styles.actionRow}>
            <Pressable style={styles.secondaryBtn} onPress={saveAgain}>
              <Text style={styles.secondaryText}>⤓ Save again</Text>
            </Pressable>
            <Pressable style={styles.secondaryBtn} onPress={duplicate}>
              <Text style={styles.secondaryText}>⎘ Duplicate</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  dots: { fontSize: 20, color: Colors.text },
  scroll: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xxl, gap: Spacing.lg },
  coverWrap: { position: 'relative' },
  cover: {
    width: '100%',
    height: 230,
    borderRadius: Radius.card,
    backgroundColor: Colors.elevated,
  },
  countBadge: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  countText: { ...Typography.mono, color: '#FFF', fontSize: 10 },
  pubPill: {
    position: 'absolute',
    bottom: Spacing.md,
    left: Spacing.md,
    backgroundColor: Colors.successWash,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  pubText: { ...Typography.labelMono, fontSize: 9, color: Colors.success, letterSpacing: 1 },
  caption: { ...Typography.bodyMd, color: Colors.textMuted, lineHeight: 20 },
  hashtags: { color: Colors.hashtag },
  actions: { gap: Spacing.md, marginTop: Spacing.sm },
  actionRow: { flexDirection: 'row', gap: Spacing.md },
  secondaryBtn: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.lineMid,
    borderRadius: Radius.lg,
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryText: { ...Typography.titleSm, color: Colors.text },
});
