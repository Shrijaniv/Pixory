# Pixory

> A privacy-first mobile app that turns an overwhelming camera roll into a story worth sharing.

Pixory helps travelers move from hundreds of trip photos to a cohesive, editable photo story. It filters by date and location, removes burst duplicates, scores and balances candidates, and can generate a narrative sequence and captions—while keeping the user in control of the final result.

**Status:** Working private beta. Pixory has been tested by six beta users and is not yet publicly available in the App Store.

<p align="center">
  <img src="photosort-app/design_handoff_pixory_redesign/screenshots/01-screen.png" width="31%" alt="Pixory home screen" />
  <img src="photosort-app/design_handoff_pixory_redesign/screenshots/03-screen.png" width="31%" alt="Pixory caption screen" />
  <img src="photosort-app/design_handoff_pixory_redesign/screenshots/05-screen.png" width="31%" alt="Pixory ready-to-share screen" />
</p>

## Why Pixory?

Trips often leave people with hundreds of photos and a surprisingly exhausting final task: compare similar shots, find the meaningful moments, build a balanced carousel, and write a caption. Many people postpone the process until the moment has passed—or never share the photos at all.

Most creative tools either require manual editing or generate new content. Pixory focuses on helping people make sense of the content they already own.

## What it does

- Filters the photo library by date range and optional location
- Removes burst duplicates and computes perceptual hashes for a broader deduplication pass
- Scores focus, lighting, color, contrast, complexity, faces, expression, shot scale, and group size through an OpenCV + InsightFace sidecar
- Optionally keeps only face photos containing the registered user through ArcFace identity matching
- Spreads selections across different activities and moments from a trip
- Optionally sends a shortlist to Claude or GPT-4o for final curation
- Suggests multiple editable caption styles
- Lets users swap, reorder, add, or remove every proposed photo
- Learns from accepted selections and manual changes
- Prepares a 10-photo story for saving or sharing

## Privacy by design

Pixory uses an on-device-first pipeline:

1. Photo-library access, date/location filtering, burst deduplication, shortlist construction, and preference history live in the mobile app.
2. Up to 120 resized candidates are sent to the configured backend and Python sidecar for computer-vision scoring.
3. In AI mode, up to 30 resized shortlisted candidates are sent through the backend to the selected AI provider.
4. Users review and edit every selection before saving or publishing.
5. AI API keys remain on the backend and are not embedded in the mobile app.

See [Privacy and Data Flow](docs/PRIVACY.md) for the current prototype architecture and limitations.

## How it works

```text
Photo library
    ↓
Date + location filtering
    ↓
Burst deduplication and backend vision scoring
    ↓
Activity-aware shortlist
    ↓
Optional AI curation of up to 30 candidates
    ↓
User review, reordering, and caption editing
    ↓
Save or share
```

## Technology

| Layer | Technology |
| --- | --- |
| Mobile app | React Native, Expo SDK 54, Expo Router, TypeScript |
| Photo access | Expo Media Library |
| Computer vision | OpenCV, InsightFace/SCRFD/ArcFace, HSEmotion-ONNX; optional DeepFace comparison engine |
| Selection | Persona scoring, burst deduplication, time/location clustering, shot balancing, preference learning |
| AI curation | Claude or GPT-4o vision |
| Backend | Node.js, TypeScript, Fastify |
| Image processing | Sharp |
| Python sidecar | FastAPI scoring, identity matching, and Instagrapi publishing |
| Testing | Jest, Vitest |

## Repository structure

```text
Pixory/
├── photosort-app/       Expo React Native application
│   ├── app/             Screens and navigation
│   ├── lib/             Photo pipeline, APIs, state, and preference learning
│   └── modules/         Native PHAsset GPS helper; includes unused legacy scoring code
├── backend/             Active Fastify API and Python vision/publishing sidecar
├── instagram_sorter/    Archived prototype; not part of the runtime architecture
├── DESIGN.md            Current high-level design and data flow
├── TASKS.md             Development backlog and implementation notes
└── start.sh             Local development launcher
```

The active implementation lives in `photosort-app/` and `backend/`. The `instagram_sorter/` directory is archived and is not imported or launched. The Swift module is reached for batched `PHAsset.location` lookup; its older Apple Vision scoring function is not called by the current pipeline.

## Getting started

### Prerequisites

- Node.js and npm
- macOS with Xcode for an iOS development build and batched PHAsset GPS lookup
- Python 3 and the sidecar dependencies for scoring, face matching, and publishing
- An Anthropic or OpenAI API key for AI curation
- Cloudflared only if using the convenience tunnel in `start.sh`

### 1. Clone and install

```bash
git clone https://github.com/Shrijaniv/Pixory.git
cd Pixory

cd backend
npm install
cp .env.example .env

cd ../photosort-app
npm install
```

Add at least one AI provider key to `backend/.env`:

```dotenv
ANTHROPIC_API_KEY=...
OPENAI_API_KEY=...
PORT=8000
HOST=0.0.0.0
SIDECAR_URL=http://127.0.0.1:8001
```

### 2. Run the backend

From the repository root:

```bash
./start.sh
```

To launch the backend and Metro together:

```bash
./start.sh --metro
```

For the Node backend only:

```bash
cd backend
npm run dev
```

Health check:

```bash
curl http://localhost:8000/health
```

### 3. Run the mobile app

```bash
cd photosort-app
npm run ios
```

An iOS development build enables the native batched PHAsset GPS helper. Photo scoring itself uses the configured Python sidecar, not Apple Vision.

## Tests

```bash
cd photosort-app
npm test

cd ../backend
npm test
npm run typecheck
```

## Current scope and limitations

- Pixory is a private beta, not a production service.
- Computer-vision scoring and identity matching require the configured Python sidecar; a lightweight file-quality fallback is used if it is unavailable.
- Perceptual hashes and a near-duplicate helper are implemented, but that second deduplication pass is not yet wired into the active processing flow.
- AI curation requires a configured backend and provider key.
- The publishing integration is experimental and can be affected by Instagram platform changes.
- Photos stored only in iCloud may need to be downloaded before local processing.
- This project has not undergone an independent security or privacy audit.

## Roadmap

- Improve personalization using user swaps, removals, and accepted recommendations
- Create meaningful albums and identify repetitive photos beyond a single session
- Strengthen reliability and privacy controls for production use
- Validate pricing and the initial traveler segment through continued customer discovery
- Explore creator, small-business, and video workflows after the core traveler experience

## Documentation

- [Product and technical design](DESIGN.md)
- [Privacy and data flow](docs/PRIVACY.md)
- [Development backlog](TASKS.md)
- [Contributing](CONTRIBUTING.md)

## Author

Built by [Shrijani Vemulapally](https://github.com/Shrijaniv).
