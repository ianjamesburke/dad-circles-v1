# AGENTS.md

This file provides guidance to Coding Agents for working with code in this repository.

> [!IMPORTANT]
> **DO NOT CREATE SUMMARY FILES**: Do not create markdown files to summarize your work, document your process, or track changes unless explicitly requested by the user. This includes files like SUMMARY.md, CHANGES.md, WORK_LOG.md, etc. Focus on code changes only.

> [!CAUTION]
> **CRITICAL SECURITY RULE**: NEVER commit API keys, secrets, or `.env` files to the repository. Always use `.env.example` as a template and ensure `.env` is in `.gitignore`.

## Recent Architecture Changes

**NEW ARCHITECTURE**:
```
Client → Cloud Function (getGeminiResponse) → Gemini API
```

**Implementation**:
- **Backend**: `functions/src/gemini/index.ts` - Secure Cloud Function with API key in Firebase Secrets
- **Client**: `services/callableGeminiService.ts` - Calls the Cloud Function via `httpsCallable`
- **Deprecated**: direct client-side Gemini API calls (do not add these)

**Local Development Setup**:
```bash
# Create secret file for emulators
echo "GEMINI_API_KEY=your_key" > functions/.secret.local

# Or use the setup script
./scripts/setup-gemini-secret.sh
```

**Production Setup**:
```bash
# Store in Firebase Secrets (one-time)
firebase functions:secrets:set GEMINI_API_KEY
```

**Key Benefits**:
- API key never exposed to client
- Server-side rate limiting possible
- Audit trail for all API calls
- Centralized cost control

See `functions/src/gemini/index.ts` and `services/callableGeminiService.ts` for the current implementation.

### Timestamp Standardization (January 2025)
**All timestamps now use Firestore server timestamps for consistency and security.**

**Cloud Functions (functions/src/):**
```typescript
import { FieldValue } from 'firebase-admin/firestore';

// Always use server timestamps
await profileRef.update({
  last_updated: FieldValue.serverTimestamp(),
  abandonment_sent_at: FieldValue.serverTimestamp()
});
```

**Client-Side Services (services/):**
```typescript
import { serverTimestamp } from 'firebase/firestore';

// Use client SDK server timestamp
const profile = {
  last_updated: serverTimestamp() as any,
  created_at: serverTimestamp() as any
};
```

**Why Server Timestamps?**
- Prevents client time manipulation
- Ensures consistency across all users
- Better for time-based queries and ordering
- Single source of truth (server clock)

**Type Definitions:**
All timestamp fields in `types.ts` now use `any` type to support both Firestore Timestamp objects and legacy number values during migration.

**Reading Timestamps:**
```typescript
// Convert Firestore Timestamp to milliseconds for comparisons
const lastUpdated = profile.last_updated?.toMillis?.() || 0;
const oneHourAgo = Date.now() - (60 * 60 * 1000);
if (lastUpdated < oneHourAgo) {
  // User is inactive
}
```

## Overview

# Dad Circles

## Development Workflow

We use [Just](https://github.com/casey/just) to manage development tasks.

### Running the App
1. **Start Emulators**: Run `just emulator` (or `just emu`) to start Firebase Emulators (Auth, Firestore, Functions) and seed the admin user.
2. **Start Frontend**: Run `just dev` to start the Vite development server.

### Default Admin Credentials
Admin credentials are loaded from `.env` and seeded by `scripts/seedAdminUser.js`:
- **Email**: `PRIMARY_ADMIN_EMAIL`
- **Password**: `PRIMARY_ADMIN_PASSWORD`

Dad Circles Onboarding MVP is a conversational onboarding application built with React and Gemini (server-side via Cloud Functions). The application guides new and expecting dads through a structured onboarding flow while collecting relevant user information (status, children, interests, location). The backend uses Firebase (Firestore, Auth, Cloud Functions), and the frontend is a Vite-powered React app with admin tooling.

## Quick Start Commands

### Running Locally
To run the application locally, you need two terminal windows:

1. **Start Emulators**:
   ```bash
   npm run emulators
   ```
   This will start the Firebase emulators (Auth, Functions, Firestore).

2. **Start Frontend**:
   ```bash
   npm run dev
   ```
   This will start the Vite development server.

`npm run emulators` starts Firebase emulators only. If you want emulators + admin seeding in one command, use `just emulator`.

### Individual Commands
```bash
# Install dependencies
npm install

# Development server (uses Vite)
npm run dev

# Development with local Gemini API key (set in command)
npm run dev:local

# Build for production
npm run build

# Preview production build locally
npm run preview

# Deploy to Firebase (hosting + functions)
npm run deploy

# Deploy only hosting
npm run deploy:hosting

# Start Firebase emulators (Firestore, Functions, Auth)
npm run emulator

# Start emulators with data import/export
npm run emulator:seed
```

## Architecture

### High-Level Data Flow

1. **Frontend (React/Vite)** → User interacts with chat interface or landing page
2. **UserChatInterface.tsx** → Processes user messages, manages conversation state (production)
3. **Gemini Client Service** (`services/callableGeminiService.ts`) → Calls `getGeminiResponse` callable with context
4. **Database** (`database.ts`) → Firestore operations via Firebase Client SDK (profiles, messages, leads, groups)
5. **Firebase Callable Functions** (`functions/src/callable.ts`) → Backend logic for matching, emails, magic links
6. **Email Service** (`functions/src/emailService.ts`) → Resend template-based emails

### Key Directories

- **`/components`** - React components: UserChatInterface (production), AdminChatInterface (testing), LandingPage, Layout
- **`/components/admin`** - Modular admin dashboard: AdminLayout, AdminUsers, AdminGroups, AdminLeads, AdminOverview, AdminTools
- **`/services`** - Core business logic: Gemini API integration, context management, matching
- **`/utils`** - Utilities: analytics, location helpers, logger
- **`/config`** - Configuration files (e.g., contextConfig.ts for context window management)
- **`/functions`** - Firebase Cloud Functions
- **`/functions/src`** - TypeScript source: callable.ts, gemini/index.ts, weekendMission.ts, emailService.ts, matching.ts, logger.ts

### Data Model

**UserProfile** (Firestore `profiles` collection):
- `session_id` - Unique session identifier
- `name` - User's first name (captured during onboarding)
- `onboarding_step` - Current step (enum: WELCOME, NAME, STATUS, CHILD_INFO, SIBLINGS, INTERESTS, LOCATION, CONFIRM, COMPLETE)
- `onboarded` - Boolean indicating completion
- `dad_status` - Current/expecting/both
- `children` - Array of child objects with type, birth_month, birth_year, optional gender
- `children_complete` - True when user confirms there are no additional kids
- `siblings` - Array of existing children (captured separately)
- `interests` - Array of user interests
- `location` - Object with city, state_code, country_code
- `last_updated` - Timestamp of last modification

**Message** (Firestore `messages` collection):
- `session_id` - Links to user profile
- `role` - USER, AGENT, or ADMIN
- `content` - Message text
- `timestamp` - When message was created

**Lead** (Firestore `leads` collection):
- `email`, `postcode`, `signupForOther` - Landing page form data
- Email tracking fields: `welcomeEmailSent`, `followUpEmailSent`, `welcomeEmailFailed`, etc.
- `source` - Always "landing_page"

## Development Philosophy for Agents
> [!IMPORTANT]
> **Data Access Pattern**:
> 1. **Client-Side Read**: Prefer using `database.ts` (Firebase Client SDK) to read data directly from Firestore. Do not create API endpoints just to read data.
> 2. **Backend Logic**: Use **Firebase Callable Functions** (`onCall`) for backend logic that requires safety or admin privileges (e.g., matching algorithms, emails). Call them via `database.<functionName>` wrappers in `services/callableService.ts`.
> 3. **Avoid**: Do NOT create custom Express/HTTP endpoints (`onRequest`) for internal tools. They require complex proxy configuration in Vite. Stick to standard Firebase patterns.

> [!CAUTION]
> **LLM Output Security**:
> 
> All LLM responses MUST be validated before applying state changes. The system uses `services/onboardingValidator.ts` to prevent prompt injection attacks.
> 
> **Why This Matters**:
> - Attackers can use prompt injection to manipulate LLM output
> - Without validation, users could skip onboarding steps or trigger unauthorized actions
> - The validator enforces a strict state machine and data requirements
> 
> **Implementation**:
> ```typescript
> import { validateLLMResponse, logValidationFailure } from '../services/onboardingValidator';
> 
> const result = await getAgentResponse(profile, history);
> 
> // SECURITY: Validate before applying changes
> const validation = validateLLMResponse(
>   profile,
>   result.next_step,
>   result.profile_updates
> );
> 
> if (!validation.isValid) {
>   logValidationFailure(sessionId, currentStep, nextStep, validation.errors);
>   // Reject transition and show fallback message
>   return;
> }
> 
> // Safe to apply changes
> await db.updateProfile(sessionId, profileUpdates);
> ```
> 
> **Key Rules**:
> - Can only reach `COMPLETE` step from `CONFIRM` step
> - Profile must have name, children, and location before completion
> - All state transitions must follow the defined state machine
> - Validation failures are logged for security monitoring
> 
> See `services/onboardingValidator.ts` for the current validator rules and transition guardrails.

> [!IMPORTANT]
> **Firebase Admin SDK Timestamp Best Practices**:
> 
> When working with timestamps in Cloud Functions (`functions/src/`), follow these patterns:
> 
> 1. **Always Use Server Timestamps**: Import `FieldValue` from `firebase-admin/firestore` (NOT `admin.firestore.FieldValue`)
>    ```typescript
>    import { FieldValue } from 'firebase-admin/firestore';
>    
>    await db.collection('profiles').doc(id).update({
>      last_updated: FieldValue.serverTimestamp(),
>      created_at: FieldValue.serverTimestamp()
>    });
>    ```
> 
> 2. **Why This Matters**:
>    - `admin.firestore.FieldValue` can be `undefined` in Firebase emulator contexts
>    - Modern Firebase Admin SDK (v9+) uses modular imports
>    - Server timestamps prevent client time manipulation
>    - Ensures consistency across all users and time zones
> 
> 3. **Client-Side Timestamps**:
>    - Use `serverTimestamp()` from `firebase/firestore` (client SDK)
>    - Cast to `any` for type compatibility: `serverTimestamp() as any`
> 
> 4. **Reading Timestamps**:
>    - Firestore Timestamps have `.toMillis()` method
>    - Use optional chaining: `timestamp?.toMillis?.() || 0`
>    - For comparisons, convert to milliseconds first

### System Behavior Notes

**Email Simulation Mode:**
The email system has clear precedence for simulation vs real sending:

1. **Force Simulation** (highest priority) - Explicit `forceSimulation` parameter
2. **Emulator + Override** - `FUNCTIONS_EMULATOR=true` + `SEND_REAL_EMAILS=true` → sends real emails
3. **Emulator Default** - `FUNCTIONS_EMULATOR=true` → simulates (logs only)
4. **Missing API Key** - No `RESEND_API_KEY` → simulates with warning
5. **Production** - Valid API key → sends real emails

```bash
# Local dev - simulate all emails (default)
npm run emulator

# Local dev - send real emails for testing
SEND_REAL_EMAILS=true npm run emulator
```

**Location Lookup Failures:**
When `getLocationFromPostcode()` fails, the system:
- Logs a warning with postcode and context
- Falls back to raw postcode in emails (acceptable degraded experience)
- Continues email sending (non-blocking failure)

Monitor logs for location lookup failures and consider caching successful lookups.

### Logging Best Practices

When working with Cloud Functions (`functions/src/`), use the custom logger wrapper in `./logger.ts` instead of importing directly from `firebase-functions/logger`.

1. **Why Use the Wrapper?**:
   - **Pretty Printing**: Automatically detects the Firebase Emulator and formats JSON objects with indentation and colors.
   - **Production Safety**: Falls back to standard structured logging in production for Google Cloud Logging compatibility.
   - **Unified Interface**: Supports `info`, `warn`, `error`, `debug`, and `write`.

2. **How to Use**:
   ```typescript
   import { logger } from './logger';

   // Simple message
   logger.info("Function triggered");

   // Message with metadata (will be pretty-printed in emulator)
   logger.info("Lead processed", { leadId: "123", status: "success" });
   ```

3. **DebugLogger**:
   The `DebugLogger` class in the same file also writes logs to a local `debug.log` file in the `functions` directory, which is useful for persistent debugging during complex flows.

## Key Architectural Patterns

### Onboarding State Machine
The system strictly follows a defined sequence of onboarding steps. The frontend calls `getAgentResponse` in `services/callableGeminiService.ts`, which invokes `getGeminiResponse` in `functions/src/gemini/index.ts` and returns:
- `message` - Next agent response
- `next_step` - Which step to transition to
- `profile_updates` - Any profile fields to update based on extracted user information

The system is designed to extract user intent from natural language and progress through the state machine strictly (no skipping steps without explicit user confirmation).

### Configuration Management

**Centralized Configuration Files:**

1. **`functions/src/config.ts`** - Backend configuration (Cloud Functions)
   - Gemini API settings (model, timeout, temperature, tokens)
   - Rate limiting rules (magic links, Gemini API)
   - Validation constraints (message length, birth years, history length)
   - UI-related settings

2. **`config/contextConfig.ts`** - Client-side configuration
   - Context window management per use case (chat, admin, gemini-call)
   - Message length validation (must match backend)
   - Message preservation strategies

**Key Configuration Values:**

```typescript
// Backend (functions/src/config.ts)
CONFIG = {
  gemini: {
    model: 'gemini-3-flash-preview',
    timeout: 30,
    maxOutputTokens: 1024,
    temperature: 0.4,
  },
  validation: {
    maxMessageLength: 1000,      // Max chars per message
    maxHistoryLength: 50,        // Max messages in history
    minBirthYear: 2010,
    maxBirthYear: 2099,
  },
  rateLimits: {
    gemini: {
      maxAttempts: 20,           // Per minute
      windowMs: 60000,
    },
    magicLink: {
      maxAttempts: 3,            // Per hour per email
      windowMs: 3600000,
    },
    magicLinkByIP: {
      maxAttempts: 3,            // Per 10 minutes per IP
      windowMs: 600000,
    }
  }
}

// Client (config/contextConfig.ts)
contextConfigs = {
  'gemini-call': {
    maxMessages: 30,             // Sent to backend
    preserveFirstCount: 2,
    preserveRecentCount: 28,
  }
}
```

**Important Rules:**
- Always use config values instead of hardcoding
- Keep client `MAX_MESSAGE_LENGTH` in sync with backend `validation.maxMessageLength`
- Context window management prevents overwhelming the Gemini API with unnecessary history while maintaining conversation state

### Firebase Emulator for Development
The app supports Firebase emulators for local development (Firestore, Functions, Auth). The emulator can be started with `npm run emulator` (alias for `npm run emulators`) or `just emulator` (includes admin seeding). Connection is configured in `firebase.ts` and uses `window.location.hostname` so mobile/network testing can hit local emulators.

### Cloud Functions and Email

The email system uses Resend template aliases for all emails.

**Callable Functions** (`functions/src/callable.ts`):
- `startSession` - Creates a new session or sends a magic link for existing users
- `redeemMagicLink` - Exchanges token for Firebase custom auth token
- `sendMagicLink` - Sends secure magic link to resume abandoned sessions (duplicate email detection)
- `sendCompletionEmail` - Sends welcome email when user completes onboarding
- `sendManualAbandonmentEmail` - Admin-triggered abandonment email
- `runMatching` - Executes matching algorithm to form groups
- `approveGroup` - Approves pending group and sends intro emails to members
- `deleteGroup` - Deletes group and unmatches members

**Gemini Callable Function** (`functions/src/gemini/index.ts`):
- `getGeminiResponse` - Server-side onboarding response generation with extraction and validation helpers

**Weekend Mission Functions** (`functions/src/weekendMission.ts`):
- `generateWeekendMission`
- `createWeekendMissionJob`
- `getWeekendMissionJob`
- `processWeekendMissionJob`

**Scheduled Functions** (`functions/src/index.ts`):
- `sendWelcomeEmail` is active (Firestore trigger on new leads)
- `sendFollowUpEmails` and `sendAbandonedOnboardingEmails` are currently commented out/disabled

**Email Templates** (Resend):
- `welcome-completed` - Sent on onboarding completion
- `welcome-abandoned` - Sent 1+ hours after abandonment
- `resume-session` - Sent for duplicate signups or manual magic links
- `signup-other` - Sent when user signs up for someone else
- `followup-3day` - Nurture emails for inactive leads
- `group-intro` - Sent when group is approved

The `EmailService` class (`functions/src/emailService.ts`) handles Resend API calls with automatic simulation in emulator mode (unless `SEND_REAL_EMAILS=true`).

### Firestore Indexes

> [!IMPORTANT]
> **When adding or modifying Firestore queries in Cloud Functions, check if a composite index is required.**

Firestore requires composite indexes for queries that filter or order on multiple fields. Single-field queries (e.g., `.where('email', '==', value)`) don't need indexes, but multi-field queries do.

**Index Configuration:** `firestore.indexes.json`

**Current Indexes:**

| Collection | Fields | Used By |
|------------|--------|---------|
| `messages` | `session_id` (ASC), `timestamp` (ASC) | Message history queries |
| `profiles` | `onboarded` (ASC), `last_updated` (ASC) | Abandonment email job |
| `leads` | `welcomeEmailSent` (ASC), `followUpEmailSent` (ASC), `timestamp` (ASC) | Legacy email tracking |
| `leads` | `followUpEmailSent` (ASC), `last_communication_at` (ASC) | Follow-up email job |

**Cloud Function Query Reference:**

| Function | File | Query | Index Required? |
|----------|------|-------|-----------------|
| `sendFollowUpEmails` | `index.ts` | `leads` where `followUpEmailSent != true` AND `last_communication_at <= X` | ✅ Yes |
| `sendAbandonedOnboardingEmails` | `index.ts` | `profiles` where `onboarded == false` AND `last_updated <= X` | ✅ Yes |
| `sendMagicLink` | `callable.ts` | `profiles` where `email == X` | ❌ No (single field) |
| `sendCompletionEmail` | `callable.ts` | `leads` where `email == X` | ❌ No (single field) |
| `getUnmatchedUsers` | `matching.ts` | `profiles` where `matching_eligible == true` AND `group_id == null` [AND `location.city` AND `location.state_code`] | ⚠️ Maybe (depends on location filter) |

**When You Need an Index:**
- Queries with multiple `.where()` clauses on different fields
- Queries combining `.where()` with `.orderBy()` on different fields
- Queries using inequality operators (`!=`, `<`, `<=`, `>`, `>=`) with other filters

**When You Don't Need an Index:**
- Single `.where()` equality query (e.g., `.where('email', '==', value)`)
- Queries only using `.orderBy()` on a single field
- Queries filtered by document ID

**Adding a New Index:**
1. Add the index definition to `firestore.indexes.json`
2. Deploy: `firebase deploy --only firestore:indexes`
3. Wait for index to build (can take minutes for large collections)

**If You See `FAILED_PRECONDITION: The query requires an index`:**
1. The error message includes a direct link to create the index in Firebase Console
2. Alternatively, add it to `firestore.indexes.json` and deploy
3. Update this table in AGENTS.md when adding new indexed queries


## Important Implementation Details

### Gemini System Prompt
The Gemini system prompt (`functions/src/gemini/index.ts`) is highly detailed and controls the agent's behavior:
- Enforces the onboarding step sequence
- Specifies response tone and style
- Defines how to handle multiple children (critical: capture ALL children in the array)
- Details for each step's specific questions
- Exact formatting rules for confirmation step (must use proper line breaks)

**Key rule**: The siblings step is critical and should only be skipped if user explicitly says "only one" or "no other kids". Most dads have existing children.

### Multiple Children Handling
The system can capture multiple children in a single conversation. The prompt includes examples of how to parse user input like "I have two kids, one born March 2023 and another due January 2026" and create appropriate children array entries.

### Test Persona System
The `ContextTestPanel.tsx` provides buttons to jump between different onboarding states for testing. This doesn't reset the actual user profile but simulates different conversation contexts.

### Admin Dashboard

The admin dashboard is a modular multi-page application with authentication:

**Components** (`components/admin/`):
- `AdminLayout.tsx` - Navigation wrapper with tabs
- `AdminOverview.tsx` - Stats and system health
- `AdminUsers.tsx` - List of all user profiles with filtering
- `AdminUserDetail.tsx` - Detailed view of individual user
- `AdminGroups.tsx` - Pending and active group management
- `AdminGroupDetail.tsx` - Detailed group view with member info
- `AdminLeads.tsx` - Lead management and email tracking
- `AdminTools.tsx` - Developer tools and utilities

**Features**:
- Authentication via `AdminLogin.tsx` and `ProtectedAdminDashboard.tsx`
- Real-time Firestore data monitoring
- Manual message injection for testing conversations
- **Matching & Group Approval**:
  - Run matching algorithm to form pending groups
  - Review pending groups and member details
  - Approve groups (triggers email sending via callable function)
  - Delete groups (unmatches members)

### Matching & Group Formation
Groups are formed through a manual approval workflow:
1. Admin runs matching algorithm (dry run)
2. System creates groups with `status: 'pending'`
3. Admin reviews pending groups in dashboard
4. Admin approves valid groups -> triggers email sending -> moves to `active` status
5. Emails are sent via `EmailService` (Cloud Function)

## Common Development Tasks

### Add a new onboarding step
1. Add step to `OnboardingStep` enum in `types.ts`
2. Update the Gemini system prompt and extraction schema in `functions/src/gemini/index.ts`
3. Update context config in `config/contextConfig.ts` if needed
4. Test with test persona buttons

### Modify the agent's behavior
Edit the system prompt in `functions/src/gemini/index.ts`. Keep extraction schema, normalization logic, and response formatting aligned.

### Add a new data field to user profile
1. Add field to `UserProfile` interface in `types.ts`
2. Update the Gemini prompt to instruct extraction of this field
3. Add extraction/normalization logic in `functions/src/gemini/index.ts`
4. Test and verify Firestore stores the new field

### Test with Firebase Emulator
```bash
npm run emulator:seed
# App will connect to local Firestore (port 8083)
# Emulator UI is typically available at http://localhost:4000
```

### Deploy Cloud Functions
```bash
npm run deploy
# or for functions only:
firebase deploy --only functions
```

## Testing
Automated test scripts are not currently defined in root `package.json` or `functions/package.json`.

When adding tests:
1. Add scripts to `package.json` first (for example `test`, `test:watch`).
2. Keep AGENTS.md in sync with the actual test runner and file layout.
3. Prefer colocated tests or a dedicated `tests/` tree, but document whichever pattern is actually used.

## Code Structure Notes

- **No src/ directory**: Unlike typical React projects, source files are in the root. This is intentional for this MVP.
- **TypeScript throughout**: All critical business logic is typed.
- **Vite configuration**: Simple setup in `vite.config.ts`. Alias `@` points to project root.
- **React Router**: Uses `BrowserRouter` in `App.tsx`.
- **No state management library**: Uses props drilling and local state. Consider adding if complexity grows.

## Troubleshooting

**Start script issues (Mac/Linux)**
- Use `just emulator` for seeded local emulators, or `npm run emulators` + `npm run dev` in separate terminals
- Check log files: `firebase-emulator.log` and `vite-dev.log`
- If ports are in use, kill existing processes: `pkill -f "firebase emulators"`
- Ensure Firebase CLI is installed: `npm install -g firebase-tools`

**"Cannot read properties of undefined (reading 'serverTimestamp')"**
- This occurs when using `admin.firestore.FieldValue.serverTimestamp()`
- **Fix**: Update import to `import { FieldValue } from 'firebase-admin/firestore'` and use `FieldValue.serverTimestamp()`
- See "Firebase Admin SDK Timestamp Best Practices" section above






# General coding guidelines

DO NOT:
- create commits and push unless explicitly asked. 
- create summary md files unless asked

## Change Completeness Rule

> [!CAUTION]
> **Before considering any change complete, you MUST trace the full impact across the entire codebase.**

When making a change (e.g. updating counts, adding fields, modifying schemas, changing behavior):

1. **Search for all related config values** — constants, environment variables, and config objects that cap, limit, or parameterize the behavior you're changing. A schema change means nothing if a config value still enforces the old limit.
2. **Search for all consumers** — grep for every function, prompt, schema, validator, normalizer, and response builder that references the thing you're changing. Follow the data flow end to end: prompt → schema → parser → normalizer → response builder → client.
3. **Search for hardcoded values** — look for magic numbers, `.slice()` calls, array length checks, and min/max constraints that may silently override your change.
4. **Verify validation and error checks** — update any assertions, minimum count checks, or error messages that reference the old values.

If you change a prompt to request N items, confirm that the schema allows N, the config caps at N, the normalizer collects N, and the validation expects N. A partial change that only updates one layer will silently fail.
