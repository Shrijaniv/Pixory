import { Image } from 'expo-image';
import { router } from 'expo-router';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { store } from '../../../lib/store';
import { SelectedCell } from './SelectedCell';
import { useReviewState } from './hooks';
import { styles } from './styles';
import { CELL_GAP, COLS, MAX_CAROUSEL, RUNNER_UP_SIZE } from './types';

export default function ReviewScreen() {
  const insets = useSafeAreaInsets();
  const {
    runnerUps,
    toastMsg,
    notesExpanded,
    setNotesExpanded,
    reorderMode,
    setReorderMode,
    isReorganizing,
    count,
    tooMany,
    canNext,
    sortedSelected,
    hasNotes,
    isAiMode,
    storyDesc,
    missingBeat,
    rolesByUri,
    favoritePhotos,
    deselect,
    promote,
    moveUp,
    moveDown,
    pickFromLibrary,
    handleNext,
  } = useReviewState();

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.headerClose}>✕</Text>
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Select Photos</Text>
          <Text style={[styles.headerCount, tooMany && styles.headerCountWarn]}>{count} / {MAX_CAROUSEL}</Text>
        </View>
        <View style={styles.headerRight}>
          {!reorderMode && (
            <Pressable onPress={pickFromLibrary} hitSlop={12} style={styles.iconBtn}>
              <Text style={styles.iconBtnText}>＋</Text>
            </Pressable>
          )}
          <Pressable onPress={() => setReorderMode((v) => !v)} hitSlop={12} style={[styles.iconBtn, reorderMode && styles.iconBtnActive]}>
            <Text style={[styles.iconBtnText, reorderMode && styles.iconBtnTextActive]}>↕</Text>
          </Pressable>
          <Pressable onPress={canNext ? handleNext : undefined} hitSlop={12}>
            <Text style={[styles.headerNext, !canNext && styles.headerNextDisabled]}>Next</Text>
          </Pressable>
        </View>
      </View>

      {/* Story narrative banner — shown when AI returned a story description */}
      {isAiMode && (storyDesc || isReorganizing) ? (
        <View style={styles.storyBanner}>
          {isReorganizing
            ? <ActivityIndicator size="small" color="#6ECC6E" style={{ marginRight: 2 }} />
            : <Text style={styles.storyIcon}>🎬</Text>}
          <View style={{ flex: 1 }}>
            <Text style={[styles.storyText, isReorganizing && { opacity: 0.5 }]}>
              {isReorganizing ? 'Reorganizing story arc…' : storyDesc}
            </Text>
            {!isReorganizing && missingBeat ? <Text style={styles.missingText}>⚠ {missingBeat}</Text> : null}
          </View>
        </View>
      ) : hasNotes ? (
        /* AI reasoning — expandable (shown when no story yet, e.g. older sessions) */
        <Pressable style={styles.notesBanner} onPress={() => setNotesExpanded((v) => !v)}>
          <Text style={styles.notesIcon}>✦</Text>
          <Text style={styles.notesMain} numberOfLines={notesExpanded ? undefined : 1}>
            {store.curationNotes}
          </Text>
          <Text style={styles.notesChevron}>{notesExpanded ? '▲' : '▼'}</Text>
        </Pressable>
      ) : isAiMode ? (
        <View style={styles.notesBanner}>
          <Text style={styles.notesIcon}>✦</Text>
          <Text style={styles.notesMain}>AI selected these photos based on your vibe and quality signals.</Text>
        </View>
      ) : null}

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>

        {reorderMode ? (
          /* ── Reorder list ──────────────────────────────────────────────── */
          <View style={styles.reorderList}>
            <Text style={styles.reorderHint}>Drag order controls the carousel sequence on Instagram</Text>
            {sortedSelected.map((item, index) => (
              <View key={item.localUri} style={styles.reorderRow}>
                <Text style={styles.reorderNum}>{item.order}</Text>
                <Image
                  source={{ uri: item.localUri }}
                  style={styles.reorderThumb}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                />
                <View style={styles.reorderArrows}>
                  <Pressable onPress={() => moveUp(index)} hitSlop={8} style={[styles.arrowBtn, index === 0 && styles.arrowBtnDisabled]}>
                    <Text style={styles.arrowText}>▲</Text>
                  </Pressable>
                  <Pressable onPress={() => moveDown(index)} hitSlop={8} style={[styles.arrowBtn, index === sortedSelected.length - 1 && styles.arrowBtnDisabled]}>
                    <Text style={styles.arrowText}>▼</Text>
                  </Pressable>
                </View>
                <Pressable onPress={() => deselect(item.localUri)} hitSlop={8} style={styles.removeBtn}>
                  <Text style={styles.removeBtnText}>✕</Text>
                </Pressable>
              </View>
            ))}
          </View>
        ) : (
          /* ── Main selection grid ───────────────────────────────────────── */
          <FlatList
            data={sortedSelected}
            numColumns={COLS}
            keyExtractor={(item) => item.localUri}
            columnWrapperStyle={{ gap: CELL_GAP }}
            ItemSeparatorComponent={() => <View style={{ height: CELL_GAP }} />}
            renderItem={({ item }) => <SelectedCell item={item} onDeselect={deselect} role={rolesByUri[item.localUri]} />}
            scrollEnabled={false}
          />
        )}

        {/* Runner-up tray (hidden in reorder mode) */}
        {!reorderMode && runnerUps.length > 0 && (
          <View style={styles.traySection}>
            <View style={styles.trayHeader}>
              <View style={styles.trayDivider} />
              <Text style={styles.trayLabel}>ADD MATCHES</Text>
              <View style={styles.trayDivider} />
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.trayRow}>
              {runnerUps.map((photo) => (
                <Pressable key={photo.localUri} style={styles.runnerUpCell} onPress={() => promote(photo)}>
                  <Image source={{ uri: photo.localUri }} style={styles.runnerUpImage} contentFit="cover" cachePolicy="memory-disk" transition={100} />
                  <View style={styles.runnerUpAddBtn}><Text style={styles.runnerUpAddIcon}>＋</Text></View>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Favorites tray — iOS ♥ photos not already selected or in runner-ups */}
        {!reorderMode && favoritePhotos.length > 0 && (
          <View style={styles.traySection}>
            <View style={styles.trayHeader}>
              <View style={styles.trayDivider} />
              <Text style={[styles.trayLabel, styles.favTrayLabel]}>♥ FAVORITES</Text>
              <View style={styles.trayDivider} />
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.trayRow}>
              {favoritePhotos.map((photo) => (
                <Pressable key={photo.localUri} style={styles.runnerUpCell} onPress={() => promote(photo)}>
                  <Image source={{ uri: photo.localUri }} style={styles.runnerUpImage} contentFit="cover" cachePolicy="memory-disk" transition={100} />
                  <View style={styles.favAddBtn}><Text style={styles.runnerUpAddIcon}>＋</Text></View>
                  <View style={styles.favHeartBadge}><Text style={styles.favHeartText}>♥</Text></View>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}
      </ScrollView>

      {tooMany && (
        <View style={styles.warnBanner}>
          <Text style={styles.warnText}>Maximum {MAX_CAROUSEL} photos for an Instagram carousel</Text>
        </View>
      )}
      {toastMsg ? (
        <View style={styles.toast}><Text style={styles.toastText}>{toastMsg}</Text></View>
      ) : null}
    </View>
  );
}
