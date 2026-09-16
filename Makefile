# Pixory — repo-level test entry points.
# Per-project commands live in photosort-app/package.json and backend/package.json.

.PHONY: test test-app test-backend test-sidecar test-sidecar-models coverage typecheck install-sidecar

test: test-app test-backend test-sidecar ## Run every suite

test-app:
	cd photosort-app && npm test

test-backend:
	cd backend && npm test

test-sidecar:
	cd backend && python3 -m pytest

test-sidecar-models: ## Run the tests that need real model weights (not run in CI)
	cd backend && python3 -m pytest -m models --cov-fail-under=0

coverage: ## Run every suite with coverage gates enforced
	cd photosort-app && npm run test:coverage
	cd backend && npm run test:coverage
	cd backend && python3 -m pytest

typecheck:
	cd photosort-app && npx tsc --noEmit
	cd backend && npm run typecheck

install-sidecar: ## Install the Python sidecar's runtime + test dependencies
	cd backend && pip install -r requirements.txt
