# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Dad Circles Onboarding MVP is a conversational onboarding application built with React and Gemini 2.0 Flash LLM. The application guides new and expecting dads through a structured onboarding flow while collecting relevant user information (status, children, interests, location). The backend uses Firebase (Firestore for data, Cloud Functions for email), and the frontend is a Vite-powered React app with a test persona system and admin monitoring dashboard.

## Quick Start Commands

### Mac/Linux - One Command Start (Recommended)
```bash
# Start everything (emulators + dev server) with automatic cleanup
./start-dev.sh
```

> [!WARNING]
> If you modify the emulators (e.g., adding Auth) or server configurations, you MUST update `./start-dev.sh` to reflect these changes. The script does not automatically detect changes in `firebase.json` or other config files regarding which services to start.

This script will:
- Install dependencies if needed
- Check for .env file
- Clean up any existing processes
- Start Firebase emulators (Firestore)
- Start Vite dev server
- Show all service URLs
- Handle cleanup on Ctrl+C

### Individual Commands
```bash
# Install dependencies
npm install

# Development server (uses Vite)
npm run dev

# Development with local Gemini API key (set in command)
npm run dev:local

# Start Express server (separate, for serverless emulation)
npm run dev:server

# Build for production
npm run build

# Preview production build locally
npm run preview

# Deploy to Firebase (hosting + functions)
npm run deploy

# Deploy only hosting
npm run deploy:hosting

# Start Firebase emulators (Firestore, Functions, Hosting)
npm run emulator

# Start emulators with data import/export
npm run emulator:seed
```

## Architecture

### High-Level Data Flow

1. **Frontend (React/Vite)** → User interacts with chat interface or landing page
2. **Chat API** (`api/chat.ts`) → Processes user messages, manages conversation state
3. **Gemini Service** (`services/geminiService.ts`) → Calls Google Gemini API with context, manages onboarding step logic
4. **Database** (`database.ts`) → Firestore operations (profiles, messages, leads)
5. **Firebase Functions** (`functions/src/`) → Cloud Functions trigger on lead creation or schedule to send emails
6. **Email Service** → Resend.com API for email delivery

### Key Directories

- **`/components`** - React components: ChatInterface, AdminDashboard, LandingPage, Layout, ContextTestPanel
- **`/api`** - Request/response interfaces and handlers (chat.ts, leads.ts)
- **`/services`** - Core business logic: Gemini API integration, context management
- **`/utils`** - Utilities: analytics, helper functions
- **`/config`** - Configuration files (e.g., contextConfig.ts for context window management)
- **`/functions`** - Firebase Cloud Functions (email service, scheduled tasks)
- **`/functions/src`** - TypeScript source for Cloud Functions

### Data Model

**UserProfile** (Firestore `profiles` collection):
- `session_id` - Unique session identifier
- `name` - User's first name (captured during onboarding)
- `onboarding_step` - Current step (enum: WELCOME, NAME, STATUS, CHILD_INFO, SIBLINGS, INTERESTS, LOCATION, CONFIRM, COMPLETE)
- `onboarded` - Boolean indicating completion
- `children` - Array of child objects with type, birth_month, birth_year, optional gender
- `siblings` - Array of existing children (captured separately)
- `interests` - Array of user interests
- `location` - Object with city and state_code
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
> 2. **Backend Logic**: Use **Firebase Callable Functions** (`onCall`) for backend logic that requires safety or admin privileges (e.g., matching algorithms, emails). Call them via `database.functions.myFunction`.
> 3. **Avoid**: Do NOT create custom Express/HTTP endpoints (`onRequest`) for internal tools. They require complex proxy configuration in Vite. Stick to standard Firebase patterns.

> [!IMPORTANT]
> **Firebase Admin SDK Timestamp Best Practices**:
> 
> When working with timestamps in Cloud Functions (`functions/src/`), follow these patterns:
> 
> 1. **For Client Timestamps**: Use `Date.now()` - returns milliseconds since epoch as a number
>    ```typescript
>    await db.collection('profiles').doc(id).update({
>      last_updated: Date.now()
>    });
>    ```
> 
> 2. **For Server Timestamps**: Import `FieldValue` from `firebase-admin/firestore` (NOT `admin.firestore.FieldValue`)
>    ```typescript
>    import { FieldValue } from 'firebase-admin/firestore';
>    
>    await db.collection('profiles').doc(id).update({
>      created_at: FieldValue.serverTimestamp()
>    });
>    ```
> 
> 3. **Why This Matters**:
>    - `admin.firestore.FieldValue` can be `undefined` in Firebase emulator contexts
>    - Modern Firebase Admin SDK (v9+) uses modular imports
>    - `Date.now()` is simpler and works consistently everywhere
>    - Use server timestamps only when you need true server-side time (e.g., for security)
> 
> 4. **Current Codebase Pattern**:
>    - Most of the codebase uses `Date.now()` for timestamps
>    - This is the preferred approach for consistency
>    - Only use `FieldValue.serverTimestamp()` if you have a specific reason (e.g., preventing client time manipulation)

## Key Architectural Patterns

### Onboarding State Machine
The system strictly follows a defined sequence of onboarding steps. The Gemini Service (`services/geminiService.ts`) receives the current `onboarding_step` and context, then returns:
- `message` - Next agent response
- `next_step` - Which step to transition to
- `profile_updates` - Any profile fields to update based on extracted user information

The system is designed to extract user intent from natural language and progress through the state machine strictly (no skipping steps without explicit user confirmation).

### Context Window Management
Context management is critical for cost and quality. The `services/contextManager.ts` implements smart message slicing:
- Recent messages are prioritized
- Token counting estimates context size
- Config in `config/contextConfig.ts` defines limits by onboarding step

This prevents overwhelming the Gemini API with unnecessary history while maintaining conversation state.

### Firebase Emulator for Development
The app supports Firebase Firestore emulator for local development. The emulator can be started with `npm run emulator`. Connection is configured in `firebase.js` but currently commented out (disabled while testing email functionality).

### Cloud Functions and Email
Firebase Cloud Functions (in `functions/`) trigger on:
1. **Document creation** - When a lead signs up, `sendWelcomeEmail` fires automatically
2. **Scheduled jobs** - Follow-up emails run on a schedule to nurture inactive leads

The `EmailService` class (`functions/src/emailService.ts`) abstracts Resend.com API calls.

## Environment Variables

Create a `.env` file in the root with:

```
# Gemini API
VITE_GEMINI_API_KEY=your_gemini_api_key

# Firebase (if not using emulator)
VITE_FIREBASE_API_KEY=your_key
VITE_FIREBASE_AUTH_DOMAIN=your_domain
VITE_FIREBASE_PROJECT_ID=dad-circles
VITE_FIREBASE_STORAGE_BUCKET=your_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_id
VITE_FIREBASE_APP_ID=your_app_id

# Resend Email Service (for Cloud Functions)
RESEND_API_KEY=your_resend_key
```

## Important Implementation Details

### Gemini System Prompt
The Gemini system prompt (`services/geminiService.ts` lines 22-95) is highly detailed and controls the agent's behavior:
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
The `AdminDashboard.tsx` shows:
- List of active sessions with their current onboarding step
- Real-time monitoring capability
- Manual message injection for testing
- **Matching & Group Approval**:
  - Run matching algorithm to form pending groups
  - Review pending groups and member details
  - Approve groups (triggers email sending)
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
2. Update the Gemini system prompt in `services/geminiService.ts` with step logic
3. Update context config in `config/contextConfig.ts` if needed
4. Test with test persona buttons

### Modify the agent's behavior
Edit the system prompt in `services/geminiService.ts`. The prompt is the single source of truth for agent behavior—it's comprehensive and self-documenting.

### Add a new data field to user profile
1. Add field to `UserProfile` interface in `types.ts`
2. Update the Gemini prompt to instruct extraction of this field
3. Add extraction logic in the `getAgentResponse` function in `services/geminiService.ts`
4. Test and verify Firestore stores the new field

### Test with Firebase Emulator
```bash
npm run emulator:seed
# App will connect to local Firestore (port 8083)
# UI available at http://localhost:4004
```

### Deploy Cloud Functions
```bash
npm run deploy
# or for functions only:
firebase deploy --only functions
```

## Testing

### Test Framework
The project uses **Vitest** for unit testing with the following setup:
- **Vitest** - Fast, Vite-native test runner
- **@testing-library/react** - React component testing utilities
- **@testing-library/jest-dom** - Custom DOM matchers
- **jsdom** - Browser environment simulation

### Running Tests

```bash
# Run all tests once
npm test

# Run tests in watch mode (for TDD)
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run tests with UI (interactive)
npm run test:ui
```

### Test Structure

```
tests/
├── setup.ts                    # Global test setup and mocks
├── factories/
│   └── index.ts               # Test data factories
├── config/
│   └── contextConfig.test.ts  # Config tests
├── services/
│   ├── contextManager.test.ts # Context management tests
│   └── matching.test.ts       # Matching algorithm tests
├── utils/
│   └── contextAnalytics.test.ts # Analytics tests
└── types.test.ts              # Type/enum tests
```

### Test Factories

Use factories in `tests/factories/index.ts` to create consistent test data:

```typescript
import { 
  createMessage, 
  createMessages, 
  createConversation,
  createUserProfile,
  createChildWithAge,
  createExpectingChild,
  createLocation,
  createUsersInLocation,
  createGroup,
  createLead,
  resetFactories 
} from '../factories';

// Create a single message
const msg = createMessage({ content: 'Hello' });

// Create a conversation (alternating user/agent)
const conversation = createConversation(5); // 10 messages total

// Create a user with a 6-month-old child
const user = createUserProfile({
  children: [createChildWithAge(6)]
});

// Create users in a specific location
const austinDads = createUsersInLocation(4, createLocation({ city: 'Austin', state_code: 'TX' }));
```

### Writing New Tests

1. **Create test file** in appropriate directory under `tests/`
2. **Import factories** for test data
3. **Use `beforeEach`** to reset state between tests
4. **Follow AAA pattern**: Arrange, Act, Assert

Example:
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { resetFactories, createUserProfile } from '../factories';

describe('MyFeature', () => {
  beforeEach(() => {
    resetFactories();
  });

  it('should do something', () => {
    // Arrange
    const user = createUserProfile({ name: 'Test Dad' });
    
    // Act
    const result = myFunction(user);
    
    // Assert
    expect(result).toBe(expected);
  });
});
```

### Coverage

Current coverage targets:
- `services/**/*.ts` - Core business logic
- `utils/**/*.ts` - Utility functions
- `config/**/*.ts` - Configuration
- `types.ts` - Type definitions

Files with external dependencies (Firebase, Gemini API) are tested via integration tests or mocked.

### Test-Driven Development (TDD)

For TDD workflow:
1. Run `npm run test:watch`
2. Write a failing test
3. Implement the minimum code to pass
4. Refactor
5. Repeat

## Testing Considerations

- **Unit tests**: Configured with Vitest. Run `npm test` for all tests, `npm run test:watch` for TDD.
- **Test factories**: Use `tests/factories/index.ts` for creating consistent test data.
- **Integration testing**: Use test persona system in chat interface to test different onboarding paths.
- **Email testing**: Manual-test.ts in functions demonstrates how to test email service without triggering live sends.
- **Emulator**: Use Firebase Emulator UI to inspect Firestore data during development.
- **Coverage**: Run `npm run test:coverage` to see coverage report.

## Code Structure Notes

- **No src/ directory**: Unlike typical React projects, source files are in the root. This is intentional for this MVP.
- **TypeScript throughout**: All critical business logic is typed.
- **Vite configuration**: Simple setup in `vite.config.ts`. Alias `@` points to project root.
- **React Router**: Uses HashRouter for client-side routing (no server-side routing needed).
- **No state management library**: Uses props drilling and local state. Consider adding if complexity grows.

## Performance & Cost Considerations

- Gemini API calls are optimized via context window management to reduce tokens
- Firebase Firestore uses indexed queries for common patterns
- Cloud Functions are rate-limited to 10 concurrent instances (set in index.ts)
- Email sending uses Resend.com instead of Firebase Sendmail for better deliverability

## Troubleshooting

**"GEMINI API key not found"**
- Ensure `.env` file exists with `VITE_GEMINI_API_KEY` set
- Restart dev server after adding .env
- Check `console.log` output in dev tools

**Firestore emulator not connecting**
- Uncomment connection code in `firebase.js` (currently disabled)
- Ensure `firebase emulators:start` is running on port 8083

**Messages not persisting**
- If using emulator, ensure data export is configured: `npm run emulator:seed`
- Check Firestore browser console to verify collections exist

**Email not sending**
- Verify `RESEND_API_KEY` is correct and has production access
- Check Cloud Functions logs: `firebase functions:log`
- Test email service separately using `manual-test.ts`

**Start script issues (Mac/Linux)**
- Make sure script is executable: `chmod +x start-dev.sh`
- Check log files: `firebase-emulator.log` and `vite-dev.log`
- If ports are in use, kill existing processes: `pkill -f "firebase emulators"`
- Ensure Firebase CLI is installed: `npm install -g firebase-tools`
