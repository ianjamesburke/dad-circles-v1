# Security & Email Flow Improvements

## Issue #1: Magic Link Spam Prevention

### Problem
The sendMagicLink function could be abused to spam any email address.

### Solution: Firestore-Based Rate Limiting
- 3 requests per hour per email
- 1-hour block after exceeding limit
- Transactional updates prevent race conditions
- Graceful degradation if rate limiter fails

### Files Changed
- functions/src/rateLimiter.ts (NEW)
- functions/src/callable.ts
- components/LandingPage.tsx

## Issue #2: Follow-up Email Logic Flaw

### Problem
Follow-up emails only sent to completed users, not abandoned users.

### Solution: Track Abandonment Separately
- Added abandonmentEmailSent field to Lead interface
- Updated abandonment function to set this field
- Follow-up query now checks BOTH welcomeEmailSent and abandonmentEmailSent
- Deduplicates results by email

### Files Changed
- types.ts
- functions/src/index.ts

## Testing
1. Rate limiter: Submit same email 4 times, verify 4th is blocked
2. Follow-up: Verify both completed and abandoned users receive follow-ups

## Deployment
Run: npm run deploy


---

## Issue #3: Insecure Group ID Generation

### Problem
Group IDs were using `Math.random()` which is predictable and not cryptographically secure.

**Before**:
```typescript
const groupId = `group-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
```

**After**:
```typescript
const groupId = crypto.randomUUID();
```

### Solution
- Changed to `crypto.randomUUID()` for cryptographically secure IDs
- Consistent with session ID generation pattern
- Prevents potential ID prediction attacks

### Files Changed
- functions/src/matching.ts

### Impact
- Group IDs are now cryptographically secure UUIDs
- Consistent ID generation across the codebase
- Prevents potential security vulnerabilities

---

## Best Practices

### ID Generation
- ✅ Always use `crypto.randomUUID()` for generating IDs
- ❌ Never use `Math.random()` for security-sensitive values
- ✅ Session IDs: `crypto.randomUUID()`
- ✅ Group IDs: `crypto.randomUUID()`

### API Keys and Secrets
- ✅ Never commit `.env` files to version control
- ✅ Use `.env.example` as a template
- ✅ Ensure `.env` is in `.gitignore`
- ✅ Use Firebase Secret Manager for production secrets

### Email Security
- ✅ Validate email addresses before sending
- ✅ Use template-based emails to prevent injection
- ✅ Rate limit email sending (10 concurrent instances)
- ✅ Track email failures for monitoring

---

## Future Considerations

1. **Rate Limiting**: Consider adding rate limiting to callable functions to prevent abuse
2. **Input Validation**: Add comprehensive input validation to all callable functions
3. **CORS Configuration**: Review CORS settings for production deployment
4. **Authentication**: Consider adding authentication tokens for admin functions
5. **Audit Logging**: Add audit logs for sensitive operations (group deletion, matching, etc.)
