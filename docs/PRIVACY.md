# Privacy and Data Flow

Pixory is designed around a simple principle: a user's full photo library should not need to leave their device for the app to be useful.

This document describes the current development prototype. It is technical documentation, not a production privacy policy or a claim of regulatory compliance.

## Data flow

### On the device

The mobile application performs the first stage of the workflow locally:

- Requests photo-library access from the operating system
- Filters assets by the selected date range and optional location
- Removes bursts and likely duplicates
- Scores sharpness, faces, and visual saliency
- Builds an initial shortlist
- Stores local app state and preference-learning signals

The native iOS scorer uses Apple's Vision framework. Expo Go cannot load the custom native module and therefore uses fallback scoring.

### Optional AI curation

AI curation is optional. When selected:

- Pixory narrows the library to a shortlist of up to 30 candidate photos.
- The mobile app sends those candidates to the user-configured Pixory backend.
- The backend resizes the images and sends them to the selected AI provider.
- The provider returns selection, ordering, and caption suggestions.
- The user reviews and can change every result.

The full photo library is not uploaded as part of this workflow.

### Backend configuration

AI provider keys are stored in the backend environment and are not embedded in the mobile application. Developers should never commit a populated `.env` file, credentials, session material, or photo caches.

The current backend permits broad CORS access because it is designed for local, user-controlled development. Production deployment should add authentication, origin restrictions, request limits, encrypted transport, retention controls, and structured deletion behavior.

### Instagram publishing prototype

The repository includes an experimental publishing workflow. Instagram integrations can change and may impose additional platform and account risks. Do not use the prototype with an account or content you cannot afford to lose.

Before production use, replace or formally review unofficial publishing dependencies and document exactly where credentials, sessions, and temporary images are stored and deleted.

## Data minimization principles

Contributors should preserve these rules:

1. Process locally whenever practical.
2. Send only the minimum candidates needed for an explicitly selected cloud feature.
3. Make cloud processing visible to the user.
4. Keep the user in control of the final selection and caption.
5. Do not log images, credentials, precise locations, face profiles, or session tokens.
6. Do not commit generated photo caches or local preference files.
7. Delete temporary backend images as soon as the request completes.

## Sensitive data

Photo libraries may contain faces, homes, children, documents, precise locations, and other private information. Treat all photo and location data as sensitive even when a user has granted operating-system permission.

## Before a public launch

The project should complete, at minimum:

- A production privacy policy and terms of use
- A data-retention and deletion specification
- Authentication and authorization for backend endpoints
- Encryption in transit for every network request
- Provider-specific disclosure and consent
- A review of face and location processing
- Security testing and dependency review
- An official or otherwise approved publishing path
- User controls for export and deletion

