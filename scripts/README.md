# Scripts Directory

This directory contains utility scripts for the Dad Circles Onboarding application.

## Admin User Seeding

### seedAdminUser.js

Automatically creates an admin user in Firebase Auth emulator on server start.

**Environment Variables Required:**
- `PRIMARY_ADMIN_EMAIL` - Email address for the admin user
- `PRIMARY_ADMIN_PASSWORD` - Password for the admin user

**How it works:**
1. Reads credentials from `.env` file
2. Connects to Firebase Auth emulator (localhost:9099)
3. Creates a new user with display name "admin" if it doesn't exist
4. Updates the display name to "admin" if the user already exists
5. Sets a custom claim `admin=true` for Firestore rules

**Usage:**
This script is called automatically by `start-dev.sh` (used by `npm run dev:full`).

You can also run it manually:
```bash
node scripts/seedAdminUser.js
```

**Configuration:**
Add these lines to your `.env` file:
```
PRIMARY_ADMIN_EMAIL=admin@example.com
PRIMARY_ADMIN_PASSWORD=your_secure_password_here
```

If these environment variables are not set, the script will skip seeding and log a warning message.

**Note:** This only creates a Firebase Auth user and sets the `admin=true` custom claim. Admin users are handled separately from regular user profiles and don't need a Firestore profile entry.

## Other Scripts

### setAdminClaim.js

Set the `admin=true` custom claim for one or more Firebase Auth users (production).

**Usage:**
```bash
node scripts/setAdminClaim.js <uid-or-email> [more...]
```

**Examples:**
```bash
node scripts/setAdminClaim.js abcd1234efgh5678
node scripts/setAdminClaim.js admin1@example.com admin2@example.com
```

**Auth:**
```bash
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccount.json
```

### setup-gemini-secret.sh

Interactive setup script for configuring the Gemini API key for local development.

**Purpose:**
Securely configures the Gemini API key in Firebase Secrets for use with the Firebase Emulators.

**Usage:**
```bash
./scripts/setup-gemini-secret.sh
```

**What it does:**
1. Checks if you're in the project root directory
2. Prompts for your Gemini API key (hidden input)
3. Creates `functions/.secret.local` with the key
4. Provides next steps for starting development

**When to use:**
- First time setting up the project
- After cloning the repository
- When rotating API keys

**Security:**
- The `.secret.local` file is automatically gitignored
- Input is hidden while typing (secure prompt)
- File is only readable by the current user

**Get an API key:**
Visit https://aistudio.google.com/app/apikey to get a free Gemini API key.

**See also:**
- `docs/QUICK_START_GEMINI.md` - Quick setup guide
- `docs/GEMINI_API_SECURITY.md` - Complete security documentation

### seedTestUsers.ts

Seeds test user data for matching algorithm testing.

### cleanTestUsers.ts

Removes test user data from the database.

### readLogs.js

Utility for reading application logs.
