import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { assignRoles } from '../../../lib/api';
import { recordOutcome } from '../../../lib/learning';
import { LocalPhoto, StoryRole, store } from '../../../lib/store';
import { MAX_CAROUSEL, SelectedItem } from './types';

export function useReviewState() {
  const [selected, setSelected] = useState<SelectedItem[]>([]);
  const [runnerUps, setRunnerUps] = useState<LocalPhoto[]>([]);
  const [toastMsg, setToastMsg] = useState('');
  const [notesExpanded, setNotesExpanded] = useState(false);
  const [reorderMode, setReorderMode] = useState(false);
  const [isReorganizing, setIsReorganizing] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reorganizeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reorganizeAbort = useRef<AbortController | null>(null);
  const mountedRef = useRef(false); // skip re-label on initial load
  const skipReorganizeRef = useRef(false); // skip re-label when selection is AI-driven (prevents loop)
  // Snapshot of the AI's original selection — used to distinguish "rejected AI pick"
  // from "deselected something the user themselves added"
  const initialSelectionRef = useRef<Set<string>>(new Set());
  // Ensures the "kept" approval signal is recorded at most once per visit
  const recordedKeptRef = useRef(false);

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
    // Snapshot the initial AI selection so we can detect user rejections later
    initialSelectionRef.current = new Set(store.selectedPhotos);
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
          if (controller.signal.aborted) return; // stop encoding on navigation
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
          skipReorganizeRef.current = true; // AI-driven reorder — don't re-trigger the API
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

  // Watch selection changes and trigger re-label.
  // Skip when the change was AI-driven (AI returned reordering) to prevent an
  // infinite loop: AI reorders → setSelected → this effect → API → AI reorders → …
  useEffect(() => {
    if (!mountedRef.current) return;
    if (skipReorganizeRef.current) { skipReorganizeRef.current = false; return; }
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
    if (photo) {
      setRunnerUps((prev) => [photo, ...prev.filter((p) => p.localUri !== uri)]);
      // Record as a rejection only if the algorithm/AI originally selected this photo
      if (initialSelectionRef.current.has(uri)) {
        recordOutcome(photo, 'rejected', store.persona);
      }
    }
  }

  function promote(photo: LocalPhoto) {
    if (selected.length >= MAX_CAROUSEL) { showToast('Deselect a photo above first (max 10)'); return; }
    setSelected((prev) => [...prev, { localUri: photo.localUri, order: prev.length + 1 }]);
    setRunnerUps((prev) => prev.filter((p) => p.localUri !== photo.localUri));
    // Record as a promotion — user explicitly chose something the algorithm deprioritised
    recordOutcome(photo, 'promoted', store.persona);
  }

  /** Apply a new order from the draggable filmstrip (does NOT trigger AI re-label). */
  function reorder(orderedUris: string[]) {
    skipReorganizeRef.current = true;
    setSelected(orderedUris.map((uri, i) => ({ localUri: uri, order: i + 1 })));
    store.selectedPhotos = orderedUris;
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
    // Deduplicate by URI before writing to store — guards against any upstream duplicates
    const seen = new Set<string>();
    store.selectedPhotos = ordered.map((p) => p.localUri).filter((uri) => {
      if (seen.has(uri)) return false;
      seen.add(uri);
      return true;
    });

    // Learn from the KEPT picks: photos the AI selected and the user accepted
    // (left in the carousel) are a strong approval signal. Tray-added photos were
    // already recorded by promote(); removed ones by deselect(). Record once per visit.
    if (!recordedKeptRef.current) {
      recordedKeptRef.current = true;
      for (const item of ordered) {
        if (!initialSelectionRef.current.has(item.localUri)) continue; // skip user-added (already recorded)
        const photo = store.localPhotos.find((p) => p.localUri === item.localUri);
        if (photo) recordOutcome(photo, 'promoted', store.persona);
      }
    }

    router.push('/caption');
  }

  // Derived values
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

  // Combined "More matches" tray: runner-ups + favorites in one list (favorites flagged).
  const moreMatches: LocalPhoto[] = [
    ...favoritePhotos.map((p) => ({ ...p, isFavorite: true })),
    ...runnerUps.filter((p) => !selectedUriSet.has(p.localUri)),
  ].filter((p, i, arr) => arr.findIndex((q) => q.localUri === p.localUri) === i);

  return {
    selected,
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
    moreMatches,
    focusedIndex,
    setFocusedIndex,
    reorder,
    deselect,
    promote,
    moveUp,
    moveDown,
    pickFromLibrary,
    handleNext,
    showToast,
  };
}
