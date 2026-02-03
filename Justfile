# Dad Circles - Justfile

default:
	@just --list

# -----------------------------------------------------------------------------
# Development
# -----------------------------------------------------------------------------

dev:
	npm run dev

run:
	npm run emulators

dev-local:
	npm run dev:local

server:
	npm run dev:server

emulator:
	npm run emulators

emulators:
	npm run emulators

emu:
	npm run emulators

full:
	@pkill -f "firebase emulators" 2>/dev/null || true
	@pkill -f "java.*firestore" 2>/dev/null || true
	@osascript -e 'tell application "Terminal" to do script "cd {{justfile_directory()}}; just emulators"'
	@osascript -e 'tell application "Terminal" to do script "cd {{justfile_directory()}}; just dev"'

emulator-seed:
	npm run emulator:seed

local: dev

# -----------------------------------------------------------------------------
# Build & Deploy
# -----------------------------------------------------------------------------

build:
	npm run build

preview:
	npm run preview

deploy:
	npm run deploy

deploy-hosting:
	npm run deploy:hosting

deploy-preview:
	npm run deploy:preview

deploy-live:
	npm run deploy:live

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
