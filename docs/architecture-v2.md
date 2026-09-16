# Pixory v2 — Re-architecture and Bug-Fix Plan

> Status: proposal · Date: 2026-09-09
> Scope: the mobile app (`photosort-app`), the Node backend (`backend/src`) and the Python sidecar (`backend/publish_sidecar.py`, `backend/face_engines`).

---

## 1. Why this document exists

Pixory today is a **carousel curator**: pick a date range, score photos, let an LLM choose ten, post. Testing showed two things that don't work, implicit learning from review edits and face detection, and a code audit showed that the causes are architectural rather than incidental.

The product is also moving. The next Pixory opens on a **gallery that keeps itself clean**: as photos arrive it groups them into moments, collapses repeats, and flags the blurry, dark, eyes-closed and screenshot-shaped ones. Google Photos stacks by time; we go one step further and actually judge the stack. Curating and posting become actions you launch from a clean moment, not the reason you open the app.

This doc lays out an architecture that fixes today's problems and is built so that the gallery-cleaner is an extension, not a rewrite.

---

## 2. Where we are

### 2.1 Current pipeline

```
Photos.app ──getAssetsAsync──▶ rank by bytes/pixel ──top 120──▶ sidecar /score_photos
                                                               (OpenCV + InsightFace, all 5 modules)
        ◀── 6 scalars + faces ── persona formula × learning bias ◀──┘
        ──top 30 as base64──▶ GPT-4o "build a carousel" ──▶ roles / order / captions
        ──▶ Review screen ──edits──▶ running averages of 6 scalars (per persona)
```

### 2.2 What the audit found (summary)

The full write-up is in the session transcript; the short version, grouped by root cause:

**Learning is capped by its representation.** Six OpenCV scalars (sharpness, brightness, contrast, saturation, edge density, face count) cannot express *beach vs. city*, *candid vs. posed* or *what a clean composition looks like*. Even with every bug fixed, the learner can only ever learn "you like sharp, saturated photos". On top of that:

| # | Bug | Where |
|---|-----|-------|
| L1 | Kept AI picks are recorded as "promoted"; promoted average converges on the AI's own taste and unlocks the 5-example gate after one untouched session | `app/screens/review/hooks.ts:234` |
| L2 | Cosine similarity on all-positive vectors is inert (±5 %), then applied to a raw score dominated by codec and resolution | `lib/learning/bias.ts:66`, `lib/photos/scoring.ts:219` |
| L3 | The LLM receives `quality 250000000/100` because the raw score is never normalised | `app/screens/processing/hooks.ts:344`, `backend/src/services/aiCurator.ts:31` |
| L4 | Default features (0.5 / 0.3) are recorded for photos the sidecar never scored | `lib/learning/storage.ts:94` |
| L5 | No idempotency: promote→deselect→promote counts twice; reject→promote counts in both buckets | `app/screens/review/hooks.ts:152` |
| L6 | Resumed drafts have a stale scored list and tray; nothing is learned | `app/screens/home/hooks.ts:34` |
| L7 | Scored candidates are scaled ×0.2–1.0 but the unscored remainder keeps its raw score, so unscored photos outrank scored ones | `lib/photos/scoring.ts:219-234` |
| L8 | Per-persona keying fragments already-sparse data; Taste screen and bias disagree | `lib/learning/*` |

**Face detection fails silently at three layers.**

| # | Bug | Where |
|---|-----|-------|
| F1 | `FaceAnalysis` loads all five buffalo_l modules; 1.58 s per 6-face photo vs 0.15 s detection-only. 120 people-heavy photos can exceed the 120 s proxy timeout → silent fallback to file-size ranking, zero faces | `backend/face_engines/insightface_engine.py:38`, `backend/src/routes/score.ts:11` |
| F2 | With the my-face filter on, a scoring failure drops *every* photo ("not face-checked") | `app/screens/processing/hooks.ts:223` |
| F3 | A persisted `faceEngine: 'deepface'` pref from the earlier build is still honoured with no UI to change it; the DeepFace engine reports **1 face for every no-face image** (whole-frame region, `face_confidence` unchecked) | `lib/store/persistence.ts:39`, `backend/face_engines/deepface_engine.py:34` |
| F4 | An identity registered under DeepFace returns `null` from `embeddingForEngine`; filter skipped with only a log line | `lib/identity/storage.ts` |
| F5 | The LLM is asked to do face matching; vision models decline to identify real people. `is_user` is set even when no face was verified | `backend/src/services/promptBuilder.ts:89` |
| F6 | Fail-open in sidecar, route and app means a broken filter is indistinguishable from a working one | `lib/api/face.ts`, `backend/src/routes/face.ts:55` |

**Other defects worth fixing in the same pass.**

| # | Bug | Where |
|---|-----|-------|
| O1 | Encode failure compacts `photosBase64` but metadata and returned indices index the uncompacted list → every AI pick shifts by one | `app/screens/processing/hooks.ts:300-370` |
| O2 | Review edits never persist; `loadSession` has no caller | `app/screens/review/hooks.ts`, `lib/store/session.ts` |
| O3 | Any add/remove triggers re-label which re-sorts by beat and overwrites the user's manual order | `app/screens/review/hooks.ts:121` |
| O4 | Hard-coded LAN IP as default backend URL, currently modified in the working tree | `lib/store/state.ts:97` |
| O5 | `applyDiversityBonus` runs after selection; affects nothing | `lib/photos/selection.ts:230` |
| O6 | No timeout on `scoreWithBackend` / `assignRoles` fetches | `lib/photos/scoring.ts:183`, `lib/api/curate.ts:86` |
| O7 | Backend Claude model id is stale; Claude path parked | `backend/src/config.ts` |

**What is sound and stays.** Persona idea, activity clustering, burst + pHash dedup, re-label index mapping, abort handling, story history, the InsightFace engine itself (correct on samples: 6 faces, 3 smiling, consistent 512-d ArcFace embeddings). 66 app tests and 25 backend tests pass; both projects typecheck.

---

## 3. Product direction

**Today:** "Make me a carousel from these dates."
**Next:** "Keep my gallery clean, and make me a carousel from any moment in it."

The gallery-cleaner needs, per photo and continuously:

- **Moments** — same grouping Google Photos does by time and place (we already have `buildActivityClusters`).
- **Stacks** — within a moment, sets of photos that are the *same shot*: bursts, re-takes, near-duplicates from a different angle.
- **Verdicts** — per photo flags with confidence: `blurry`, `eyes-closed`, `under/over-exposed`, `duplicate-of`, `utility` (screenshots, receipts), `dark`, later `unflattering`, `finger-in-frame`, …
- **A best pick per stack** and a clean "keepers" view; deletions are suggestions the user confirms, and each confirmation or override is training data.

Everything the carousel curator needs (quality, faces, diversity, taste) is a subset of this. So the architecture is designed around the cleaner, and curation becomes a *query* over the clean index.

---

## 4. Design principles

1. **Index once, cache forever.** Every photo gets a `PhotoRecord` computed exactly once (per index version) and stored on device. No stage ever re-reads pixels it has already seen.
2. **Every signal is a column.** Blur, exposure, faces, embedding, aesthetic score, pHash — all live on the record. Adding a signal adds a column and a detector, nothing else.
3. **Retrieval is pure math.** Selecting candidates for a brief is arithmetic over stored vectors and columns. It is instant, deterministic and testable offline.
4. **The LLM only narrates.** It sees ≤ 15 photos, already chosen, and returns roles, order, captions and reasons. It never selects from 30 and never does face identity.
5. **Learn on embeddings, not scalars.** Taste is a small model over 512-d image embeddings. Kept, promoted, rejected and verdict-overrides are distinct events with distinct weights.
6. **Every session is labelled data.** Candidates, machine pick, final user pick and every edit are logged. All scoring changes are evaluated against that log before shipping.
7. **Fail loud.** A stage that fails reports it and offers a retry. Silent fallback to a worse ranking is a bug, and unscored photos are never dropped.
8. **One embedding space, forever.** Pick the model once, version the index, and never mix spaces. Migrating models means re-indexing and resetting the taste model.
9. **Compute is a provider.** The same feature interface is served by the Python sidecar now and by Core ML on the phone later, in the same embedding space, so the move on-device is a swap, not a rewrite.

---

## 5. Target architecture

```
                 ┌──────────────── Phone ────────────────────────────────────────────┐
                 │  Ingest ──▶ Index ──▶ Analyze ──▶ Retrieve ──▶ Narrate ──▶ Review  │
                 │    │          │         │            │            │          │      │
Photos.app ──────┘    │          │         │            │            │          ▼      │
 (change listener)    │          │         │            │            │      Learn      │
                      ▼          ▼         ▼            ▼            ▼          │      │
                 ┌──────────── SQLite: photos · faces · moments · stacks · verdicts · │
                 │             sessions · taste_model · index_meta                  ◀─┘
                 └───────────────────────────────────────────────────────────────────┘
                      │ FeatureProvider (interface)
          ┌───────────┴─────────────┐
   SidecarProvider (now)     OnDeviceProvider (phase 4)
   Python: MobileCLIP-S2,    Core ML MobileCLIP-S2, Vision framework
   InsightFace det + 106-lm, (face landmarks, aesthetics/isUtility),
   OpenCV, pHash             Laplacian in Swift, pHash
          │
   Node gateway: LLM calls via AI SDK (Gemini Flash / GPT / Claude), publish
```

### 5.1 Data model (on-device SQLite via `expo-sqlite`)

```ts
interface PhotoRecord {
  assetId: string;            // PHAsset local identifier (primary key)
  contentHash: string;        // sha1 of first 64 KB + size — detects edits/re-imports
  indexVersion: number;       // bump → re-index
  capturedAt: number;         // ms epoch
  lat?: number; lon?: number;
  width: number; height: number; isFavorite: boolean; isScreenshot: boolean;
  localUri?: string;          // may go stale; re-resolved on demand

  // Vision signals (0–1 unless noted)
  sharpness: number;          // Laplacian variance, log-normalised
  exposure: { mean: number; clipLow: number; clipHigh: number };
  contrast: number; saturation: number; complexity: number;
  aesthetic?: number;         // Vision framework score on device, learned head on server
  phash: string;              // 64-bit hex

  // Semantics
  embedding: Float32Array;    // MobileCLIP-S2, 512-d, L2-normalised (BLOB)

  // People
  faces: FaceRecord[];
}

interface FaceRecord {
  bbox: [x, y, w, h];         // fraction of frame
  embedding?: Float32Array;   // ArcFace 512-d — only computed when identity matching is needed
  eyeAspectRatio: [left, right];
  eyesOpen: boolean;          // EAR > 0.2 on both eyes
  smile: number;              // 0–1 from HSEmotion
  blur: number;               // Laplacian on the face crop (face-local sharpness)
  isUser?: boolean;           // cosine ≥ 0.35 vs registered identity
}

interface Moment  { id: string; photoIds: string[]; start: number; end: number; centerLat?: number; centerLon?: number; placeLabel?: string }
interface Stack   { id: string; momentId: string; photoIds: string[]; bestPhotoId: string; kind: 'burst' | 'near-dup' | 'same-scene' }
interface Verdict { photoId: string; kind: VerdictKind; confidence: number; detectorVersion: string; userDecision?: 'confirmed' | 'overridden' }
type VerdictKind  = 'blurry' | 'eyes-closed' | 'underexposed' | 'overexposed' | 'duplicate' | 'utility' | 'dark' | string;

interface SessionLog {         // one per curation run
  id: string; createdAt: number; brief: Brief; persona?: string;
  candidateIds: string[]; machinePickIds: string[]; finalPickIds: string[];
  events: LearnEvent[];
}
type LearnEvent =
  | { t: 'kept'; photoId }            // AI pick left in place              weight 0.3
  | { t: 'promoted'; photoId }        // added from tray/library            weight 1.0
  | { t: 'rejected'; photoId }        // AI pick removed                    weight 1.0
  | { t: 'reordered'; from; to }
  | { t: 'verdict-confirmed'; photoId; kind } | { t: 'verdict-overridden'; photoId; kind };

interface TasteModel { version: number; w: Float32Array /* 512 */; b: number; n: number; updatedAt: number }
```

The four JSON files (`pixory_learning_v2`, `pixory_stories_v1`, `pixory_identity_v1`, `pixory_prefs_v1`) migrate into tables; the learning file is discarded (its data is polluted, see L1/L4).

### 5.2 FeatureProvider interface

```ts
interface FeatureProvider {
  capabilities(): { embed: boolean; faces: boolean; landmarks: boolean; aesthetic: boolean };
  index(batch: { assetId: string; jpeg512: Uint8Array }[]): Promise<Partial<PhotoRecord>[]>;
  embedText(texts: string[]): Promise<Float32Array[]>;           // persona prompts, brief
  faceEmbeddings(batch: { assetId; jpeg512 }[]): Promise<FaceRecord['embedding'][][]>; // on demand
}
```

**SidecarProvider** (Phase 1) = one new endpoint `POST /index` returning everything in one pass per photo. **OnDeviceProvider** (Phase 4) = Core ML MobileCLIP-S2 image/text encoders + Vision `VNDetectFaceLandmarksRequest` (eye landmarks → EAR) + `VNCalculateImageAestheticsScoresRequest` (score + `isUtility`) + Laplacian and pHash in Swift, inside the existing `modules/vision-scorer`. Same embedding model on both sides, so records are interchangeable.

### 5.3 Stages

**Ingest.** On app open: `getAssetsAsync` with `createdAfter = lastIndexedAt`, plus a cheap reconciliation of asset count per month to catch deletions. In the foreground, `MediaLibrary.addListener` pushes changes. Later (Phase 4) `expo-background-task` runs the same delta job. Newly seen assets are enqueued; the queue is drained in batches of 16 through the provider, newest first so the "today" moment is ready first.

**Index.** Per photo, once: decode a 512-px thumbnail, run the provider, write the `PhotoRecord`. Face embeddings are *not* computed here (recognition is 5× the cost of detection); they are computed lazily for photos with faces when the my-face filter or a people query needs them, then cached.

**Analyze** (pure functions over records, re-run incrementally per moment):

- *Moments*: `buildActivityClusters` as today (30 min / 1.5 km gaps).
- *Stacks*: union-find inside a moment on any of: burst (Δt ≤ 3 s), pHash Hamming ≤ 6, embedding cosine ≥ 0.92 *and* Δt ≤ 10 min. Best-of-stack = quality score (below), ties broken by eyes-open count then favourite.
- *Verdicts* — each is a `Detector` returning `Verdict[]`; adding a kind is adding a file:

| Kind | Rule (initial, all tunable) |
|------|------|
| `blurry` | sharpness < 0.35 × median sharpness of the moment **and** absolute < threshold; face-local blur overrides for people shots |
| `eyes-closed` | any face with both EAR < 0.18 and face width > 6 % of frame |
| `underexposed` / `overexposed` | clipLow > 0.25 or clipHigh > 0.25 |
| `dark` | exposure.mean < 0.12 and not flagged aesthetic |
| `duplicate` | member of a stack and not `bestPhotoId` |
| `utility` | `isScreenshot` or Vision `isUtility` or PNG aspect matching the device screen |

Thresholds live in one table and are per-user adjustable: every `verdict-overridden` event nudges that kind's threshold for that user (simple isotonic step). Verdicts never delete; they populate a "Review clean-up" screen where the user confirms.

**Retrieve** (for a brief = dates, place, story text, persona):

```
score(p) = w_q · quality(p)                    // 0–1 composite: sharpness, exposure, aesthetic, no verdicts
         + w_v · cos(E(p), T(brief.story))     // vibe match
         + w_p · max_i cos(E(p), T(persona_i)) // persona = 3–6 text prompts, not a weight table
         + w_t · σ(taste.w · E(p) + taste.b)   // learned taste, only after n ≥ 8 events
         + w_f · favourite
gates:   drop if verdict ∈ {duplicate, utility} or confidence-weighted blurry/eyes-closed
         drop if my-face filter on and faces present and no face isUser
spread:  greedy pick with per-moment cap and embedding-diversity penalty (cos to already-picked > 0.85 → −0.2)
```

Output: 12–15 candidates with their metadata. Default weights `w_q 0.35, w_v 0.25, w_p 0.15, w_t 0.20, w_f 0.05`; tuned against session logs (§7).

**Narrate.** One provider-agnostic call through the AI SDK (`generateObject` + Zod schema): images at 512 px with the same one-line labels as today, but `quality` is the 0–1 composite ×100, and a one-line **taste clause** derived from the taste model ("this user keeps wide, low-people, warm-light shots; skips crowded interiors"). Returns `{story, selected:[{index, role, reason}], ordering, missing, captions}`. Re-label after a review edit reuses the same call with the current set; ordering respects the user's manual order unless roles change.

**Review.** Same screen, three changes: edits write through to `store.selectedPhotos`, the draft story and a `SessionLog`; the tray is rebuilt from the index for resumed drafts; manual reorder is sticky.

**Learn.** On "Next": kept/promoted/rejected events with embeddings → online logistic regression on 512-d (one pass, learning rate 0.05, L2 0.01), weights 0.3 / 1.0 / 1.0. Idempotent per `(session, photo)`: the last event wins. `TasteModel` is global, with the persona as an input feature only if it proves useful in evaluation (§7). The Taste screen reads the same model: project the weight vector onto persona prompts and a fixed vocabulary of descriptors ("golden hour", "crowd", "food", "architecture") to produce the narrative.

### 5.4 Face identity

- Engine fixed to InsightFace; the `faceEngine` pref is deleted and ignored on load; a legacy DeepFace identity triggers a one-time "re-add your selfie" prompt.
- Registration accepts 1–3 selfies and stores the mean ArcFace vector.
- Counting uses `allowed_modules=['detection','landmark_2d_106']` (0.15 s/photo); recognition runs only for `faceEmbeddings()` on demand.
- The LLM face clause is removed. `is_user` is set only from a verified match.
- Failures surface in the UI as "Face check unavailable — retry / continue without" instead of fail-open.

### 5.5 Services

- **Sidecar (Python)** keeps publishing + compute. New `/index`, `/embed_text`, `/face_embeddings`; `/score_photos` and `/match_faces` retired after Phase 1. Two uvicorn workers as in `sidecar.Dockerfile`.
- **Gateway (Node)** keeps LLM + publish routes; adds `/api/narrate` behind the AI SDK with `provider` ∈ {google, openai, anthropic} chosen by env or request. Timeouts on every hop; the app's fetches get `AbortSignal.timeout` too.
- Backend URL: remove the hard-coded LAN default; QR/deep-link pairing from `start.sh`'s printed URL, and a visible "not connected" state.

---

## 6. Bug-fix plan (Phase 0)

Ordered so each step is independently shippable and testable.

1. **Stop dropping unscored photos** (F2, L7). Only apply the "not face-checked" filter when scoring succeeded; normalise `qualityScore` to 0–1 before persona/learning math so scored and unscored photos are comparable. Tests: scoring fails → selection unchanged in size.
2. **Make scoring fast enough to finish** (F1). `allowed_modules=['detection']` for `/score_photos`, separate cached `FaceAnalysis` with recognition for `/match_faces`. Add `AbortSignal.timeout(120_000)` on the phone (O6). Surface failure in the processing log as an error with retry.
3. **Kill the stale engine path** (F3, F4). Ignore `saved.faceEngine`; if `identity.engine !== 'insightface'`, disable the filter and route to face setup. Fix `DeepFaceEngine.analyze` to drop regions with `face_confidence < 0.5` even though the engine is now unused.
4. **Fix the quality label** (L3). Send `Math.round(normalised * 100)`.
5. **Fix encode-index alignment** (O1). Build `photoMetadata`, `favoriteIndices` and the index→photo map from the compacted encode results, exactly as the reorganize path already does.
6. **Separate kept from promoted, record only real features** (L1, L4, L5). Three counters, weights 0.3/1.0/1.0; skip photos with `sharpness === undefined`; keep a per-session `(photo → last event)` map so toggles are idempotent. Reset the learning file to v3.
7. **Persist review edits and rebuild the tray** (L6, O2, O3). Write through on every edit; on draft resume rebuild `localPhotos`/runner-ups from the last scored set saved alongside the story; keep manual order after re-label unless roles moved hook/closer.
8. **Remove the LLM face clause** (F5) and the fail-open in `lib/api/face.ts` (F6): return `{ok:false}` and let the caller decide.
9. **Start session logging** (§7). Even before the new index exists, log candidates, machine pick and final pick per run to `pixory_sessions_v1.json`. This is the dataset every later phase is measured on.
10. Housekeeping: remove `applyDiversityBonus` (O5), LAN IP default (O4), update the Claude model id (O7).

---

## 7. Evaluation

Nothing about "good photos" can be validated by unit tests alone, so the plan hinges on the session log.

**Dataset.** Each `SessionLog` yields labelled pairs: for every candidate, `final ∈ {kept, promoted, rejected, untouched-tray}`. After ~20 sessions this is enough to compare rankers offline. Also collect a small hand-labelled set (200 photos) for verdicts: blurry / eyes-closed / duplicate / utility.

**Metrics.**

| Question | Metric | Target (v2 vs today) |
|---|---|---|
| Does retrieval find what the user keeps? | precision@10 of machine pick vs final pick | ↑ over sessions |
| Does the user have to fix less? | edits per session (add + remove) | ↓ over sessions |
| Is the taste model learning? | AUC of `taste.w·E(p)` for kept vs rejected on held-out sessions | > 0.7 after 10 sessions |
| Stack detection | precision / recall vs hand labels | > 0.95 / > 0.85 |
| Verdicts | acceptance rate per kind in the clean-up screen | > 0.8 |
| Face filter | false-drop rate (photo with user removed) | < 2 % |

**Harness.** Replace `backend/scripts/eval_*.ts` with one `npx tsx scripts/eval.ts --sessions <dir>` that replays retrieval with a given config and prints the table above. Persona prompts, weights and thresholds are config, so tuning is a loop of edit → replay, never edit → rebuild the app.

---

## 8. Phases

| Phase | Outcome | Main work | Exit criteria |
|---|---|---|---|
| **0 · Stabilise** (≈1 week) | Today's flow works and is observable | §6 fixes, session logging, timeouts, error surfacing | Face filter verified end-to-end on a real library; 5 logged sessions |
| **1 · Index** (≈2 weeks) | Every photo in range has a `PhotoRecord` in SQLite | `expo-sqlite` schema + migrations; sidecar `/index` with MobileCLIP-S2 + detection + 106-landmarks + OpenCV + pHash; `SidecarProvider`; delta ingest on app open; file-size prefilter deleted | Indexing 300 photos < 60 s on the Mac; re-run is instant |
| **2 · Retrieve + Narrate + Learn** (≈2 weeks) | Curation runs on the index; LLM is provider-agnostic | Retrieval scorer, persona prompts, diversity; AI SDK `/api/narrate` with Gemini Flash default and Zod schema; logistic taste model; Taste screen on the new model; eval harness | precision@10 ≥ today on replayed sessions; Gemini/GPT/Claude switchable by env |
| **3 · Cleaner** (≈3 weeks) | The gallery-cleaner ships | Moments/Stacks/Verdicts analyzers + detectors; "Clean up" screen (stack browser, verdict cards, confirm/override); foreground change listener; Home becomes the moments grid; curation launched from a moment | Verdict acceptance ≥ 0.8 on the hand-labelled set; user-tested on a 5 k-photo library |
| **4 · On-device** (≈3 weeks, needs dev build) | Compute leaves the sidecar for indexing | `OnDeviceProvider`: Core ML MobileCLIP-S2 + Vision landmarks/aesthetics + Swift Laplacian/pHash; `expo-background-task` delta indexing; whole-library backfill; sidecar only for identity embeddings and publishing | Whole library indexed with no server; identical records to the sidecar on a fixture set |

Phases 3 and 4 can swap order if the dev build is ready early; the interface in §5.2 is what makes that possible.

---

## 9. Risks and open questions

- **Embedding model commitment.** MobileCLIP-S2 is chosen for the one-space-on-both-sides property. If quality on retrieval is insufficient, the fallback is SigLIP 2 base on the server only, accepting that on-device would then need a second index. Decide by the end of Phase 2 using the harness.
- **Aesthetic score.** The LAION head is trained on OpenAI CLIP ViT-L/14 embeddings, not MobileCLIP. Until Phase 4 (Vision framework score on device) the composite quality uses sharpness/exposure only, plus a head trained on session logs once there are enough.
- **Threshold calibration.** All verdict thresholds in §5.3 are starting points; the hand-labelled set is required before the clean-up screen ships.
- **LLM model churn.** Model ids live in env, never in code. The Zod schema is the contract; providers are interchangeable behind the AI SDK.
- **Battery and thermal** on device indexing (Phase 4): batch on charge + Wi-Fi via the background task; cap at N photos per wake.
- **Deletion UX.** The cleaner proposes; the user disposes. Deleting from Photos.app moves to "Recently Deleted", which is the safety net, but confirm-per-stack is still the default.
- **Open:** should the Node gateway be folded into the Python service? It adds a hop for compute and only earns its keep for the AI SDK and publishing. Revisit after Phase 2.

---

## 10. Appendix — sidecar `/index` response

```json
{
  "records": [{
    "index": 0,
    "sharpness": 0.71, "exposure": {"mean": 0.48, "clipLow": 0.01, "clipHigh": 0.03},
    "contrast": 0.55, "saturation": 0.41, "complexity": 0.22,
    "phash": "c3d2e1f0a9b8c7d6",
    "embedding_b64": "<512 float32, little-endian>",
    "faces": [{"bbox": [0.31, 0.22, 0.18, 0.24], "ear": [0.27, 0.29], "eyes_open": true, "smile": 0.83, "blur": 0.66}]
  }],
  "index_version": 1,
  "embedding_model": "mobileclip-s2"
}
```
