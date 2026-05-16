# Pixory — Task Sheet

> Last updated: 2026-05-15
> Status key: ✅ Done · 🔄 Has issues · ⏳ Pending · 🚫 Blocked

---

## 🔴 Critical — Core flow blockers

| # | Task | Status | Notes |
|---|------|--------|-------|
| C-1 | **GPS / location filter** | ✅ | `parseFloat` fix resolved string-vs-number bug in `expo-media-library`. Working in Expo Go. Native `PHAsset.fetchAssets` path activates on dev build (H-1) |
| C-2 | **Reorganize ordering** | 🔄 | Encode-index mapping fix applied. AI occasionally misplaces CLOSER badge — still being tuned |
| C-3 | **Backend URL on device** | ⏳ | `localhost:8000` resolves to the phone, not the Mac. User must set Mac LAN IP manually. Need auto-detect or a clear hint in the UI |
| C-4 | **Instagram publish screen** | 🔄 | Credentials stored via `expo-secure-store` ✅. Instagram location tagging via `cl.location_search` wired end-to-end ✅. Dedicated `instagram-account.tsx` screen still pending |
| C-5 | **Thumbnails blank in caption + publish** | ⏳ | `thumbnailUrl()` sends a `file://` path to the backend which can't open it. Replace with direct `localUri` on both screens |

---

## 🟠 High Priority — Important but not blocking

| # | Task | Status | Notes |
|---|------|--------|-------|
| H-1 | **Build dev build** | ⏳ | One-time `npx expo run:ios`. Activates native `getAssetLocations` (GPS) and sidecar scoring on-device |
| H-2 | **Caption mood system** | ⏳ | Placeholder chips. Replace with 4 AI-generated mood tabs: Wanderlust / Minimal / Story / Playful |
| H-3 | **Session recovery** | ⏳ | `saveSession` / `loadSession` exist in `store.ts` but nothing triggers restore on app reopen |
| H-4 | **10-photo carousel cap** | ⏳ | No guard in `/api/publish_from_device` — posting >10 photos fails silently or risks account flag |
| H-5 | **Classic mode spread** | ✅ | Activity-cluster windowing in `selectBestPhotos()` — guarantees timeline spread |
| H-6 | **Runner-up tray** | ✅ | Horizontal scroll tray in review screen, promote/demote working |
| H-7 | **Pixory credit + post location** | ✅ | Credit changed to "Curated with Pixory ✨", always appended (no toggle). Location input added to caption screen, shown as 📍 in final post text |
| H-8 | **Persona picker + story field** | ✅ | Replaced vibe chips + content mix in `index.tsx` with 5-persona cards and "What's the story?" field |
| H-9 | **Per-persona scoring** | ✅ | `computePersonaScore()` uses 9 sidecar signals; Storyteller diversity bonus in `topCandidates()` |
| H-10 | **Active AI review** | ✅ | Debounced `assignRoles` call on selection change; role badges on each photo |
| H-11 | **Story banner + role badges** | ✅ | HOOK / WORLD / LIFE / DETAIL / CLOSER with colour codes in review screen |
| H-12 | **Implicit preference learning** | ⏳ | Learn from what the user keeps, rejects, promotes from runner-up tray, and adds from favorites — refine scoring weights and AI prompt over time. See design notes below |
| H-13 | **Cloud backend + remove URL field** | ⏳ | Deploy backend to Railway (or Fly.io). Hard-code the production URL, remove the backend URL input from settings entirely. Updates to curation logic ship automatically without users doing anything |

---

## 🟡 Operational — Performance, reliability, dev experience

| # | Task | Status | Notes |
|---|------|--------|-------|
| O-1 | **Parallel scoring encode** | ✅ | Batches of 10 via `Promise.allSettled` — was a sequential for-loop |
| O-2 | **AI payload size** | ✅ | Candidates 50 → 30, encode width 1280 → 768px |
| O-3 | **GPT-4o timeout** | ✅ | 90s on backend OpenAI call, 120s `AbortController` on mobile fetch |
| O-4 | **Geocoding permission** | ✅ | `requestForegroundPermissionsAsync` called before `geocodeAsync` |
| O-5 | **Location diagnostics** | ✅ | GPS count logged after load; sample coords shown when radius mismatch |
| O-6 | **Eval: persona scoring** | ✅ | `npx tsx backend/scripts/eval_persona_scoring.ts` |
| O-7 | **Eval: sidecar signals** | ✅ | `python backend/scripts/eval_sidecar_signals.py` |
| O-8 | **Eval: prompt clauses** | ✅ | `npx tsx backend/scripts/eval_prompt_clauses.ts` |
| O-9 | **iCloud skip warning** | ⏳ | Photos without `localUri` are silently skipped — show skipped count in progress log |
| O-10 | **Geocoding cache** | ⏳ | Place name geocoded fresh every run — cache result in `store` for the session |
| O-11 | **Sidecar signals** | ✅ | brightness, brightness_quality, contrast, saturation, complexity added to `PhotoScore` |
| O-12 | **Score + assign timeout** | ⏳ | `scoreWithBackend` and `assignRoles` fetch calls have no abort timeout — can hang indefinitely if backend drops mid-request |
| O-13 | **Backend URL LAN hint** | ⏳ | Show detected Mac LAN IP below the backend URL field so users know what to enter |
| O-14 | **Photo metadata cache** | ⏳ | Cache `getAssetInfoAsync` results (localUri, GPS, fileSize, isFavorite) keyed by date range. 200 photos = 200 sequential bridge calls every run even when nothing changed. Invalidate when asset count in range changes. See design notes below |

---

## 🔵 Future — Phase 2 and beyond

| # | Task | Status | Notes |
|---|------|--------|-------|
| F-1 | **Feed analyzer** | ⏳ | Scan existing Instagram posts → infer persona automatically |
| F-2 | **Custom persona creator** | ⏳ | "Describe your posting style" → AI generates a bespoke persona profile |
| F-3 | **Face identity system — self filter** | ✅ | "Who Are You?" setup screen, DeepFace embedding stored in `pixory_identity_v1.json`, per-curation `match_faces` filter removes photos with faces ≠ you. Adding more people is future work |
| F-4 | **Photo editing tools** | ⏳ | Crop / Adjust / Filters / Draw screen between review and caption |
| F-5 | **Pick from library escape hatch** | ⏳ | "+" button in review opens full device photo picker filtered to same date range |
| F-6 | **Drag-and-drop reorder** | ⏳ | Manual reorder of selected photos in review grid |
| F-7 | **5-tab bottom nav** | ⏳ | Standardise navigation across all screens per prototype |
| F-8 | **Graph API publishing** | ⏳ | Replace `instagrapi` (unofficial) with official Instagram Graph API + S3/R2 CDN for image hosting |
| F-9 | **Job store persistence** | ⏳ | Backend `_jobs` dict lost on Railway sleep — migrate to SQLite |
| F-10 | **Cross-post toggle** | ⏳ | Share to Threads / Facebook toggle on publish screen |
| F-11 | **Peak engagement scheduling** | ⏳ | "Best time to post" prediction surfaced on publish screen |
| F-12 | **iCloud GPS via dev build** | ⏳ | Native `getAssetLocations` (PHAsset.fetchAssets) activates automatically once H-1 is done |
| F-13 | **Direct AI fallback** | ⏳ | If backend unreachable, retry via direct Anthropic API call from device |
| F-14 | **UI/UX design upgrade** | ⏳ | Full visual pass to match Stitch mocks — Plus Jakarta Sans / Inter typography, colour token system, gradient CTAs, glass overlays, spacing grid. Affects all screens |
| F-15 | **Curation history — drafts + posted** | ⏳ | Every curation gets a name and is saved locally. Unposted = draft (resume from review screen). Posted = view-only archive. Home screen shows both lists. See design notes below |

---

## 📐 Design notes

### O-14 — Photo metadata cache

`getAssetInfoAsync` is an async bridge call to the native Photos framework — called once per photo. 200 photos in a date range = 200 sequential round-trips every time the user runs a curation, even if they just tapped "retry" or came back to the same trip.

**Cache key:** `${dateFrom}_${dateTo}_${assetCount}` where `assetCount` is the total from `getAssetsAsync` (cheap). If the count hasn't changed for the same date range, the metadata is the same.

**What to cache per photo:**
```json
{
  "id": "asset-local-id",
  "localUri": "file:///var/...",
  "lat": 47.649,
  "lon": -122.343,
  "fileSize": 4821234,
  "isFavorite": false,
  "creationTime": 1734432437000
}
```

**Storage:** `pixory_photo_cache_v1.json` in `DocumentDirectory`. Keep only the last 3 date-range entries (trips). Each entry is ~200 bytes × 200 photos = ~40KB — trivial.

**Invalidation rules:**
- Asset count in range changes (photo added or deleted) → bust cache for that range
- isFavorite is excluded from cache key — re-fetch `isFavorite` from a lightweight `getAssetInfoAsync` pass only (skip fileSize/GPS which are the slow parts)
- Cache entries older than 30 days are dropped on next open

**Expected speedup:** metadata loading step goes from ~8s (200 × 40ms bridge calls) to ~0.2s (JSON parse). GPS, fileSize, and localUri are all stable for historical photos.

---

### H-12 — Implicit preference learning

Every curation session is a micro-dataset. The user's edits to the AI's initial pick reveal what they actually value — without them filling in a form.

**Signals to capture per session:**

| Signal | What it reveals |
|--------|----------------|
| Photo kept from AI selection unchanged | Strong approval — AI taste matched |
| Photo deselected from AI selection | Rejection — that photo type is wrong for this user |
| Photo promoted from runner-up tray | AI undervalued this — note its sidecar feature values |
| Photo added from favorites tray | Strong personal attachment — note recurrence across sessions |
| Final order vs. AI-suggested order | Sequencing instinct |
| Persona chosen vs. actual edits made | Does the chosen persona match real behaviour? Drift = auto-suggest persona switch |

**Storage** — `pixory_preferences_v1.json` in `DocumentDirectory`. Each session appends a compact record:

```json
{
  "sessionId": "uuid",
  "persona": "aesthete",
  "kept": [
    { "sharpness": 0.90, "complexity": 0.10, "saturation": 0.55, "faces": 0 }
  ],
  "rejected": [
    { "sharpness": 0.40, "complexity": 0.80, "saturation": 0.60, "faces": 3 }
  ],
  "promoted": [
    { "sharpness": 0.70, "complexity": 0.30, "saturation": 0.45, "faces": 1 }
  ],
  "addedFromFavorites": 2,
  "reorderedCount": 3,
  "finalCount": 8
}
```

**How it feeds back:**

- **After ~3 sessions:** derive per-signal weight adjustments. If the user consistently promotes high-sharpness photos and rejects high-complexity ones, boost `sharpness` weight and penalise `complexity` beyond the persona default.
- **AI prompt clause:** inject a `userPreferenceClause` summarising the pattern — *"In past sessions this user consistently promoted sharp, minimal compositions and rejected busy crowd shots — weight accordingly even when persona says otherwise."*
- **Home screen nudge:** *"We've noticed you always keep the cleanest shots. Your taste profile is tuning itself."*
- **Long-term:** replace static persona weight vectors with a fully personalised vector derived from accumulated session history. Persona becomes the starting point, not the fixed answer.

**Privacy:** all preference data stays on-device. Never sent to the backend. Future opt-in cloud sync would encrypt before upload.

### F-15 — Curation history: drafts + posted archive

Every curation is a named, persistent record stored entirely on-device. Two states: **Draft** (not yet posted, resumable) and **Posted** (view-only record).

**Curation record schema:**
```json
{
  "id": "uuid",
  "name": "Tokyo — December 2024",
  "status": "draft",
  "createdAt": 1734432437000,
  "updatedAt": 1734512000000,
  "postedAt": null,
  "dateFrom": "2024-12-10",
  "dateTo": "2024-12-17",
  "locationName": "Tokyo, Japan",
  "persona": "aesthete",
  "vibe": "Three days eating through Shibuya",
  "selectedPhotoUris": ["file:///var/...", "..."],
  "photoRolesByUri": { "file:///var/...": "hook" },
  "storyDescription": "From ramen at dawn to...",
  "missingBeat": null,
  "captions": [{ "mood": "minimal", "text": "...", "hashtags": [] }],
  "chosenCaption": { "mood": "minimal", "text": "..." },
  "coverPhotoUri": "file:///var/..."
}
```

**Naming:**
- Auto-generated on curation start: `{locationName} — {month} {year}` (e.g. "Tokyo — December 2024")
- User can rename at any point — tap the title on the processing or review screen
- If no location: `{dateFrom} to {dateTo}`

**Draft behaviour:**
- Saved to disk after every meaningful change (selection update, caption edit, role reassignment)
- Home screen "Drafts" section shows all unposted curations as cards with cover photo, name, date, photo count, and "Continue" CTA
- Tapping "Continue" deep-links directly to the review screen with full state restored — no re-fetching, no re-scoring
- Drafts are never auto-deleted (user explicitly discards)

**Posted behaviour:**
- On successful publish: status flips to `"posted"`, `postedAt` timestamp set
- Posted curations shown in a separate "Posted" section on home screen — same card layout, no "Continue" CTA
- Tapping opens a view-only screen: photo grid + the caption that was used + post date
- Photos shown from `selectedPhotoUris` — if a photo has been deleted from the device, show a placeholder

**Storage:**
- `pixory_curations_v1.json` in `DocumentDirectory` — array of all curation records
- Cover photo = first selected photo URI (HOOK role if available)
- No photo bytes stored — only URIs. If a URI is gone (photo deleted), gracefully degrade to placeholder

**Home screen layout:**
```
┌─────────────────────────────────┐
│  Drafts (2)                     │
│  [Tokyo Dec]  [Bali Jan]  →    │
│                                 │
│  Posted (5)                     │
│  [NYC]  [LA]  [London]  →      │
└─────────────────────────────────┘
```

**What this replaces:** the current single-session `store` fields (`selectedPhotos`, `captions`, etc.) become the "active curation" slot. On starting a new curation, if there's an active draft, prompt: *"You have an unfinished curation — continue or start fresh?"*

---

## ✅ Completed archive

| Task | When |
|------|------|
| Node.js backend scaffold (Fastify + TypeScript) | Early sessions |
| Claude Opus / Sonnet model split | Early sessions |
| ContentMix implementation (people / balanced / places) | Early sessions |
| Narrative AI prompt rewrite (HOOK/WORLD/LIFE/DETAIL/CLOSER schema) | Session 2 |
| Narrative propagation (story banner, photo_roles, ordering, missingBeat) | Session 3 |
| Storytelling persona system Phase 1 | Session 4 |
| GPS string-vs-number bug fix (`parseFloat`) | Session 5 |
| Parallel encoding for sidecar scoring | Session 5 |
| Reorganize encode-index mapping fix | Session 5 |
| GPT-4o timeout + payload size reduction | Session 5 |
