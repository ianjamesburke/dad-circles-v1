# Gemini API Security Migration Checklist

Use this checklist to track the migration from client-side to server-side Gemini API integration.

## Pre-Migration

- [x] Identify security vulnerability (API key exposed in client)
- [x] Design secure architecture (Cloud Functions + Firebase Secrets)
- [x] Create backend implementation (`functions/src/gemini.ts`)
- [x] Create client callable service (`services/callableGeminiService.ts`)
- [x] Update components to use new service
- [x] Create documentation and setup scripts
- [x] Verify no TypeScript errors

## Local Development Setup

- [ ] Run setup script: `./scripts/setup-gemini-secret.sh`
  - OR manually create `functions/.secret.local` with `GEMINI_API_KEY=your_key`
- [ ] Start emulators: `npm run dev:full`
- [ ] Test chat interface (send a message, verify response)
- [ ] Check browser console (no errors)
- [ ] Check emulator logs (verify `getGeminiResponse` calls)
- [ ] Verify API key not visible in browser DevTools

## Production Deployment

### Step 1: Set Firebase Secret

- [ ] Run: `firebase functions:secrets:set GEMINI_API_KEY`
- [ ] Enter your Gemini API key when prompted
- [ ] Verify: `firebase functions:secrets:access GEMINI_API_KEY`

### Step 2: Install Dependencies

- [ ] Navigate to functions: `cd functions`
- [ ] Install packages: `npm install`
- [ ] Verify `@google/genai` and `@modelcontextprotocol/sdk` are installed
- [ ] Return to root: `cd ..`

### Step 3: Deploy Cloud Functions

- [ ] Build functions: `cd functions && npm run build`
- [ ] Deploy: `npm run deploy` (or `firebase deploy --only functions`)
- [ ] Wait for deployment to complete
- [ ] Check deployment logs for errors

### Step 4: Verify Production

- [ ] Open production site
- [ ] Test chat interface (send a message)
- [ ] Verify response is received
- [ ] Check browser console (no errors)
- [ ] Check Cloud Functions logs: `firebase functions:log --only getGeminiResponse`
- [ ] Verify successful API calls in logs

### Step 5: Security Verification

- [ ] Build production bundle: `npm run build`
- [ ] Search for API key in bundle: `grep -r "AIza" dist/` (should find nothing)
- [ ] Search for env var: `grep -r "VITE_GEMINI_API_KEY" dist/` (should find nothing)
- [ ] Open browser DevTools → Network tab
- [ ] Verify calls go to Cloud Function, not directly to Gemini API
- [ ] Verify no API key visible in any network requests

## Cleanup

- [ ] Remove `VITE_GEMINI_API_KEY` from `.env` file
- [ ] Verify `.env.example` doesn't reference `VITE_GEMINI_API_KEY`
- [ ] Consider deleting `services/geminiService.ts` (old implementation)
- [ ] Update team documentation
- [ ] Notify team members to run setup script

## Rollback Plan (If Needed)

If issues arise in production:

1. [ ] Revert component imports:
   ```typescript
   // Change from:
   import { getAgentResponse } from '../services/callableGeminiService';
   // Back to:
   import { getAgentResponse } from '../services/geminiService';
   ```

2. [ ] Redeploy: `npm run deploy`

3. [ ] Investigate and fix issues

4. [ ] Re-attempt migration

**Note**: Rollback is insecure and should only be temporary.

## Post-Migration

- [ ] Monitor Cloud Functions costs (first week)
- [ ] Monitor error rates in Cloud Functions logs
- [ ] Verify no increase in failed chat responses
- [ ] Document any issues encountered
- [ ] Update team on successful migration

## Success Criteria

✅ Migration is successful when:

1. Chat interface works in both local and production
2. No API key visible in client bundle or browser
3. Cloud Functions logs show successful Gemini API calls
4. No increase in error rates
5. Response times remain acceptable (< 5 seconds)
6. All team members can run local development

## Troubleshooting

### Issue: "GEMINI_API_KEY not configured"

**Local**: 
- Ensure `functions/.secret.local` exists
- Restart emulators: `npm run dev:full`

**Production**:
- Run: `firebase functions:secrets:set GEMINI_API_KEY`
- Redeploy: `npm run deploy`

### Issue: Chat not responding

1. Check browser console for errors
2. Check Cloud Functions logs: `firebase functions:log`
3. Verify Firebase initialization in `firebase.ts`
4. Test with a simple message

### Issue: Slow responses

- Check Cloud Functions logs for timeout errors
- Consider increasing timeout in `functions/src/gemini.ts`
- Monitor Gemini API status

### Issue: High costs

- Review Cloud Functions invocation count
- Check for retry loops or infinite calls
- Consider adding rate limiting

## Resources

- **Quick Start**: `docs/QUICK_START_GEMINI.md`
- **Full Documentation**: `docs/GEMINI_API_SECURITY.md`
- **Summary**: `SECURITY_GEMINI_FIX.md`
- **Setup Script**: `scripts/setup-gemini-secret.sh`

## Sign-Off

- [ ] Developer: Migration completed and tested locally
- [ ] Reviewer: Code reviewed and approved
- [ ] DevOps: Production deployment successful
- [ ] QA: Production testing passed
- [ ] Team Lead: Migration approved and documented

---

**Migration Date**: _________________

**Completed By**: _________________

**Notes**:
