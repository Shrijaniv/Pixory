import { router } from 'expo-router';
import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';
import { Animated, ScrollView } from 'react-native';
import { curateDevicePhotos, matchFaces } from '../../../lib/api';
import { loadIdentity } from '../../../lib/identity';
import { learningInsight, loadLearningHistory } from '../../../lib/learning';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import { clusterSummary, deduplicateBursts, filterByLocation, getPhotos, requestPermission, scoreWithBackend, selectBestPhotos, topCandidates } from '../../../lib/photos';
import { Caption, LocalPhoto, newStoryId, saveSession, StoryRole, store, upsertStory } from '../../../lib/store';
import { Step, defaultCaptions } from './types';

export function useProcessingState() {
  const [steps, setSteps] = useState<Step[]>([]);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const cancelled = useRef(false);
  const abortRef  = useRef(new AbortController());

  function push(message: string, pct?: number) {
    if (cancelled.current) return;
    if (pct !== undefined) setProgress(pct);
    setSteps((prev) => {
      const updated = prev.map((s) => ({ ...s, done: true }));
      return [...updated, { id: String(Date.now() + Math.random()), message, done: false }];
    });
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
  }

  async function run() {
    try {
      // 1. Permissions
      push('Requesting photo library access...', 2);
      // Holds the encoded reference face photo — populated in step 7 if face filter is on,
      // then forwarded to the AI call in step 8 so the AI can also exclude non-matching face photos.
      let userFaceB64: string | undefined;

      // Show learning insight if enough history exists for this persona
      const learningHistory = await loadLearningHistory();
      const personaKey = store.persona ?? 'default';
      const insight = learningHistory[personaKey] ? learningInsight(learningHistory[personaKey]) : null;
      if (insight) push(`✦ ${insight}`);
      const { granted, limited } = await requestPermission();
      if (!granted) throw new Error('Photo library permission denied. Please enable it in Settings → Privacy → Photos.');
      if (limited) {
        push('⚠ "Selected Photos" access granted — iOS hides GPS data in this mode. Go to Settings → Privacy → Photos → Pixory and choose "All Photos" to enable location filtering.');
      }
      if (cancelled.current) return;

      // 2. Geocode location if provided
      let lat: number | null = null;
      let lon: number | null = null;
      if (store.locationName) {
        push(`Finding coordinates for "${store.locationName}"...`, 8);
        try {
          // expo-location's geocodeAsync wraps CLGeocoder on iOS. Some versions still check
          // that location services are enabled — request permission upfront to avoid silent failure.
          const locPerm = await Location.requestForegroundPermissionsAsync();
          if (locPerm.status !== 'granted') {
            push('⚠ Location permission not granted — geocoding may fail. Go to Settings → Privacy → Location Services → Pixory → While Using.');
          }
          const results = await Location.geocodeAsync(store.locationName);
          if (results.length > 0) {
            lat = results[0].latitude;
            lon = results[0].longitude;
            store.locationLat = lat;
            store.locationLon = lon;
            push(`✓ Geocoded "${store.locationName}" → ${lat!.toFixed(4)}, ${lon!.toFixed(4)}`);
          } else {
            push(`⚠ No results for "${store.locationName}". Try a more specific name like "Tokyo, Japan" or "Bali, Indonesia". Location filter skipped.`);
          }
        } catch (geocodeErr: any) {
          push(`⚠ Geocoding failed: ${geocodeErr?.message ?? String(geocodeErr)}. Location filter skipped.`);
        }
      }
      if (cancelled.current) return;

      // 3. Fetch photos from device
      const dateFrom = store.dateFrom ? new Date(store.dateFrom) : undefined;
      const dateTo = store.dateTo ? new Date(store.dateTo + 'T23:59:59') : undefined;

      push('Fetching photos from library...', 15);
      let photos = await getPhotos({
        dateFrom,
        dateTo,
        limit: 300,
        onProgress: push,
      });
      if (cancelled.current) return;
      push(`Loaded ${photos.length} photos from library`);

      // 4. Location filter
      if (lat != null && lon != null) {
        push(`Filtering ${photos.length} photos within ${store.locationRadiusKm} km of "${store.locationName}"...`, 35);
        const withGps = photos.filter((p) => p.lat != null && p.lon != null).length;
        const locationFiltered = filterByLocation(photos, lat, lon, store.locationRadiusKm);

        if (locationFiltered.length === 0) {
          if (withGps === 0) {
            // Photos have no GPS data — camera location was off, or photos are iCloud/shared
            push(
              `⚠ None of the ${photos.length} photos have GPS coordinates. ` +
              `Make sure Location Services is ON for your Camera app (Settings → Privacy → Location Services → Camera → "While Using"). ` +
              `Showing all ${photos.length} photos in the date range.`
            );
          } else {
            // GPS data present but nothing in the radius — show sample coords so the user can sanity-check
            const sample = photos
              .filter((p) => p.lat != null)
              .slice(0, 3)
              .map((p) => `${p.lat!.toFixed(3)},${p.lon!.toFixed(3)}`)
              .join(' | ');
            push(
              `⚠ ${withGps} photos have GPS but none within ${store.locationRadiusKm} km of ${lat!.toFixed(3)},${lon!.toFixed(3)}. ` +
              `Sample photo coords: ${sample}. ` +
              `Try a larger radius or check the place name. Showing all ${photos.length} photos.`
            );
          }
          // Fall through — keep all photos rather than returning zero
        } else {
          photos = locationFiltered;
          push(`✓ ${photos.length} photos within ${store.locationRadiusKm} km (${photos.length} of ${withGps} GPS-tagged photos matched)`);
        }
      }
      if (cancelled.current) return;

      if (photos.length === 0) throw new Error('No photos found for the selected date range. Try a wider date range.');

      store.localPhotos = photos;

      // 5. Burst deduplication (shared by all methods)
      push('Removing burst duplicates...', 42);
      const beforeDedup = photos.length;
      const dedupedPhotos = deduplicateBursts(photos);
      const removed = beforeDedup - dedupedPhotos.length;
      if (removed > 0) push(`Removed ${removed} burst duplicate${removed === 1 ? '' : 's'}`);

      setProgress(50);
      // 6. Backend scoring (OpenCV sharpness + face detection via Python sidecar)
      // Sends top 120 candidates as 512px thumbnails to /api/score_photos.
      // Falls back silently to file-size ranking if the backend is unreachable.
      let visionScored = await scoreWithBackend(dedupedPhotos, store.backendUrl, { candidateLimit: 120, onProgress: push, contentMix: store.contentMix, persona: store.persona });
      if (cancelled.current) return;

      // 7. Face identity filter (optional — only when user has set up identity + toggle is on)
      if (store.filterByUserFace) {
        const identity = await loadIdentity();
        if (identity) {
          // Encode the reference face at 256px for the AI (smaller than the DeepFace input —
          // just needs to be recognizable, not pixel-perfect for embedding extraction).
          try {
            const refEncoded = await ImageManipulator.manipulateAsync(
              identity.refPhotoUri,
              [{ resize: { width: 256 } }],
              { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG, base64: true },
            );
            if (refEncoded.base64) userFaceB64 = refEncoded.base64;
          } catch {
            // Non-fatal — AI will still run without the reference face
          }

          // Only check photos where face_count > 0 — landscapes/food always pass
          const facePhotos = visionScored.filter((p) => (p.faceCount ?? 0) > 0);
          if (facePhotos.length > 0) {
            push(`Checking ${facePhotos.length} photo${facePhotos.length !== 1 ? 's' : ''} for your face...`);
            try {
              // Encode face photos at 512px for matching
              const encoded: Array<{ index: number; data_b64: string }> = [];
              for (let i = 0; i < facePhotos.length; i++) {
                const m = await ImageManipulator.manipulateAsync(
                  facePhotos[i].localUri,
                  [{ resize: { width: 512 } }],
                  { compress: 0.75, format: ImageManipulator.SaveFormat.JPEG, base64: true }
                );
                if (m.base64) encoded.push({ index: i, data_b64: m.base64 });
              }

              const result = await matchFaces({
                referenceEmbedding: identity.embedding,
                photos: encoded,
                backendUrl: store.backendUrl,
              });

              // Build set of URIs to drop: face detected but user not in it
              const noMatchUris = new Set(
                result.matches
                  .filter((m) => !m.user_face_present)
                  .map((m) => facePhotos[m.index]?.localUri)
                  .filter(Boolean) as string[]
              );

              const beforeCount = visionScored.length;
              visionScored = visionScored.filter((p) => !noMatchUris.has(p.localUri));
              const filteredCount = beforeCount - visionScored.length;
              if (filteredCount > 0) {
                push(`Removed ${filteredCount} photo${filteredCount !== 1 ? 's' : ''} — faces detected but you weren't in them`);
              } else {
                push(`You appear in all ${facePhotos.length} face photo${facePhotos.length !== 1 ? 's' : ''} ✓`);
              }
            } catch (faceErr) {
              push('Face check skipped — backend unreachable');
            }
          }
        }

        // Also drop photos with no face data (ranked below top 120, never sent to sidecar)
        // — we can't verify whether the user appears in them, so exclude from both
        // selection and runner-ups to prevent other people's faces slipping through.
        const beforeUnscoredFilter = visionScored.length;
        visionScored = visionScored.filter((p) => p.faceCount !== undefined);
        const droppedUnscored = beforeUnscoredFilter - visionScored.length;
        if (droppedUnscored > 0) {
          push(`Skipped ${droppedUnscored} photo${droppedUnscored !== 1 ? 's' : ''} — not face-checked (low quality ranking)`);
        }
      }
      if (cancelled.current) return;

      // Replace the raw library snapshot with the SCORED set so the review
      // screen's learning records (kept/promoted/rejected) carry real vision
      // features (faceCount, sharpness, …) instead of defaults.
      store.localPhotos = visionScored;

      // 8. Run pipeline
      if (store.method === 'classic') {
        push('Selecting best photos...', 70);
        const { selected, runnerUps } = selectBestPhotos(visionScored, 10);
        store.selectedPhotos = selected.map((p) => p.localUri);
        store.runnerUpPhotos = runnerUps;
        store.captions = defaultCaptions();
        store.curationNotes = `Auto-selected ${selected.length} best photos using OpenCV scoring (sharpness, faces) and activity-based temporal spread.`;
        setProgress(90);
        await saveSession();

      } else if (store.method === 'claude' || store.method === 'openai') {
        const provider = store.method === 'claude' ? 'claude' : 'openai';
        const label = provider === 'claude' ? 'Claude AI' : 'GPT-4o';
        push(`Pre-selecting candidates for ${label}...`);

        // Log detected clusters so the user can see location breakdown
        const summary = clusterSummary(visionScored);
        console.log('[Pixory] Location+time clusters detected:\n' + summary);
        const clusterLines = summary.split('\n');
        push(`Found ${clusterLines.length} location clusters:`);
        clusterLines.forEach((line) => push(line.trim()));

        // topCandidates guarantees coverage from every time window (morning/midday/afternoon/evening)
        // while still prioritising quality within each window.
        // Persona is passed so the Storyteller's diversity bonus can be applied.
        const topPhotos = topCandidates(visionScored, 30, store.persona);
        // Runner-ups for the review tray = everything not in the top 30, sorted by score
        const topIds = new Set(topPhotos.map((p) => p.id));
        const deviceRunnerUps = [...visionScored]
          .filter((p) => !topIds.has(p.id))
          .sort((a, b) => b.qualityScore - a.qualityScore)
          .slice(0, 20);
        push(`Sending ${topPhotos.length} candidates to ${label} (${clusterLines.length} location clusters)${store.vibe ? `, vibe: "${store.vibe}"` : ''}`, 65);

        push(`Encoding ${topPhotos.length} candidates...`);
        const photosBase64: string[] = [];
        const photoNames: string[] = [];
        const favoriteIndices: number[] = [];
        const encodeStart = Date.now();
        let totalBytes = 0;
        let skipped = 0;

        // Encode in parallel batches of 8.
        // 768px is enough for AI vision — the backend re-resizes to 512px for GPT-4o anyway.
        const AI_ENCODE_BATCH = 8;
        const encodeResults: Array<{ index: number; base64: string; filename: string; isFavorite: boolean } | null> = [];
        for (let start = 0; start < topPhotos.length; start += AI_ENCODE_BATCH) {
          const batch = topPhotos.slice(start, start + AI_ENCODE_BATCH);
          push(`Encoding ${Math.min(start + AI_ENCODE_BATCH, topPhotos.length)}/${topPhotos.length}...`);
          const batchResults = await Promise.allSettled(
            batch.map((photo, bIdx) =>
              ImageManipulator.manipulateAsync(
                photo.localUri,
                [{ resize: { width: 768 } }],
                { compress: 0.75, format: ImageManipulator.SaveFormat.JPEG, base64: true },
              ).then((r) => ({ index: start + bIdx, base64: r.base64 ?? '', filename: photo.filename, isFavorite: !!photo.isFavorite }))
            )
          );
          for (const r of batchResults) {
            encodeResults.push(r.status === 'fulfilled' ? r.value : null);
          }
        }

        for (const r of encodeResults) {
          if (!r || !r.base64) { skipped++; continue; }
          totalBytes += r.base64.length;
          if (r.isFavorite) favoriteIndices.push(photosBase64.length);
          photosBase64.push(r.base64);
          photoNames.push(r.filename);
        }

        if (favoriteIndices.length > 0) push(`${favoriteIndices.length} favorited photo${favoriteIndices.length !== 1 ? 's' : ''} will be prioritized`);
        push(`Encoded ${photosBase64.length} photos in ${((Date.now() - encodeStart) / 1000).toFixed(1)}s — payload ~${Math.round(totalBytes / 1024)}KB${skipped > 0 ? ` (${skipped} skipped)` : ''}`);
        if (cancelled.current) return;

        // Persona shapes how many photos the AI selects.
        // Mood = 7 (light-selective, not quantity-obsessed), Storyteller = 8 (curated arc).
        // The review screen MAX_CAROUSEL stays 10 — user can always add more from trays.
        const maxSelect = store.persona === 'mood' ? 7
                        : store.persona === 'storyteller' ? 8
                        : 10;
        if (store.persona) push(`Persona: ${store.persona} → AI will select up to ${maxSelect} photos`);

        push(`Sending to ${label} via backend (${store.backendUrl})...`, 75);
        const apiStart = Date.now();
        const photoMetadata = topPhotos.map((p) => ({
          shot_type: p.shotType,
          group_size: p.groupSize,
        }));

        const result = await curateDevicePhotos({
          photosBase64,
          photoNames,
          favoriteIndices: favoriteIndices.length > 0 ? favoriteIndices : undefined,
          vibe: store.vibe || undefined,
          maxSelect,
          provider,
          backendUrl: store.backendUrl,
          contentMix: store.contentMix,
          persona: store.persona ?? undefined,
          userFaceB64,
          photoMetadata,
          signal: abortRef.current.signal,
        });
        push(`${label} responded in ${((Date.now() - apiStart) / 1000).toFixed(1)}s`);
        if (!result.success) throw new Error(result.error ?? `${label} curation failed`);
        if (cancelled.current) return;

        const indices = result.selected_indices ?? [];
        const aiSelected = indices
          .filter((i: number) => i < topPhotos.length)
          .map((i: number) => topPhotos[i]);
        const aiSelectedIds = new Set(aiSelected.map((p: LocalPhoto) => p.id));

        // Apply AI-suggested ordering: map ordering indices (into topPhotos[]) to URIs
        const ordering = result.ordering ?? indices;
        const aiSelectedUriSet = new Set(aiSelected.map((p: LocalPhoto) => p.localUri));
        const orderedUris = ordering
          .filter((i: number) => i < topPhotos.length)
          .map((i: number) => topPhotos[i].localUri)
          .filter((uri: string) => aiSelectedUriSet.has(uri));
        // Append any AI-selected photos that the ordering array omitted (safety net)
        const orderedUriSet = new Set(orderedUris);
        const remainder = aiSelected
          .map((p: LocalPhoto) => p.localUri)
          .filter((uri: string) => !orderedUriSet.has(uri));
        store.selectedPhotos = [...orderedUris, ...remainder];

        // Runner-ups: candidates not chosen by AI (from the top pool + device extras)
        store.runnerUpPhotos = [
          ...topPhotos.filter((p) => !aiSelectedIds.has(p.id)),
          ...deviceRunnerUps,
        ].slice(0, 20);

        store.captions = result.captions ?? [];
        store.curationNotes = result.notes ?? '';
        if (store.curationNotes) console.log('[Pixory] AI curation notes:\n' + store.curationNotes);

        // Narrative fields
        store.storyDescription = result.story ?? '';
        store.missingBeat      = result.missing ?? null;
        // Build URI → role map so the review screen can show badges without index arithmetic
        const roleMap: Record<string, StoryRole> = {};
        (result.photo_roles ?? []).forEach((pr: { index: number; role: string; reason: string }) => {
          const photo = topPhotos[pr.index];
          if (photo) roleMap[photo.localUri] = pr.role as StoryRole;
        });
        store.photoRolesByUri = roleMap;

        if (result.story) push(`Story: ${result.story}`);
        if (result.missing) push(`⚠ Missing beat: ${result.missing}`);
        setProgress(95);
        await saveSession();
      }

      // Record this curation as a draft Story so it appears on the Home hub.
      const storyId = newStoryId();
      store.currentStoryId = storyId;
      await upsertStory({
        id: storyId,
        title: store.vibe || 'Untitled story',
        coverUri: store.selectedPhotos[0] ?? '',
        photoUris: store.selectedPhotos,
        photoCount: store.selectedPhotos.length,
        date: Date.now(),
        status: 'draft',
        savedToAlbum: false,
        persona: store.persona,
      });

      push('Done! ✓', 100);
      router.replace('/review');

    } catch (e: any) {
      // AbortError means the user cancelled — don't show an error
      if (!cancelled.current && e?.name !== 'AbortError') {
        setError(e?.message ?? 'Unknown error');
      }
    }
  }

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.3, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    );
    pulse.start();

    run().then(() => pulse.stop()).catch(() => pulse.stop());
    return () => {
      cancelled.current = true;
      abortRef.current.abort(); // cancel any in-flight backend fetch
    };
  }, []);

  function handleCancel() {
    cancelled.current = true;
    abortRef.current.abort();
    router.back();
  }

  const methodLabel =
    store.method === 'claude' ? 'Claude AI' :
    store.method === 'openai' ? 'GPT-4o' :
    'Auto Select';

  return { steps, error, progress, scrollRef, pulseAnim, handleCancel, methodLabel };
}
