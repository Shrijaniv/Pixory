# Handoff: Pixory Redesign (dark, Instagram-flavored)

## Overview
A full visual + flow redesign of Pixory — the app that, given a story brief, date range, location, and a chosen persona, pulls the user's gallery photos and curates the 10 best into an Instagram carousel (review → caption → publish). This redesign moves the app to a **dark, modern, social-media aesthetic** with a single **amber→coral accent on pure black**, fixes the flow (Home is now a hub, not a settings form), modernizes the Review/reorder UX (focused slide + drag filmstrip), makes the Caption screen actually preview the post, consolidates the Share screen, and **adds two new screens: Profile and Story Detail**.

## About the Design Files
The files in this bundle are **design references created in HTML** (they open in any browser). They are prototypes showing the intended **look and behavior** — they are **not** production code to copy directly. They are authored in a small HTML component format; ignore the framework specifics. Your task is to **recreate these designs in the existing `photosort-app` codebase** (Expo / React Native + expo-router), reusing its established patterns: the `lib/theme.ts` token file, the per-screen `index.tsx` / `styles.ts` / `hooks.ts` / `types.ts` structure under `app/screens/*`, `expo-image`, `react-native-safe-area-context`, etc. Keep all existing business logic (photo library access, scoring, Claude/OpenAI selection, Instagram posting) — this is primarily a **UI/UX reskin + flow change**, not a rewrite of the engine.

How to read each file (open in a browser):
- **Pixory Prototype.dc.html** — ⭐ the clickable, wired flow. Tap through it to understand navigation and screen states. This is the source of truth for behavior.
- **Pixory Hi-Fi.dc.html** — all 8 screens at full fidelity on one canvas + a "Foundations" design-system board (colors, type, components). Source of truth for exact styling.
- **Pixory Wireframes.dc.html** — low-fi structure/flow with annotations on what changed and why.
- **Pixory Warm Accents.dc.html** — the accent exploration that led to the chosen amber→coral. Reference only.

## Fidelity
**High-fidelity.** `Pixory Hi-Fi.dc.html` and `Pixory Prototype.dc.html` have final colors, typography, spacing, radii, and interactions. Recreate the UI to match, using React Native primitives and the existing token system. (`Pixory Wireframes.dc.html` is lo-fi and is for flow/rationale only.)

---

## Design Tokens

Replace the brand/accent half of `lib/theme.ts` with these. Keep the `Spacing`, and `Radius` scales; adjust `Colors` and `Typography` as below.

### Colors
```
// Base (pure black, layered charcoal surfaces)
bg            #0A0A0B   // app background
surface       #161618   // inputs, cards, secondary buttons
surfaceAlt    #141416   // preview cards, info chips
elevated      #1F1F22   // elevated components

// Lines / borders (use rgba over the black base)
line          rgba(255,255,255,0.08)
lineMid       rgba(255,255,255,0.10)
lineStrong    rgba(255,255,255,0.16)

// Text
text          #FAFAFA
textMuted     #9A9AA2
textFaint     #7A7A82
textDim       #5E5E66

// Accent — "Sunset" amber→coral. THE single brand accent.
accentGradient    linear-gradient 135deg  #FFAE3D → #FF5A4E   // CTAs, FAB, active chips, badges
accentGradientHero linear-gradient 130deg #FFAE3D → #FF7A45 → #FF5A4E  // big hero cards
accentSolid       #FF7A4D   // single-color accent (filmstrip active outline, small bits)
accentGlow        rgba(255,90,78,0.40)   // shadow under primary buttons/FAB
accentWash        rgba(255,90,78,0.08)   // tinted info panel bg
accentWashBorder  rgba(255,90,78,0.18)
accentText        #FF8A5A   // accent-colored helper text on dark
logoGradient      linear-gradient 120deg #FFC65A → #FFAE3D → #FF5A4E  // wordmark (clip to text)

// Status (semantic, unchanged across themes)
success       #4ED17A   // "Published", checks  (wash: rgba(78,209,122,0.12))
draft         #FFAE3D   // "Draft" badge        (wash: rgba(255,174,61,0.13))
error         #FF6B5A

// Instagram brand gradient — RESERVED. Use ONLY on the literal "Connect Instagram"
// screen icon, never as the app's own accent.
igGradient    135deg  #FEDA75 → #FA7E1E → #D62976 → #962FBF → #4F5BD5
```
In React Native, gradients require `expo-linear-gradient` (`<LinearGradient colors={[...]} start/end>`). The codebase already depends on it.

### Typography
Fonts: **Schibsted Grotesk** (UI + headings) and **Space Mono** (tiny numeric/label accents — time, counts, uppercase meta labels). Load via `expo-font` in `app/_layout.tsx` (replaces the current Plus Jakarta + Inter). Google Fonts families: `Schibsted Grotesk` (400,500,600,700,800), `Space Mono` (400,700).

```
display   Schibsted Grotesk 800, 22–30px, letter-spacing -0.02em   // screen titles, big numbers, logo
title     Schibsted Grotesk 700, 14–19px                            // card titles, headers
bodyLg    Schibsted Grotesk 500, 14px, line-height 1.5
bodyMd    Schibsted Grotesk 400/500, 12–13px, line-height 1.5–1.6
labelMono Space Mono 600, 9–10px, letter-spacing 0.12–0.16em, UPPERCASE, color textFaint  // section labels
mono      Space Mono 700, 10–12px   // status bar time, count pills
```

### Radius
cards/sheets 18–22 · inputs/secondary buttons 13–15 · photo tiles 9–14 · pills/toggles 999 · FAB 16

### Spacing
Screen horizontal padding 20px. Card inner padding 13–18px. Gaps between stacked sections 14–16px. Bottom tab bar padding 12px top / 22px bottom, 1px top border in `line`.

### Reusable component patterns
- **Primary button (CTA):** full-width, radius 15, padding 15, `accentGradient` fill, text `#fff` 700/14, shadow `0 10px 24px accentGlow`.
- **Secondary button / list card:** `surface` bg, 1px `lineMid` border, radius 13–16, text `#FAFAFA`.
- **Chip (persona/caption style):** pill; inactive = transparent + 1px `lineStrong` border + `textMuted`; active = `accentGradient` fill + `#fff`.
- **Toggle:** 38×22 pill. On = `accentGradient`, knob right. Off = `#2A2A2E`, knob left. Knob 18×18 white.
- **Photo placeholder (this redesign uses gradient stand-ins):** in production these are **real gallery photos** via `expo-image`. Use `contentFit="cover"`, `cachePolicy="memory-disk"`, radius per context. Add a subtle inner vignette overlay (`inset 0 -14px 24px rgba(0,0,0,.3)`) on large covers for legibility of overlaid badges.
- **Bottom tab bar:** 3 slots — Home (⌂), center **FAB ＋** (46×46, radius 16, `accentGradient`, lifted `margin-top:-8`, shadow `accentGlow`), Profile (◔). Active label uses accent (gradient-clipped text); inactive `textDim`.
- **Phone status bar / dynamic island:** OS chrome — do not build; RN safe-area handles it.

---

## Navigation map (expo-router)
Existing routes: `index`(home) · `processing` · `review` · `caption` · `publish`(share) · `face-setup`. **New routes to add: `profile`, `story-detail`** (or a detail route param). New-story setup is currently the home screen content; in the redesign **Home becomes a hub** and the setup form becomes its **own screen** (`new-story`).

Flow (see `Pixory Prototype.dc.html`):
```
Home (hub)
 ├─ "Create a new story" / FAB ＋ ─────────────► New Story setup
 │                                                  └─ "Find my photos" ► Processing
 │                                                        (auto-advances) ► Review
 │                                                                            └─ "Next: Caption" ► Caption
 │                                                                                  └─ "Next" ► Share
 │                                                                                       ├─ "Post to Instagram" ► (if not connected) Instagram Connect ► Success
 │                                                                                       │                       (if connected) ──────────────────────► Success
 │                                                                                       └─ "Save to album" ──────────────────────────────────────────► Success
 ├─ tap a PUBLISHED story ───────────────────────► Story Detail  (Re-share / Save again / Duplicate)
 ├─ tap a DRAFT story ───────────────────────────► Review (resume selection)
 └─ Profile tab ─────────────────────────────────► Profile (Stories / Saved / Settings tabs)
                                                       └─ Settings ► Instagram account row ► Instagram Connect
```
Back arrows and the bottom tab bar (Home ⇄ Profile, center FAB → New Story) are present on the relevant screens.

---

## Screens / Views

### 1. Home — the hub  (`app/screens/home`, was the setup form — now a dashboard)
**Purpose:** entry point; shows past stories + drafts and one clear way to start.
**Layout (top→bottom, flex column, full height):**
- Header row: wordmark "Pixory" (logoGradient clipped to text, 800/24) left; circular avatar (34px, accentGradient ring 2px) right → tap = Profile.
- Hero card: radius 22, `accentGradientHero` fill, with a faint white circle decoration top-right (120px, `rgba(255,255,255,.16)`). Contents: "Create a new story" (800/19 #fff), subtitle (500/12, `rgba(255,255,255,.92)`, ~175px wide), and a white pill button "＋ Start →" (radius 999, padding 9/15, text `#B23A22` 700/12). Whole card tappable → New Story.
- Label "Your stories" (labelMono, textFaint).
- Story rows (each: 56px rounded-14 cover thumbnail, title 700/14 + meta "Apr 3 · 10 photos" 500/11 textFaint, right-aligned status pill). Published pill: success text on success wash. Draft pill: draft color on draft wash. Tap published → Story Detail; tap draft → Review.
- Bottom tab bar (Home active).
**Data:** list of the user's saved stories/sessions (id, title, coverUri, date, photoCount, status: 'published'|'draft', selectedCount for drafts).

### 2. New Story — setup  (was the home form; relocate to its own screen)
**Purpose:** collect the brief; replaces the long settings list with a grouped, story-led form.
**Layout:**
- Header: back ‹, "New Story" title centered.
- "What's the story?" — labelMono, then a `surface` textarea card (radius 16, 1px lineMid, min-height 64). This is the hero field.
- Row of two pills: **Dates** (📅 + "Apr 3 – 6") and **Place** (📍 + "Optional"), each `surface` card radius 14. Dates opens the existing `DatePickerModal`.
- "Your posting style" — labelMono, then persona chips (Aesthete[active], Social, Logger, Storyteller, Mood). Below the chips a **live description panel** (`accentWash` bg, 1px `accentWashBorder`, radius 13) showing the selected persona's name (bold white) + description (textMuted) — **the text swaps with the selection** (descriptions already exist in `app/screens/home/types.ts` PERSONAS).
- **My-face filter row** (`surface` card): ☺ icon, "My-face filter" title + status subtitle, and a toggle. Default **off** when no identity is set ("Add a selfie to turn this on →", accentText subtitle, toggle off). Tapping the row when no identity exists → **Face Setup**. When identity set: subtitle "On · keeping only photos that are you", toggle on; tapping toggles the filter. (Wire to existing `lib/faceIdentity.ts` / `identitySet` state.)
- Footer: primary CTA "Find my photos →" → Processing. (Advanced/backend-server option, currently on the home form, should move to Profile → Settings, not this screen.)

### 3. Face Setup  (`app/screens/face-setup` — restyle existing)
**Purpose:** one-time on-device identity capture; now reached contextually from the face-filter row (and from Settings).
**Layout (centered):** 140px circle with `accentGradient` ring (4px) around a `surface` inner circle holding a face glyph/selfie. Title "Add a selfie first" (800/19). Body copy explaining the filter needs to learn the face, kept on-device, landscapes always stay (textMuted, ~230px). Privacy chip "🔒 Stays on this device. Never uploaded." Footer: primary CTA "Choose a selfie" (opens picker via existing hook; on success set identity + return to New Story with toggle on) and a quiet "Not now" → back.

### 4. Processing  (`app/screens/processing` — restyle existing)
**Purpose:** progress while the engine scores + selects.
**Layout (centered):** header with "Cancel" + "Curating". A 150px **conic-gradient ring** spinner (warm sweep `#FFC65A→#FFAE3D→#FF5A4E→#FF8A45→#FFC65A`, masked to a ring, rotating ~1.5s) with the percentage centered (800/30). Subtitle "Reading your story" + "Analyzing N photos". A vertical step list: done steps have a filled `accentGradient` check circle (18px) + textFaint label; the current step has a 2px `accentSolid` outline circle + bold white label (gently pulsing); pending steps a dim outline + textDim. Map to the real step events already emitted by `useProcessingState`.

### 5. Review — filmstrip  (`app/screens/review` — replace the grid/reorder UX)
**Purpose:** confirm the 10, expand to inspect, reorder, and add more. **This replaces the small grid + the old "early-2000s" reorder list.**
**Layout:**
- Header: ✕ (→ Home), "Arrange the carousel" title, count pill (e.g. "10") in `accentGradient`.
- **Focused hero slide**: large cover (~250px tall, radius 20) of the currently-selected slide. Top-left order badge (30px circle, `accentGradient`, white 800/14). Top-right ⤢ expand button (semi-opaque black circle) → opens full-screen viewer. Bottom-left role chip e.g. "🎬 The hook" (semi-opaque black pill). Tapping a filmstrip item makes it the focused slide.
- Hint "Drag the strip to reorder ↓" (textFaint, centered).
- **Filmstrip**: horizontal row of slide thumbnails (≈58px tall, radius 10). The active one has a 2px `accentSolid` outline. **Drag to reorder** = the carousel order (use a draggable list, e.g. react-native's `Pressable` + reanimated, or existing reorder logic — but as a horizontal filmstrip, not a vertical list with ▲▼ buttons).
- "More matches" — labelMono. A **single combined tray** (radius 10 thumbs, 50px) of runner-ups **and** favorites together; favorite items carry a small ♥ badge (top-left); every item has a `accentGradient` ＋ button (bottom-right) to add it into the strip. (Merges the old separate "ADD MATCHES" and "♥ FAVORITES" trays into one.)
- Footer CTA "Next: Caption →" → Caption.
**Data/state:** selected[] (ordered), runnerUps[], favorites[] → merge runnerUps+favorites into one `moreMatches[]` with an `isFavorite` flag; focusedIndex; reorder handler; add/remove handlers (all already exist in `useReviewState`, just re-presented).

### 6. Caption  (`app/screens/caption` — add the live preview)
**Purpose:** pick a caption style, edit text, and **see the actual post**.
**Layout:**
- Header: back ‹, "Caption", "Next" (accent gradient text) → Share.
- **Live Instagram-style preview card** (top, `surfaceAlt`, radius 18): post header (22–26px gradient-ring avatar + "your_account" 700/12 + ···), the first photo (~188px, real cover) with a "1/N" badge top-right and carousel dots bottom-center, an action row (♡ ▢ ➤ … ⊟), and a caption line ("**your_account** <caption excerpt>"). This is what was missing before — the user must see the images here.
- Caption-style chips (Witty[active], Poetic, Minimal, Hype) — `accentGradient` active. Map to the existing `captions[].mood` data; selecting swaps the editor text.
- Caption editor (`surface` card, radius 15, multiline) with hashtags shown in a blue (#5B8DEF) run.
**State:** selectedMood, editedText, hashtags, photos — all already in `useCaptionState`.

### 7. Share  (`app/screens/publish` — consolidate)
**Purpose:** final confirm + publish. **Collapse the two repetitive previews into one confirm strip + two distinct actions.**
**Layout:**
- Header: back ‹, "Ready to share".
- **Confirm strip** (`surfaceAlt` card): 62px cover with a "10" count badge, title + "10 photos · carousel" + "✓ Caption ready" (success).
- **Action 1 — Post to Instagram**: `accentGradientHero` card, ↗ icon, title + "Connect once · publishes the carousel", chevron. Tap → if not connected, Instagram Connect; if connected, publish → Success. (Use existing `usePublishState` IG logic.)
- **Action 2 — Save to Pixory album**: `surface` card, ⤓ icon, title + "Post later, straight from Photos", chevron. Tap → save (existing `handleSaveToPhotos`) → Success.
- Privacy note chip (🔒, textMuted).

### 8. Instagram Connect  (NEW screen)
**Purpose:** one-time account link. Reached from Share's "Post to Instagram" (when not connected) and from Profile → Settings → Instagram account.
**Layout (centered top, form below):** the **Instagram brand gradient** rounded icon (62px) — *the only place the IG gradient appears* — title "Link your account", subtitle. Two fields: "@ Instagram username" and "Password" (👁 reveal), both `surface` inputs radius 13. Privacy panel (🔒 Secure Enclave, on-device, sent only to Instagram). Footer CTA "Connect & publish" → set connected + publish → Success. **Implement with real TextInputs** wired to the existing IG credential logic in `usePublishState` (`igUsername`, `igPassword`, `handlePostToInstagram`, secure storage). When connected, show the connected state (@handle + Disconnect), as the current publish screen already does.

### 9. Profile  (NEW screen + route)
**Purpose:** identity, history, and the settings that used to clutter the create form.
**Layout:**
- Header: "Profile" (800/17) + ⚙ (→ Settings tab).
- Identity row: 60px avatar (accentGradient ring) + name + @handle.
- Stats strip (`surfaceAlt` card, 3 cells divided by 1px lines): Stories / Published / Saved counts.
- Tab bar: **Stories | Saved | Settings** (active tab bold white; switching is local state).
  - **Stories / Saved:** 3-column grid of story covers (square, radius 9, real covers; a small ⊟ carousel glyph top-right on multi-photo ones).
  - **Settings:** list of `surface` rows — **Instagram account** (📷, "Not connected — tap to link" / "@handle connected", → Instagram Connect), **My-face filter** (☺, toggle, wired to identity), **Default posting style** (✦, "The Aesthete", → persona picker), **Notifications** (🔔, toggle), and a "Sign out" action (error color). The old **Backend Server** field (currently on the home form) belongs here too.
- Bottom tab bar (Profile active).

### 10. Story Detail  (NEW — for tapping a Published story)
**Purpose:** recap a published story and let the user reuse it.
**Layout:**
- Header: back ‹ (→ Home), story title, ···.
- Large cover (~230px, radius 18) with "1/10" badge and a "✓ PUBLISHED · APR 3" pill (success) bottom-left.
- Caption recap (textMuted) with hashtags (#5B8DEF).
- Actions: primary "↗ Re-share" (accentGradient → Share), and a row of two secondary buttons "⤓ Save again" (→ save) and "⎘ Duplicate" (→ New Story prefilled).

### 11. Success  (can be a sheet/overlay or screen)
**Purpose:** confirmation after publish/save.
**Layout (centered):** 96px `accentGradient` check circle (glow shadow), "All done" (800/22), body ("Your carousel is live and the caption's on your clipboard."), and a `surface` "Back to home" button → Home. Tailor copy for the publish vs. save-to-album case.

---

## Interactions & Behavior
- **Navigation:** as the flow map above. Maintain a back stack; back arrows pop.
- **Processing → Review:** in the real app, advance when the selection job completes (the prototype uses a 2.3s timer purely for demo). Keep the existing event-driven completion.
- **Face filter prompt:** tapping the My-face filter row with no identity set must route to Face Setup, not silently toggle. After a selfie is chosen, return to the prior screen with the filter enabled.
- **Instagram posting:** only show Instagram Connect if not already connected; otherwise go straight to publishing. Persist connection (already handled by secure storage in `usePublishState`).
- **Persona description:** updates live on selection (data already present).
- **Caption style chips:** switching swaps the editor text from the corresponding generated caption.
- **Filmstrip reorder:** drag updates carousel order; the focused hero reflects the tapped item.
- **Spinner:** conic ring rotates ~1.5s linear infinite; current processing step pulses (~1.6s ease-in-out).
- **Toggles / buttons:** add subtle pressed opacity (RN `Pressable` `pressed` state, ~0.8).

## State Management
Most state already lives in the per-screen `hooks.ts`. New/changed:
- **Home:** stories list (id, title, coverUri, date, photoCount, status, selectedCount).
- **App-level identity:** `faceSet` / `identitySet` (already in `lib/faceIdentity.ts` + store) drives the face-filter row's default and the Face Setup prompt.
- **Review:** merge `runnerUps` + `favorites` into one `moreMatches` (with `isFavorite`); track `focusedIndex`.
- **Profile:** local `tab` state ('stories'|'saved'|'settings'); read counts + identity + IG connection + default persona from the store.
- **Instagram:** `igConnected`, `igUsername`, `igPassword` (already in `usePublishState`).

## Assets
- **No bespoke image assets** are required from this bundle. The colored tiles in the HTML are **placeholders for the user's real gallery photos** — render actual photos via `expo-image` in production.
- **Icons:** the prototype uses simple unicode glyphs (＋ ‹ ✕ ⤢ ♡ ▢ ➤ ⊟ ☺ ⚙ 🔔 🔒 ↗ ⤓ ◔ ⌂ 🎬 ✦). Swap for the codebase's existing icon set (e.g. `@expo/vector-icons`) at the same sizes/positions.
- **Fonts:** Schibsted Grotesk + Space Mono (Google Fonts) loaded via `expo-font`.
- The Instagram 5-stop brand gradient is used **only** on the Instagram Connect screen icon.

## Files (in this bundle)
- `Pixory Prototype.dc.html` — clickable wired flow (behavior source of truth).
- `Pixory Hi-Fi.dc.html` — all 8 screens hi-fi + Foundations token board (styling source of truth).
- `Pixory Wireframes.dc.html` — lo-fi structure + change rationale annotations.
- `Pixory Warm Accents.dc.html` — accent exploration that led to amber→coral.

## Screenshots (`screenshots/`)
Captured from the wired prototype, in flow order:
- `01-screen.png` — Home (hub)
- `02-screen.png` — New Story setup
- `03-screen.png` — Processing
- `04-screen.png` — Review (filmstrip)
- `05-screen.png` — Caption (live IG preview)
- `06-screen.png` — Share (consolidated)
- `07-screen.png` — Instagram Connect
- `08-screen.png` — Success
- `09-screen.png` — Home (return)
- `10-screen.png` — Profile · Stories tab
- `11-screen.png` — Profile · Settings tab
- `12-screen.png` — Home (return)
- `13-screen.png` — Story Detail (published)
(Face Setup is reachable from the New Story "My-face filter" row; see `Pixory Hi-Fi.dc.html` for its hi-fi version.)

## Target codebase reference (`photosort-app`)
- Tokens: `lib/theme.ts`  ·  Fonts: `app/_layout.tsx`
- Screens: `app/screens/{home,processing,review,caption,publish,face-setup}/` (each has `index.tsx`, `styles.ts`, `hooks.ts`, `types.ts`) + new `profile/` and `story-detail/`.
- Routes: `app/*.tsx` (expo-router) — add `profile`, `story-detail`, and split `new-story` out of `home`.
- Reuse: `components/DatePickerModal.tsx`, `lib/faceIdentity.ts`, `lib/photoLibrary.ts`, `lib/store.ts`, `lib/claudeApi.ts` / `lib/api.ts`. Keep all selection/posting logic; this is a UI + flow reskin.
