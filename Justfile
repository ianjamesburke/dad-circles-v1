# Dad Circles - Justfile

default:
	@just --list

# -----------------------------------------------------------------------------
# Development
# -----------------------------------------------------------------------------

dev:
	npm run dev

dev-local:
	npm run dev:local

server:
	npm run dev:server

alias emulators := emulator
alias emu := emulator

emulator:
	#!/usr/bin/env bash
	set -euo pipefail
	trap 'kill $EMU_PID 2>/dev/null; exit 0' INT TERM
	echo "Building functions..."
	npm run build --prefix functions
	echo "Starting Firebase emulators..."
	firebase emulators:start --only firestore,functions,auth & EMU_PID=$!
	sleep 3
	node scripts/seedAdminUser.js
	wait $EMU_PID

emulator-seed:
	npm run emulator:seed

local: dev

# -----------------------------------------------------------------------------
# Build & Deploy
# -----------------------------------------------------------------------------

build:
	npm run build

build-functions:
	npm run build --prefix functions

preview:
	npm run preview

# Deploy to production (with version check)
deploy: build build-functions
	@echo "🔍 Checking version..."
	@node scripts/check-version-bump.js
	@firebase deploy

# Deploy without version check (emergency only)
deploy-force: build build-functions
	@echo "⚠️  Skipping version check..."
	@firebase deploy

deploy-hosting: build
	@echo "🔍 Checking version..."
	@node scripts/check-version-bump.js
	@firebase deploy --only hosting

deploy-functions: build-functions
	@echo "🔍 Checking version..."
	@node scripts/check-version-bump.js
	@firebase deploy --only functions

deploy-preview:
	npm run deploy:preview

deploy-live: build build-functions
	@echo "🔍 Checking version..."
	@node scripts/check-version-bump.js
	@firebase deploy --only hosting,functions

# -----------------------------------------------------------------------------
# Versioning
# -----------------------------------------------------------------------------

# Bump patch version (1.0.0 → 1.0.1) - Bug fixes
version-patch:
	@node scripts/bump-version.js patch

# Bump minor version (1.0.0 → 1.1.0) - New features
version-minor:
	@node scripts/bump-version.js minor

# Bump major version (1.0.0 → 2.0.0) - Breaking changes
version-major:
	@node scripts/bump-version.js major

# Set specific version
version-set VERSION:
	@node scripts/bump-version.js set {{VERSION}}

# -----------------------------------------------------------------------------
# Tests
# -----------------------------------------------------------------------------

test:
	npm test

test-watch:
	npm run test:watch

test-coverage:
	npm run test:coverage

test-ui:
	npm run test:ui

typecheck:
	npm run typecheck

# -----------------------------------------------------------------------------
# E2E (requires an e2e runner/script to be configured)
# -----------------------------------------------------------------------------

e2e:
	npm run e2e

e2e-local:
	npm run e2e:local

# -----------------------------------------------------------------------------
# Utilities
# -----------------------------------------------------------------------------

seed-test:
	npm run seed:test

clean-test:
	npm run clean:test

logs:
	npm run logs

logs-matching:
	npm run logs:matching

logs-database:
	npm run logs:database

# Fix Firebase Auth permissions for custom tokens
fix-auth:
	@./scripts/fix-auth-permissions.sh
