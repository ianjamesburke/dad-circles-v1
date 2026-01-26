# Implementation Plan: Magic Links & Abandonment Recovery

## Overview

Implement secure magic link authentication and automated abandonment recovery for Dad Circles onboarding. This plan focuses on MVP priorities with security as the foundation.

## Implementation Strategy: 3 Phases

**Phase 1**: Security foundations (UUID sessions, magic link sending)
**Phase 2**: Email service refactor (template support, location variables)
**Phase 3**: Email logic changes (abandonment recovery, completion emails)

This phased approach allows testing security improvements before touching the email system, reducing risk and enabling easy rollback.

---

## Phase 1: Security Foundations

### 1.1 Replace Math.random() with crypto.randomUUID()

**File**: `components/LandingPage.tsx`
**Line**: 49

**Change**:
```typescript
// Current (INSECURE):
sessionId = `user-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

// New (SECURE):
sessionId = crypto.randomUUID();
```

**Why**: Math.random() is predictable and can be guessed. UUIDs provide cryptographic security (128-bit random).

**Test**: Verify chat links still work with UUID format.

---

### 1.2 Create sendMagicLink Callable Function

**File**: `functions/src/callable.ts` (new file or add to existing)

**Purpose**: Send magic link privately via email when duplicate email detected.

**Implementation**:
```typescript
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import { EmailService, EMAIL_TEMPLATES } from './emailService';
import { getLocationFromPostcode, formatLocation } from './utils/location';

export const sendMagicLink = onCall({ cors: true }, async (request) => {
  const { email } = request.data;

  if (!email) {
    throw new HttpsError('invalid-argument', 'Email is required');
  }

  const db = admin.firestore();

  // Find profile by email
  const profileQuery = db.collection('profiles')
    .where('email', '==', email.toLowerCase())
    .limit(1);

  const snapshot = await profileQuery.get();

  if (snapshot.empty) {
    // Don't reveal whether email exists (prevent enumeration)
    return { success: true };
  }

  const profile = snapshot.docs[0].data();

  // Only send if profile has session and hasn't completed
  if (!profile.session_id || profile.onboarded) {
    return { success: true };
  }

  // Generate magic link
  const magicLink = `https://dadcircles.com/chat?session=${profile.session_id}`;

  // Get location string
  const locationInfo = await getLocationFromPostcode(profile.postcode);
  const locationString = locationInfo
    ? formatLocation(locationInfo.city, locationInfo.stateCode)
    : profile.postcode;

  // Send resume-session email using template
  const emailTemplate = {
    to: email.toLowerCase(),
    templateId: EMAIL_TEMPLATES.RESUME_SESSION,
    variables: {
      magic_link: magicLink,
      location: locationString
    }
  };

  await EmailService.sendTemplateEmail(emailTemplate);

  logger.info('Magic link sent', { email: email.toLowerCase() });

  return { success: true };
});
```

**Security benefits**:
- No session exposure in frontend
- Only email owner can resume
- Prevents enumeration attacks

**Export**: Add to `functions/src/index.ts`:
```typescript
export { sendMagicLink } from './callable';
```

---

### 1.3 Update Duplicate Email Detection Flow

**File**: `components/LandingPage.tsx`
**Lines**: 36-43

**Change**:
```typescript
// Current: Just shows error message
if (existingLead && existingLead.session_id && !signupForOther) {
  setErrorMessage(
    "Looks like you've already signed up! Check your email..."
  );
  setIsSubmitting(false);
  return;
}

// New: Triggers magic link email
if (existingLead && existingLead.session_id && !signupForOther) {
  setErrorMessage(
    "We found an existing account with this email. Check your inbox - we've sent you a link to continue your session."
  );

  // Call Cloud Function to send magic link
  try {
    const sendMagicLinkFn = httpsCallable(functions, 'sendMagicLink');
    await sendMagicLinkFn({ email: email.toLowerCase() });
  } catch (error) {
    console.error('Error sending magic link:', error);
    // Don't show error to user - already told them to check email
  }

  setIsSubmitting(false);
  return;
}
```

**Test**: Sign up with same email twice, verify magic link email arrives.

---

## Phase 2: Email Service Refactor

### 2.1 Add Template Support to EmailService

**File**: `functions/src/emailService.ts`

**Add interfaces and constants**:
```typescript
export interface TemplateEmail {
  to: string;
  templateId: string;
  variables: Record<string, string | number>;
  from?: string;
}

export const EMAIL_TEMPLATES = {
  WELCOME_COMPLETED: '581857a1-c2d1-447e-b9a3-027c9686a844',
  WELCOME_ABANDONED: 'a7bf64bb-16d9-4f6d-901f-d03390343678',
  RESUME_SESSION: '995b6c14-d43b-4812-b2a2-b73ba520d9d9',
  SIGNUP_OTHER: 'd8f8d57b-157a-4789-a198-69a50264a415',
  FOLLOWUP_3DAY: '75ff87d7-4f33-4feb-8dd0-037d8a4d2c7a',
  GROUP_INTRO: 'a5bc8d61-234d-4bb8-9f16-206a803aa51f',
} as const;
```

**Add new method**:
```typescript
static async sendTemplateEmail(
  template: TemplateEmail,
  forceSimulation: boolean = false
): Promise<boolean> {
  const from = template.from || this.DEFAULT_FROM;

  // Determine if we should simulate
  const shouldSimulate =
    forceSimulation ||
    (isEmulator && !sendRealEmails) ||
    !resend;

  if (shouldSimulate) {
    // Enhanced simulation logging for templates
    console.log("\n" + "=".repeat(50));
    console.log("📧 SIMULATED TEMPLATE EMAIL");
    console.log("=".repeat(50));
    console.log(`To:       ${template.to}`);
    console.log(`From:     ${from}`);
    console.log(`Template: ${template.templateId}`);
    console.log(`Variables:`, template.variables);
    console.log("=".repeat(50) + "\n");

    return true;
  }

  try {
    if (!resend) throw new Error("Resend client not initialized");

    // Send using Resend template API
    // NOTE: Verify exact syntax in Resend SDK docs
    const result = await resend.emails.send({
      from: from,
      to: template.to,
      react: template.templateId, // May need to adjust based on Resend SDK
      // Variables passed automatically by Resend
    });

    if (result.error) {
      logger.error("❌ Resend template API error:", result.error);
      return false;
    }

    logger.info("✅ Template email sent successfully", {
      emailId: result.data?.id,
      to: template.to,
      templateId: template.templateId,
    });

    return true;
  } catch (error) {
    logger.error("Template email service error:", error);
    return false;
  }
}
```

**Import location utilities** at top of file:
```typescript
import { getLocationFromPostcode, formatLocation } from './utils/location';
```

**Test**: Send test email in simulation mode first, then verify Resend API syntax.

---

## Phase 3: Email Logic Changes

### 3.1 Update Welcome Email Logic

**File**: `functions/src/index.ts`
**Function**: `sendWelcomeEmail` (lines 43-145)

**Change**:
```typescript
export const sendWelcomeEmail = onDocumentCreated(
  { document: "leads/{leadId}", region: "us-central1" },
  async (event) => {
    try {
      const leadData = event.data?.data();

      if (!leadData || !leadData.email || !leadData.postcode) {
        logger.error("Missing required fields", { leadData });
        return;
      }

      const { email, postcode, signupForOther } = leadData;

      // If signing up for someone else, send immediate email
      if (signupForOther) {
        const locationInfo = await getLocationFromPostcode(postcode);
        const locationString = locationInfo
          ? formatLocation(locationInfo.city, locationInfo.stateCode)
          : postcode;

        const emailTemplate = {
          to: email,
          templateId: EMAIL_TEMPLATES.SIGNUP_OTHER,
          variables: { location: locationString }
        };

        const success = await EmailService.sendTemplateEmail(emailTemplate);

        if (success) {
          await event.data?.ref.update({
            signupOtherEmailSent: true,
            signupOtherEmailSentAt: Date.now(),
          });
        }
      } else {
        // Mark welcome email as pending (sent on completion or abandonment)
        await event.data?.ref.update({
          welcomeEmailPending: true,
          welcomeEmailPendingAt: Date.now(),
        });
      }
    } catch (error) {
      logger.error("Welcome email function error:", error);
    }
  }
);
```

**Key changes**:
- No immediate welcome email for personal signups
- Immediate email only for "signup for other"
- Track `welcomeEmailPending` for later triggers

---

### 3.2 Add Completion Email Trigger

**Create new callable function** in `functions/src/callable.ts`:
```typescript
export const sendCompletionEmail = onCall({ cors: true }, async (request) => {
  const { email, sessionId } = request.data;

  if (!email || !sessionId) {
    throw new HttpsError('invalid-argument', 'Email and sessionId required');
  }

  const db = admin.firestore();

  // Get profile to verify completion
  const profileRef = db.collection('profiles').doc(sessionId);
  const profileSnap = await profileRef.get();

  if (!profileSnap.exists) {
    throw new HttpsError('not-found', 'Profile not found');
  }

  const profile = profileSnap.data();

  // Only send if onboarded and hasn't been sent yet
  if (!profile.onboarded || profile.welcomeEmailSent) {
    return { success: false, message: 'Already sent or not onboarded' };
  }

  // Get location
  const locationInfo = await getLocationFromPostcode(profile.postcode);
  const locationString = locationInfo
    ? formatLocation(locationInfo.city, locationInfo.stateCode)
    : profile.postcode;

  // Send welcome-completed email
  const emailTemplate = {
    to: email.toLowerCase(),
    templateId: EMAIL_TEMPLATES.WELCOME_COMPLETED,
    variables: {
      location: locationString
    }
  };

  const success = await EmailService.sendTemplateEmail(emailTemplate);

  if (success) {
    // Update profile
    await profileRef.update({
      welcomeEmailSent: true,
      welcomeEmailSentAt: Date.now(),
    });

    // Update lead if exists
    const leadQuery = db.collection('leads')
      .where('email', '==', email.toLowerCase())
      .limit(1);
    const leadSnap = await leadQuery.get();

    if (!leadSnap.empty) {
      await leadSnap.docs[0].ref.update({
        welcomeEmailSent: true,
        welcomeEmailSentAt: Date.now(),
        welcomeEmailPending: false,
      });
    }
  }

  return { success };
});
```

**Export** in `functions/src/index.ts`:
```typescript
export { sendMagicLink, sendCompletionEmail } from './callable';
```

**Trigger from frontend** in `components/UserChatInterface.tsx` after line 209:
```typescript
// After profile update when onboarding completes
Promise.all([
  db.updateProfile(sessionId, profileUpdates),
  db.addMessage({
    session_id: sessionId,
    role: Role.AGENT,
    content: result.message
  })
]).then(async () => {
  // Trigger completion email if applicable
  if (isOnboardingComplete && currentProfile?.email) {
    try {
      const sendCompletionEmailFn = httpsCallable(functions, 'sendCompletionEmail');
      await sendCompletionEmailFn({
        email: currentProfile.email,
        sessionId: sessionId
      });
    } catch (error) {
      console.error('Error sending completion email:', error);
      // Don't block UI - email is background task
    }
  }
}).catch(err => console.error('Background save failed:', err));
```

---

### 3.3 Add Abandonment Recovery Scheduler

**File**: `functions/src/index.ts`

**Add new scheduled function**:
```typescript
export const sendAbandonedOnboardingEmails = onSchedule(
  {
    schedule: "0 8-20 * * *", // Hourly from 8am-8pm
    timeZone: "America/New_York", // Eastern Time
    region: "us-central1",
  },
  async () => {
    try {
      logger.info("🕐 Starting abandonment recovery job");

      const db = admin.firestore();
      const now = Date.now();
      const oneHourAgo = now - (60 * 60 * 1000);

      // Find profiles that haven't completed and were last updated > 1hr ago
      const profilesQuery = db.collection("profiles")
        .where("onboarded", "==", false)
        .where("last_updated", "<=", oneHourAgo)
        .limit(50); // Process in batches

      const snapshot = await profilesQuery.get();

      if (snapshot.empty) {
        logger.info("No profiles found for abandonment recovery");
        return;
      }

      logger.info(`📊 Processing ${snapshot.size} profiles`);

      let emailsSent = 0;
      let emailsSkipped = 0;

      for (const doc of snapshot.docs) {
        const profile = doc.data();

        // Skip if no email, already sent abandonment/welcome email, or no session
        if (!profile.email || profile.abandonment_sent ||
            profile.welcomeEmailSent || !profile.session_id) {
          emailsSkipped++;
          continue;
        }

        try {
          // Generate magic link
          const magicLink = `https://dadcircles.com/chat?session=${profile.session_id}`;

          // Get location
          const locationInfo = await getLocationFromPostcode(profile.postcode);
          const locationString = locationInfo
            ? formatLocation(locationInfo.city, locationInfo.stateCode)
            : profile.postcode;

          // Send welcome-abandoned email
          const emailTemplate = {
            to: profile.email,
            templateId: EMAIL_TEMPLATES.WELCOME_ABANDONED,
            variables: {
              location: locationString,
              chat_link: magicLink
            }
          };

          const success = await EmailService.sendTemplateEmail(emailTemplate);

          if (success) {
            await doc.ref.update({
              abandonment_sent: true,
              abandonment_sent_at: Date.now(),
            });

            emailsSent++;

            logger.info("✅ Abandonment email sent", {
              session_id: profile.session_id,
              email: profile.email,
            });
          }
        } catch (error) {
          logger.error("❌ Error sending abandonment email", {
            session_id: profile.session_id,
            error: error instanceof Error ? error.message : 'Unknown',
          });
        }
      }

      logger.info("📬 Job completed", { emailsSent, emailsSkipped });
    } catch (error) {
      logger.error("❌ Abandonment recovery job error:", error);
    }
  }
);
```

**Add imports** at top of `functions/src/index.ts`:
```typescript
import { getLocationFromPostcode, formatLocation } from './utils/location';
```

---

## Data Model Updates

### Profile Collection

**New fields**:
- `welcomeEmailSent?: boolean` - Completion email sent
- `welcomeEmailSentAt?: number` - Timestamp
- `abandonment_sent?: boolean` - Recovery email sent
- `abandonment_sent_at?: number` - Timestamp

### Lead Collection

**New fields**:
- `signupOtherEmailSent?: boolean` - Immediate email for "signup for other"
- `signupOtherEmailSentAt?: number` - Timestamp
- `welcomeEmailPending?: boolean` - Waiting for completion/abandonment
- `welcomeEmailPendingAt?: number` - Timestamp

---

## Critical Files Modified

1. `components/LandingPage.tsx` - UUID session generation, duplicate email handling
2. `functions/src/callable.ts` - sendMagicLink, sendCompletionEmail (new file)
3. `functions/src/emailService.ts` - sendTemplateEmail method, template constants
4. `functions/src/index.ts` - Welcome email logic, abandonment scheduler, exports
5. `components/UserChatInterface.tsx` - Completion email trigger

---

## Testing & Verification

### Phase 1 Testing
1. **UUID generation**: Create new session, verify format is valid UUID
2. **Duplicate signup**: Try signing up with existing email, verify magic link email sent
3. **Magic link**: Click link from email, verify session resumes correctly

### Phase 2 Testing
1. **Template simulation**: Verify console logs show template ID and variables
2. **Location lookup**: Test with valid postcode, verify "City, State" format
3. **Location fallback**: Mock API failure, verify fallback to postcode

### Phase 3 Testing
1. **Signup for other**: Complete form with checkbox, verify immediate email
2. **Complete onboarding**: Finish full flow, verify welcome-completed email
3. **Abandon onboarding**: Start and abandon, wait 1 hour, verify recovery email
4. **No double emails**: Complete before scheduler runs, verify only one email sent

### End-to-End Flow
1. New user signs up → no immediate email
2. User completes onboarding → welcome-completed email sent
3. New user signs up → abandons for 1+ hour → recovery email sent
4. User tries duplicate signup → magic link email sent

---

## Edge Cases & Mitigations

**Issue**: Race condition - completion email + abandonment email
**Solution**: Scheduler checks `welcomeEmailSent != true`

**Issue**: Location API failure
**Solution**: Graceful fallback to postcode in all email functions

**Issue**: Existing sessions using old format
**Solution**: Both UUID and old format work (session_id is just document ID)

**Issue**: Resend template syntax unknown
**Action**: Verify Resend SDK docs before implementing Phase 2

---

## Rollback Plan

**Phase 1**: Revert LandingPage.tsx to Math.random(), disable sendMagicLink
**Phase 2**: Revert emailService.ts, use inline HTML methods
**Phase 3**: Disable scheduler, re-enable immediate welcome emails

All phases are additive - can rollback without data loss.

---

## MVP Recommendations

### Implement Now
✅ All 3 phases - core security and user experience improvements

### Defer Post-MVP
❌ Email open tracking (nice-to-have analytics)
❌ A/B testing templates (optimize after launch)
❌ Unsubscribe management (add when user base grows)
❌ Multi-timezone support (ET is fine for US MVP)

### Potential Rabbit Hole
⚠️ Location API - If unreliable, just use postcode in emails (simpler, still functional)
