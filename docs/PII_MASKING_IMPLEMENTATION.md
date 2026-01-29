# PII Masking Implementation

## Overview

This document describes the implementation of PII (Personally Identifiable Information) masking in the Dad Circles application to prevent exposure of sensitive user data in logs.

## Problem

Raw email addresses and postcodes were being logged throughout the Cloud Functions codebase, creating potential privacy and security risks. This included:

- Email addresses in follow-up email jobs
- Email addresses in magic link requests
- Email addresses in rate limiter logs
- Email addresses in abandonment recovery emails
- Postcodes in location lookup failures

## Solution

Created a centralized PII masking utility (`functions/src/utils/pii.ts`) with three main functions:

### 1. `maskEmail(email: string | undefined | null): string`

Masks email addresses for safe logging by showing only the first character of the local part and the full domain.

**Examples:**
- `john.doe@example.com` → `j***@example.com`
- `a@test.com` → `a***@test.com`
- `undefined` → `[no-email]`
- `invalid` → `[invalid-email]`

### 2. `maskPostcode(postcode: string | undefined | null): string`

Masks postcodes by showing only the first 3 characters.

**Examples:**
- `SW1A 1AA` → `SW1***`
- `12345` → `123***`
- `undefined` → `[no-postcode]`

### 3. `maskPII<T>(obj: T): T`

Convenience function that masks both email and postcode fields in an object.

**Example:**
```typescript
const data = { email: 'user@test.com', postcode: '12345', name: 'John' };
const masked = maskPII(data);
// Result: { email: 'u***@test.com', postcode: '123***', name: 'John' }
```

## Files Modified

### Cloud Functions

1. **functions/src/index.ts**
   - Masked emails in follow-up email job logs
   - Masked emails in abandonment recovery job logs
   - Masked emails and postcodes in location lookup failures
   - Masked emails in welcome email validation logs

2. **functions/src/callable.ts**
   - Masked emails in magic link request logs
   - Masked emails in rate limiter warnings
   - Masked emails and postcodes in location lookup failures

3. **functions/src/emailService.ts**
   - Masked emails in all email sending logs (both simulated and real)
   - Masked emails in console output for emulator mode
   - Masked emails in group introduction email logs

4. **functions/src/rateLimiter.ts**
   - Masked emails in rate limit warnings
   - Masked emails in rate limit errors
   - Masked emails in rate limit reset logs

### New Files

1. **functions/src/utils/pii.ts** - Core masking utility
2. **tests/utils/pii.test.ts** - Comprehensive test suite (18 tests, all passing)

## Testing

All masking functions are fully tested with 18 test cases covering:
- Standard email formats
- Edge cases (empty, null, undefined, invalid)
- UK and US postcodes
- Object masking
- Immutability (original objects are not modified)

Run tests with:
```bash
npm test -- pii.test.ts
```

## Usage Guidelines

### When to Use

Use PII masking whenever logging data that might contain:
- Email addresses
- Postcodes/zip codes
- Any other personally identifiable information

### How to Use

```typescript
import { maskEmail, maskPostcode, maskPII } from './utils/pii';

// Mask individual fields
logger.info('User action', { 
  email: maskEmail(user.email),
  postcode: maskPostcode(user.postcode)
});

// Mask entire objects
logger.info('User data', maskPII({ 
  email: user.email, 
  postcode: user.postcode,
  name: user.name 
}));
```

### Console Output

Note that `console.log` statements in the emulator are also masked. This is intentional for development environments where logs might be shared or stored.

## Benefits

1. **Privacy Protection**: User email addresses and postcodes are no longer exposed in logs
2. **Compliance**: Helps meet privacy regulations (GDPR, CCPA, etc.)
3. **Security**: Reduces risk of data leaks through log files
4. **Debugging**: Still provides enough information to identify users (first character + domain)
5. **Consistency**: Centralized utility ensures uniform masking across the codebase

## Future Enhancements

Consider adding masking for:
- Phone numbers
- Full names
- IP addresses
- Session IDs (partial masking)
- Any other PII fields added to the system

## Related Documentation

- [AGENTS.md](../AGENTS.md) - Development guidelines
- [SECURITY.md](../SECURITY.md) - Security best practices
