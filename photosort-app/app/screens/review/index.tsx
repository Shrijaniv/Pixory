import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gradients } from '../../../lib/theme';
import { useReviewState } from './hooks';
import { styles } from './styles';
import { MAX_CAROUSEL, ROLE_LABELS } from './types';

export default function ReviewScreen() {
  const insets = useSafeAreaInsets();
  const {
    toastMsg,
    isReorganizing,
    count,
    tooMany,
    canNext,
    sortedSelected,
    isAiMode,
    storyDesc,
    rolesByUri,
    moreMatches,
    focusedIndex,
    setFocusedIndex,
    reorder,
    promote,
    deselect,
    pickFromLibrary,
    handleNext,
  } = useReviewState();

  const [viewerOpen, setViewerOpen] = useState(false);
  const focusIdx = Math.min(focusedIndex, Math.max(0, sortedSelected.length - 1));
  const focused = sortedSelected[focusIdx];
  const focusedRole = focused ? rolesByUri[focused.localUri] : undefined;

  // Reorder by swapping the focused slide with its neighbour (no AI re-label).
  function move(dir: -1 | 1) {
    const target = focusIdx + dir;
    if (target < 0 || target >= sortedSelected.length) return;
    const uris = sortedSelected.map((s) => s.localUri);
    [uris[focusIdx], uris[target]] = [uris[target], uris[focusIdx]];
    reorder(uris);
    setFocusedIndex(target);
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.replace('/')} hitSlop={12}>
          <Text style={styles.close}>✕</Text>
        </Pressable>
        <Text style={styles.title}>Arrange the carousel</Text>
        <LinearGradient colors={Gradients.accent} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.countPill}>
          <Text style={styles.countText}>{count}</Text>
        </LinearGradient>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 90 }}>
        {/* Story banner */}
        {isAiMode && (storyDesc || isReorganizing) ? (
          <View style={styles.storyBanner}>
            {isReorganizing
              ? <ActivityIndicator size="small" color="#FFAE3D" />
              : <Text style={styles.storyIcon}>🎬</Text>}
            <Text style={[styles.storyText, isReorganizing && { opacity: 0.5 }]} numberOfLines={2}>
              {isReorganizing ? 'Reorganizing story arc…' : storyDesc}
            </Text>
          </View>
        ) : null}

        {/* Focused hero */}
        {focused && (
          <View style={styles.heroWrap}>
            <Image source={{ uri: focused.localUri }} style={styles.hero} contentFit="cover" cachePolicy="memory-disk" />
            <LinearGradient colors={Gradients.accent} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.orderBadge}>
              <Text style={styles.orderText}>{focusIdx + 1}</Text>
            </LinearGradient>
            <View style={styles.heroTopRight}>
              <Pressable style={styles.heroIconBtn} onPress={() => setViewerOpen(true)} hitSlop={8}>
                <Text style={styles.expandIcon}>⤢</Text>
              </Pressable>
              <Pressable style={styles.heroIconBtn} onPress={() => deselect(focused.localUri)} hitSlop={8}>
                <Text style={styles.removeIcon}>✕</Text>
              </Pressable>
            </View>
            {focusedRole ? (
              <View style={styles.roleChip}>
                <Text style={styles.roleChipText}>{ROLE_LABELS[focusedRole] ?? focusedRole}</Text>
              </View>
            ) : null}
            {/* Reorder controls */}
            <View style={styles.moveRow}>
              <Pressable style={[styles.moveBtn, focusIdx === 0 && styles.moveBtnDisabled]} onPress={() => move(-1)} hitSlop={6}>
                <Text style={styles.moveIcon}>◂</Text>
              </Pressable>
              <Pressable
                style={[styles.moveBtn, focusIdx === sortedSelected.length - 1 && styles.moveBtnDisabled]}
                onPress={() => move(1)}
                hitSlop={6}
              >
                <Text style={styles.moveIcon}>▸</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Filmstrip */}
        <Text style={styles.hint}>Tap to focus · ◂ ▸ to reorder</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filmstrip}>
          {sortedSelected.map((item, idx) => (
            <Pressable
              key={item.localUri}
              onPress={() => setFocusedIndex(idx)}
              style={[styles.thumbWrap, idx === focusIdx && styles.thumbActive]}
            >
              <Image source={{ uri: item.localUri }} style={styles.thumb} contentFit="cover" cachePolicy="memory-disk" />
            </Pressable>
          ))}
        </ScrollView>

        {/* More matches */}
        {moreMatches.length > 0 && (
          <View style={styles.traySection}>
            <Text style={styles.trayLabel}>More matches</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.trayRow}>
              {moreMatches.map((photo) => (
                <Pressable key={photo.localUri} style={styles.trayCell} onPress={() => promote(photo)}>
                  <Image source={{ uri: photo.localUri }} style={styles.trayImage} contentFit="cover" cachePolicy="memory-disk" transition={100} />
                  {photo.isFavorite ? (
                    <View style={styles.heartBadge}><Text style={styles.heartText}>♥</Text></View>
                  ) : null}
                  <LinearGradient colors={Gradients.accent} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.addBtn}>
                    <Text style={styles.addIcon}>＋</Text>
                  </LinearGradient>
                </Pressable>
              ))}
              {/* Add from library */}
              <Pressable style={[styles.trayCell, styles.libraryCell]} onPress={pickFromLibrary}>
                <Text style={styles.libraryIcon}>＋</Text>
                <Text style={styles.libraryText}>Library</Text>
              </Pressable>
            </ScrollView>
          </View>
        )}
      </ScrollView>

      {/* Footer */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <Pressable
          style={[styles.nextBtn, !canNext && styles.nextBtnDisabled]}
          onPress={canNext ? handleNext : undefined}
        >
          <LinearGradient colors={Gradients.accent} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.nextGradient}>
            <Text style={styles.nextText}>Next: Caption →</Text>
          </LinearGradient>
        </Pressable>
      </View>

      {tooMany && (
        <View style={styles.warnBanner}>
          <Text style={styles.warnText}>Maximum {MAX_CAROUSEL} photos for an Instagram carousel</Text>
        </View>
      )}
      {toastMsg ? <View style={styles.toast}><Text style={styles.toastText}>{toastMsg}</Text></View> : null}

      {/* Full-screen viewer */}
      <Modal visible={viewerOpen} transparent animationType="fade" onRequestClose={() => setViewerOpen(false)}>
        <Pressable style={styles.viewer} onPress={() => setViewerOpen(false)}>
          {focused && <Image source={{ uri: focused.localUri }} style={styles.viewerImage} contentFit="contain" />}
          <Text style={styles.viewerClose}>✕</Text>
        </Pressable>
      </Modal>
    </View>
  );
}
