# Contributing to Pixory

Pixory is currently a founder-led private-beta project. Contributions that improve reliability, privacy, testing, accessibility, or the core traveler workflow are welcome.

## Project areas

- `photosort-app/app/`: screens and navigation
- `photosort-app/lib/photos/`: fetching, deduplication, scoring, clustering, and selection
- `photosort-app/lib/learning/`: preference-learning logic
- `photosort-app/modules/vision-scorer/`: native PHAsset GPS helper; its Apple Vision scorer is unused legacy code
- `backend/src/`: active Fastify API and AI curation layer
- `backend/publish_sidecar.py` and `backend/face_engines/`: active scoring, identity, and publishing sidecar
- `instagram_sorter/`: archived prototype; do not add or infer current functionality here

## Local setup

Follow the root [README](README.md) for installation and run instructions.

## Before opening a change

1. Minimize photo transfer and document whether processing occurs on-device, on Pixory infrastructure, or at an AI provider.
2. Never commit API keys, account sessions, user photos, face profiles, or generated caches.
3. Add or update tests for behavior changes.
4. Keep the user in control of AI-generated selections and captions.
5. Document changes to network data flow in `docs/PRIVACY.md`.

## Validation

Mobile application:

```bash
cd photosort-app
npm test
npx tsc --noEmit
```

Backend:

```bash
cd backend
npm test
npm run typecheck
npm run build
```

For changes to the native PHAsset helper, verify GPS metadata retrieval in an iOS development build.

## Pull requests

A useful pull request should include:

- The problem being addressed
- The approach and important tradeoffs
- Tests performed
- Screenshots or a short recording for UI changes
- Any privacy, permission, API, or data-retention impact

Keep changes focused. Separate repository cleanup from functional changes when possible.
