import { Image } from 'expo-image';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { assignRoles } from '../lib/api';
import { LocalPhoto, StoryRole, store } from '../lib/store';

const SCREEN_W = Dimensions.get('window').width;
const CELL_GAP = 2;
const COLS = 3;
const CELL_SIZE = (SCREEN_W - CELL_GAP * (COLS - 1)) / COLS;
const RUNNER_UP_SIZE = 80;
const MAX_CAROUSEL = 10;

interface SelectedItem {
  localUri: string;
  order: number;
}

export default function ReviewScreen() {
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<SelectedItem[]>([]);
  const [runnerUps, setRunnerUps] = useState<LocalPhoto[]>([]);
  const [toastMsg, setToastMsg] = useState('');
  const [notesExpanded, setNotesExpanded] = useState(false);
  const [reorderMode, setReorderMode] = useState(false);
  const [isReorganizing, setIsReorganizing] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reorganizeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reorganizeAbort = useRef<AbortController | null>(null);
  const mountedRef = useRef(false); // skip re-label on initial load

  // Cancel any pending timer + in-flight request when unmounting or navigating away
  useEffect(() => {
    return () => {
      if (reorganizeTimer.current) clearTimeout(reorganizeTimer.current);
      reorganizeAbort.current?.abort();
    };
  }, []);

  useEffect(() => {
    setSelected(store.selectedPhotos.map((uri, i) => ({ localUri: uri, order: i + 1 })));
    setRunnerUps([...store.runnerUpPhotos]);
    // Allow the re-label effect to fire after this initial load
    setTimeout(() => { mountedRef.current = true; }, 100);
  }, []);

  // ── Debounced re-labeling: fires 1.5s after any selection change ─────────
  const triggerReorganize = useCallback((currentSelected: SelectedItem[]) => {
    // Only run in AI modes with a backend and at least 2 photos
    const isAiProvider = store.method === 'claude' || store.method === 'openai';
    if (!isAiProvider || !store.backendUrl || currentSelected.length < 2) return;

    if (reorganizeTimer.current) clearTimeout(reorganizeTimer.current);
    // Abort any in-flight request from a previous debounce cycle
    reorganizeAbort.current?.abort();
    reorganizeTimer.current = setTimeout(async () => {
      const controller = new AbortController();
      reorganizeAbort.current = controller;
      try {
        setIsReorganizing(true);

        // Sort to get consistent ordering for encoding
        const sorted = [...currentSelected].sort((a, b) => a.order - b.order);

        // Encode photos — track which sorted indices actually succeeded.
        // AI indices (0, 1, 2…) map into encoded photos only, not into `sorted` directly.
        const photosBase64: string[] = [];
        const photoNames: string[] = [];
        const encodedSortedIndices: number[] = []; // encodeIdx → sortedIdx
        for (let si = 0; si < sorted.length; si++) {
          try {
            const m = await ImageManipulator.manipulateAsync(
              sorted[si].localUri,
              [{ resize: { width: 512 } }],
              { compress: 0.75, format: ImageManipulator.SaveFormat.JPEG, base64: true },
            );
            if (m.base64) {
              photosBase64.push(m.base64);
              photoNames.push(sorted[si].localUri.split('/').pop() ?? 'photo');
              encodedSortedIndices.push(si);
            }
          } catch { /* skip unreadable photo */ }
        }

        if (photosBase64.length < 2) return;

        const result = await assignRoles({
          photosBase64,
          photoNames,
          vibe: store.vibe || undefined,
          story: store.storyDescription || undefined,
          persona: store.persona ?? undefined,
          provider: store.method as 'claude' | 'openai',
          backendUrl: store.backendUrl,
          signal: controller.signal,
        });

        if (!result.success || controller.signal.aborted) return;

        // Apply ordering — AI indices refer to encoded photos, not `sorted` directly.
        // Compare against encoded count (not sorted.length) to avoid silent skip when
        // any photo fails to encode.
        if (result.ordering && result.ordering.length === encodedSortedIndices.length) {
          // Map AI encode index → sorted item
          const encodedItems = encodedSortedIndices.map((si) => sorted[si]);
          const reordered = result.ordering.map((aiIdx) => encodedItems[aiIdx]).filter(Boolean);
          // Append any photos that failed to encode at the end so they aren't lost
          const reorderedUris = new Set(reordered.map((item) => item.localUri));
          const notEncoded = sorted.filter((item) => !reorderedUris.has(item.localUri));
          const finalOrdered = [...reordered, ...notEncoded];
          setSelected(finalOrdered.map((item, i) => ({ localUri: item.localUri, order: i + 1 })));
          store.selectedPhotos = finalOrdered.map((item) => item.localUri);
        }

        // Update role map — AI index refers to encoded photos, map back through encodedSortedIndices
        const newRoleMap: Record<string, StoryRole> = {};
        (result.photo_roles ?? []).forEach((pr) => {
          const si = encodedSortedIndices[pr.index];
          if (si != null) {
            const photo = sorted[si];
            if (photo) newRoleMap[photo.localUri] = pr.role as StoryRole;
          }
        });
        store.photoRolesByUri = newRoleMap;

        if (result.story) store.storyDescription = result.story;
        store.missingBeat = result.missing ?? null;
      } catch (err: any) {
        // AbortError is expected when navigating away — ignore silently
        if (err?.name !== 'AbortError') { /* other network errors also silently ignored */ }
      } finally {
        if (!controller.signal.aborted) setIsReorganizing(false);
      }
    }, 1500);
  }, []);

  // Watch selection changes and trigger re-label
  useEffect(() => {
    if (!mountedRef.current) return;
    triggerReorganize(selected);
  }, [selected, triggerReorganize]);

  function showToast(msg: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToastMsg(msg);
    toastTimer.current = setTimeout(() => setToastMsg(''), 2200);
  }

  function deselect(uri: string) {
    setSelected((prev) => {
      const target = prev.find((p) => p.localUri === uri);
      if (!target) return prev;
      return prev
        .filter((p) => p.localUri !== uri)
        .map((p) => ({ ...p, order: p.order > target.order ? p.order - 1 : p.order }));
    });
    const photo = store.localPhotos.find((p) => p.localUri === uri);
    if (photo) setRunnerUps((prev) => [photo, ...prev.filter((p) => p.localUri !== uri)]);
  }

  function promote(photo: LocalPhoto) {
    if (selected.length >= MAX_CAROUSEL) { showToast('Deselect a photo above first (max 10)'); return; }
    setSelected((prev) => [...prev, { localUri: photo.localUri, order: prev.length + 1 }]);
    setRunnerUps((prev) => prev.filter((p) => p.localUri !== photo.localUri));
  }

  function moveUp(index: number) {
    if (index === 0) return;
    setSelected((prev) => {
      const arr = [...prev].sort((a, b) => a.order - b.order);
      const tmp = arr[index].order;
      arr[index] = { ...arr[index], order: arr[index - 1].order };
      arr[index - 1] = { ...arr[index - 1], order: tmp };
      return arr;
    });
  }

  function moveDown(index: number) {
    setSelected((prev) => {
      const arr = [...prev].sort((a, b) => a.order - b.order);
      if (index >= arr.length - 1) return arr;
      const tmp = arr[index].order;
      arr[index] = { ...arr[index], order: arr[index + 1].order };
      arr[index + 1] = { ...arr[index + 1], order: tmp };
      return arr;
    });
  }

  async function pickFromLibrary() {
    const slots = MAX_CAROUSEL - selected.length;
    if (slots <= 0) { showToast('Deselect a photo above first (max 10)'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsMultipleSelection: true,
      selectionLimit: slots, quality: 1, orderedSelection: true,
    });
    if (result.canceled || result.assets.length === 0) return;
    setSelected((prev) => [
      ...prev,
      ...result.assets.map((asset, i) => ({ localUri: asset.uri, order: prev.length + i + 1 })),
    ]);
  }

  function handleNext() {
    const ordered = [...selected].sort((a, b) => a.order - b.order);
    store.selectedPhotos = ordered.map((p) => p.localUri);
    router.push('/caption');
  }

  const count = selected.length;
  const tooMany = count > MAX_CAROUSEL;
  const canNext = count > 0 && !tooMany;
  const sortedSelected = [...selected].sort((a, b) => a.order - b.order);
  const hasNotes = !!store.curationNotes;
  const isAiMode = store.method !== 'classic';
  // These are re-read each render; the re-labeling effect triggers a state update
  // (via setSelected / setIsReorganizing) which causes a re-render pulling fresh values.
  const storyDesc = store.storyDescription;
  const missingBeat = store.missingBeat;
  const rolesByUri = store.photoRolesByUri;

  // Favorites: iOS ♥ photos not already in the top-10 or runner-up tray
  const selectedUriSet = new Set(selected.map((s) => s.localUri));
  const runnerUpUriSet = new Set(runnerUps.map((r) => r.localUri));
  const favoritePhotos = store.localPhotos.filter(
    (p) => p.isFavorite && !selectedUriSet.has(p.localUri) && !runnerUpUriSet.has(p.localUri),
  );

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

const ROLE_COLORS: Record<string, string> = {
  hook:   '#FF6B35',  // orange
  world:  '#4ECDC4',  // teal
  life:   '#FFE66D',  // yellow
  detail: '#C77DFF',  // purple
  closer: '#FF3B5C',  // pink-red
};

function SelectedCell({ item, onDeselect, role }: {
  item: SelectedItem;
  onDeselect: (uri: string) => void;
  role?: string;
}) {
  return (
    <Pressable style={styles.cell} onPress={() => onDeselect(item.localUri)}>
      <Image source={{ uri: item.localUri }} style={styles.cellImage} contentFit="cover" transition={150} cachePolicy="memory-disk" />
      <View style={styles.selBadgeActive}><Text style={styles.selNum}>{item.order}</Text></View>
      {role ? (
        <View style={[styles.roleBadge, { backgroundColor: ROLE_COLORS[role] ?? '#555' }]}>
          <Text style={styles.roleText}>{role.toUpperCase()}</Text>
        </View>
      ) : null}
      <View style={styles.deselHint}><Text style={styles.deselHintText}>✕</Text></View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#222' },
  headerClose: { color: '#FFF', fontSize: 18, width: 36, textAlign: 'center' },
  headerCenter: { alignItems: 'center', flex: 1 },
  headerTitle: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  headerCount: { color: '#8E8E8E', fontSize: 12, marginTop: 1 },
  headerCountWarn: { color: '#FF3B30' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 100, justifyContent: 'flex-end' },
  iconBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#1A1A1A', borderWidth: 1, borderColor: '#333', alignItems: 'center', justifyContent: 'center' },
  iconBtnActive: { backgroundColor: '#0095F6', borderColor: '#0095F6' },
  iconBtnText: { color: '#0095F6', fontSize: 15, lineHeight: 20, fontWeight: '700' },
  iconBtnTextActive: { color: '#FFF' },
  headerNext: { color: '#0095F6', fontSize: 16, fontWeight: '600' },
  headerNextDisabled: { color: '#333' },

  // Story narrative banner (AI mode — shown when story description is available)
  storyBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: '#0A1A0A', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#1A3A1A' },
  storyIcon: { fontSize: 14, flexShrink: 0, marginTop: 1 },
  storyText: { color: '#6ECC6E', fontSize: 12, lineHeight: 18 },
  missingText: { color: '#FF9500', fontSize: 11, marginTop: 4, lineHeight: 16 },

  // AI notes banner (fallback when no story description)
  notesBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: '#0D1A2A', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#1A2A3A' },
  notesIcon: { color: '#0095F6', fontSize: 12, flexShrink: 0 },
  notesMain: { flex: 1, color: '#8E8E8E', fontSize: 12, lineHeight: 18 },
  notesChevron: { color: '#0095F6', fontSize: 10, flexShrink: 0 },

  // Main grid
  cell: { width: CELL_SIZE, height: CELL_SIZE, backgroundColor: '#111', overflow: 'hidden' },
  cellImage: { width: '100%', height: '100%' },
  selBadgeActive: { position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: 11, backgroundColor: '#0095F6', borderColor: '#0095F6', borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  selNum: { color: '#FFF', fontSize: 11, fontWeight: '700' },
  roleBadge: { position: 'absolute', top: 4, left: 4, paddingHorizontal: 4, paddingVertical: 2, borderRadius: 3 },
  roleText: { color: '#FFF', fontSize: 7, fontWeight: '800', letterSpacing: 0.6 },
  deselHint: { position: 'absolute', bottom: 6, right: 6, width: 18, height: 18, borderRadius: 9, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  deselHintText: { color: '#FFF', fontSize: 10, fontWeight: '700' },

  // Reorder list
  reorderList: { paddingHorizontal: 16, paddingTop: 12, gap: 8 },
  reorderHint: { color: '#555', fontSize: 12, textAlign: 'center', marginBottom: 4 },
  reorderRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#111', borderRadius: 10, padding: 10 },
  reorderNum: { color: '#0095F6', fontSize: 14, fontWeight: '700', width: 20, textAlign: 'center' },
  reorderThumb: { width: 56, height: 56, borderRadius: 6, backgroundColor: '#222' },
  reorderArrows: { gap: 6, alignItems: 'center' },
  arrowBtn: { width: 32, height: 28, borderRadius: 6, backgroundColor: '#222', alignItems: 'center', justifyContent: 'center' },
  arrowBtnDisabled: { opacity: 0.2 },
  arrowText: { color: '#FFF', fontSize: 13 },
  removeBtn: { marginLeft: 'auto' as any, width: 28, height: 28, borderRadius: 14, backgroundColor: '#2A0000', alignItems: 'center', justifyContent: 'center' },
  removeBtnText: { color: '#FF3B30', fontSize: 13, fontWeight: '700' },

  // Runner-up tray
  traySection: { marginTop: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#222', paddingTop: 10 },
  trayHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 10, gap: 10 },
  trayDivider: { flex: 1, height: 1, backgroundColor: '#2A2A2A' },
  trayLabel: { color: '#8E8E8E', fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
  trayRow: { paddingHorizontal: 14, gap: 8, paddingBottom: 4 },
  runnerUpCell: { width: RUNNER_UP_SIZE, height: RUNNER_UP_SIZE, borderRadius: 8, overflow: 'hidden', backgroundColor: '#111' },
  runnerUpImage: { width: '100%', height: '100%' },
  runnerUpAddBtn: { position: 'absolute', bottom: 4, right: 4, width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(0,149,246,0.85)', alignItems: 'center', justifyContent: 'center' },
  runnerUpAddIcon: { color: '#FFF', fontSize: 14, lineHeight: 20, fontWeight: '700' },

  // Favorites tray
  favTrayLabel: { color: '#FF3B5C' },
  favAddBtn: { position: 'absolute', bottom: 4, right: 4, width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(255,59,92,0.85)', alignItems: 'center', justifyContent: 'center' },
  favHeartBadge: { position: 'absolute', top: 4, left: 4, width: 18, height: 18, borderRadius: 9, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  favHeartText: { color: '#FF3B5C', fontSize: 9, fontWeight: '700' },

  warnBanner: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#FF3B30', paddingVertical: 10, alignItems: 'center' },
  warnText: { color: '#FFF', fontSize: 13, fontWeight: '500' },
  toast: { position: 'absolute', bottom: 60, left: 32, right: 32, backgroundColor: 'rgba(30,30,30,0.92)', borderRadius: 10, paddingVertical: 11, paddingHorizontal: 16, alignItems: 'center' },
  toastText: { color: '#FFF', fontSize: 13, fontWeight: '500' },
});
