# Pixory

> A privacy-first mobile app that turns an overwhelming camera roll into a story worth sharing.

Pixory helps travelers move from hundreds of trip photos to a cohesive, editable photo story. It filters by date and location, removes near-duplicates, scores photo quality on-device, proposes a balanced selection, and generates caption options—while keeping the user in control of the final result.

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
- Removes burst and near-duplicate photos
- Scores sharpness, faces, and visual saliency on-device with Apple's Vision framework
- Spreads selections across different activities and moments from a trip
- Optionally sends a shortlist to Claude or GPT-4o for final curation
- Suggests multiple editable caption styles
- Lets users swap, reorder, add, or remove every proposed photo
- Learns from accepted selections and manual changes
- Prepares a 10-photo story for saving or sharing

## Privacy by design

Pixory uses an on-device-first pipeline:

1. Photo-library access, filtering, deduplication, and initial scoring happen on the device.
2. In AI mode, only the top candidate photos—up to 30—are sent to the configured AI provider through the backend.
3. Users review and edit every selection before saving or publishing.
4. AI API keys remain on the backend and are not embedded in the mobile app.

See [Privacy and Data Flow](docs/PRIVACY.md) for the current prototype architecture and limitations.

## How it works

```text
Photo library
    ↓
Date + location filtering
    ↓
On-device deduplication and Vision scoring
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
| On-device intelligence | Apple Vision, Swift native Expo module |
| Selection | Quality scoring, deduplication, activity clustering, preference learning |
| AI curation | Claude or GPT-4o vision |
| Backend | Node.js, TypeScript, Fastify |
| Image processing | Sharp |
| Publishing prototype | Python sidecar with Instagrapi |
| Testing | Jest, Vitest |

## Repository structure

```text
Pixory/
├── photosort-app/       Expo React Native application
│   ├── app/             Screens and navigation
│   ├── lib/             Photo pipeline, APIs, state, and preference learning
│   └── modules/         Native iOS Vision scorer
├── backend/             Fastify API and publishing sidecar
├── instagram_sorter/    Archived Python prototype kept for reference
├── DESIGN.md            Product and technical design
├── TASKS.md             Development backlog and implementation notes
└── start.sh             Local development launcher
```

The active implementation lives in `photosort-app/` and `backend/`. The `instagram_sorter/` directory is an earlier prototype and is not the primary backend.

## Getting started

### Prerequisites

- Node.js and npm
- macOS with Xcode for the full iOS Vision workflow
- An Expo development build; Expo Go falls back to limited scoring
- Python 3 for the current Instagram publishing sidecar
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

The native Vision scorer requires an iOS development build. Running in Expo Go uses fallback scoring.

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
- The native quality scorer currently targets iOS.
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
