import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GradientText, StatusPill, TabBar } from '../../../components/ui';
import { store } from '../../../lib/store';
import { Gradients } from '../../../lib/theme';
import { useHomeState } from './hooks';
import { styles } from './styles';
import { formatStoryMeta } from './types';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { stories, avatarUri, openStory, confirmDelete } = useHomeState();

  const initials = (store.displayName || 'You').trim().slice(0, 1).toUpperCase();

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 8 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <GradientText style={styles.wordmark} colors={Gradients.logo}>Pixory</GradientText>
          <Pressable style={styles.avatarRing} onPress={() => router.push('/profile')}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatar} contentFit="cover" />
            ) : (
              <View style={styles.avatarInitials}>
                <Text style={styles.avatarInitialsText}>{initials}</Text>
              </View>
            )}
          </Pressable>
        </View>

        {/* Hero card */}
        <Pressable onPress={() => router.push('/new-story')}>
          <LinearGradient
            colors={Gradients.accentHero}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.hero}
          >
            <View style={styles.heroCircle} />
            <Text style={styles.heroTitle}>Create a new story</Text>
            <Text style={styles.heroSub}>Dates, a place & a vibe → your 10 best, sequenced.</Text>
            <View style={styles.heroPill}>
              <Text style={styles.heroPillText}>＋ Start →</Text>
            </View>
          </LinearGradient>
        </Pressable>

        {/* Stories */}
        <Text style={styles.sectionLabel}>Your stories</Text>

        {stories.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No stories yet</Text>
            <Text style={styles.emptySub}>
              Tap “Create a new story” to curate your first Instagram carousel.
            </Text>
          </View>
        ) : (
          stories.map((s) => (
            <Pressable
              key={s.id}
              style={styles.storyRow}
              onPress={() => openStory(s)}
              onLongPress={() => confirmDelete(s)}
              delayLongPress={400}
            >
              {s.coverUri ? (
                <Image source={{ uri: s.coverUri }} style={styles.cover} contentFit="cover" />
              ) : (
                <View style={styles.cover} />
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.storyTitle} numberOfLines={1}>{s.title}</Text>
                <Text style={styles.storyMeta}>{formatStoryMeta(s.date, s.photoCount)}</Text>
              </View>
              <StatusPill status={s.status} />
            </Pressable>
          ))
        )}
      </ScrollView>

      <TabBar active="home" />
    </View>
  );
}
