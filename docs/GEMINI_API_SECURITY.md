# Gemini API Security Implementation

## Overview

The Gemini API integration has been moved from client-side to server-side to prevent API key exposure. The API key is now stored securely in Firebase Secrets and accessed only by Cloud Functions.

## Architecture

### Before (Insecure)
```
Client Browser → Gemini API (with exposed API key)
```

### After (Secure)
```
Client Browser → Cloud Function → Gemini API (with secret key)
```

## Setup Instructions

### 1. Remove Client-Side API Key

The `VITE_GEMINI_API_KEY` environment variable is no longer needed in `.env`. You can remove it:

```bash
# Remove this line from .env
# VITE_GEMINI_API_KEY=your_key_here
```

### 2. Configure Firebase Secret (Local Development)

For local development with Firebase Emulators:

```bash
# Navigate to functions directory
cd functions

# Create or update .secret.local file
echo "GEMINI_API_KEY=your_actual_gemini_api_key_here" > .secret.local
```

The `.secret.local` file is automatically loaded by Firebase Emulators and is already in `.gitignore`.

### 3. Configure Firebase Secret (Production)

For production deployment, store the secret in Google Cloud Secret Manager:

```bash
# Set the secret (one-time setup)
firebase functions:secrets:set GEMINI_API_KEY

# You'll be prompted to enter the API key value
# Paste your Gemini API key and press Enter
```

To verify the secret is set:

```bash
firebase functions:secrets:access GEMINI_API_KEY
```

### 4. Install Dependencies

The Cloud Functions require the Gemini SDK:

```bash
cd functions
npm install
cd ..
```

This installs:
- `@google/genai` - Gemini AI SDK
- `@modelcontextprotocol/sdk` - Required peer dependency

### 5. Deploy Cloud Functions

Deploy the updated Cloud Functions with the secret:

```bash
# Deploy all functions
npm run deploy

# Or deploy only the Gemini function
firebase deploy --only functions:getGeminiResponse
```

## Code Changes

### New Files

1. **`functions/src/gemini.ts`** - Backend Gemini service with secure API key access
2. **`services/callableGeminiService.ts`** - Client service that calls the Cloud Function
3. **`docs/GEMINI_API_SECURITY.md`** - This documentation

### Modified Files

1. **`functions/src/index.ts`** - Exports the new `getGeminiResponse` function
2. **`components/UserChatInterface.tsx`** - Uses `callableGeminiService` instead of `geminiService`
3. **`components/AdminChatInterface.tsx`** - Uses `callableGeminiService` instead of `geminiService`

### Deprecated Files

The following file is now deprecated but kept for reference:

- **`services/geminiService.ts`** - Old client-side implementation (DO NOT USE)

## Testing

### Local Testing with Emulators

1. Start the emulators with the secret:
```bash
npm run dev:full
```

2. The Cloud Function will automatically load `GEMINI_API_KEY` from `.secret.local`

3. Test the chat interface - it should work exactly as before

### Production Testing

After deployment, test the production environment:

1. Open your deployed app
2. Start a chat session
3. Verify responses are working
4. Check Cloud Functions logs:
```bash
firebase functions:log --only getGeminiResponse
```

## Security Benefits

1. **No Client Exposure**: API key never appears in browser or client bundle
2. **Secret Management**: Key stored in Google Cloud Secret Manager (encrypted at rest)
3. **Access Control**: Only authorized Cloud Functions can access the secret
4. **Audit Trail**: All API calls are logged server-side
5. **Rate Limiting**: Can add server-side rate limiting to prevent abuse

## Troubleshooting

### Error: "GEMINI_API_KEY not configured"

**Local Development:**
- Ensure `.secret.local` exists in `functions/` directory
- Verify the file contains: `GEMINI_API_KEY=your_key`
- Restart emulators: `npm run dev:full`

**Production:**
- Set the secret: `firebase functions:secrets:set GEMINI_API_KEY`
- Redeploy functions: `npm run deploy`

### Error: "functions/unauthenticated"

The Cloud Function requires Firebase initialization. Ensure:
- Firebase is properly initialized in `firebase.ts`
- User has a valid session (doesn't require authentication, just initialization)

### Error: "functions/deadline-exceeded"

The Gemini API call timed out (30s limit). This is rare but can happen with:
- Very long conversation histories
- Slow network connections
- Gemini API issues

The client will show a user-friendly error and allow retry.

## Migration Checklist

- [x] Create backend Gemini service (`functions/src/gemini.ts`)
- [x] Create client callable service (`services/callableGeminiService.ts`)
- [x] Update Cloud Functions index to export new function
- [x] Update `UserChatInterface.tsx` to use new service
- [x] Update `AdminChatInterface.tsx` to use new service
- [x] Document setup instructions
- [ ] Set up `.secret.local` for local development
- [ ] Set up Firebase Secret for production
- [ ] Deploy Cloud Functions
- [ ] Test in local environment
- [ ] Test in production environment
- [ ] Remove `VITE_GEMINI_API_KEY` from `.env`
- [ ] Update `.env.example` to remove `VITE_GEMINI_API_KEY`

## Cost Considerations

Moving to Cloud Functions adds minimal cost:
- Cloud Functions: ~$0.40 per million invocations
- Typical chat session: 10-20 invocations
- Cost per session: ~$0.000008 (negligible)

The security benefits far outweigh the minimal cost increase.

## Future Enhancements

Potential improvements to consider:

1. **Rate Limiting**: Add per-user rate limits to prevent abuse
2. **Caching**: Cache common responses to reduce API calls
3. **Analytics**: Track API usage and costs per user
4. **Fallback**: Implement fallback responses if Gemini is unavailable
5. **A/B Testing**: Test different prompts or models server-side
