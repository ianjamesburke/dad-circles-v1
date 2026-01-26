# Email System Migration Plan: Resend Templates

## Overview
This plan details the migration from inline HTML emails to Resend template-based emails while maintaining the excellent email simulation console logs. The migration includes logic changes for welcome emails, secure magic link implementation, and removes hard-coded API keys.

---

## Email Flow Summary 🆕

### 1. **Signup (Not for Someone Else)**
- User signs up with email + postcode
- Creates profile with UUID session: `crypto.randomUUID()`
- Navigates directly to chat: `/chat?session={UUID}`
- No immediate email sent

### 2. **Signup (For Someone Else)**
- User checks "I'm signing up for someone else"
- Creates lead WITHOUT session_id
- **Immediate email:** `signup-other` template
  - Explains what DadCircles is
  - Encourages forwarding to friend
  - Links to landing page
- User stays on landing page (doesn't navigate to chat)

### 3. **Duplicate Email Detection (NEW)**
- User tries to sign up with existing email
- Frontend detects duplicate
- Shows message: "Check your inbox - we've sent you a link to continue"
- **Triggers Cloud Function:** `sendMagicLink`
- **Email sent:** `resume-session` template
  - Contains secure magic link: `/chat?session={UUID}`
  - Prevents session exposure in frontend
  - Security: Only email owner can resume session

### 4. **Onboarding Completion**
- User completes onboarding (reaches FAQ mode)
- Profile updated: `onboarded: true`, `onboarding_step: COMPLETE`
- **Email sent:** `welcome-completed` template
  - Welcomes to community
  - Explains matching process
  - Shows location (City, State)

### 5. **Abandonment Recovery (Hourly)**
- **Schedule:** Every hour, 8am-8pm ET
- **Triggers for:** Profiles where:
  - `onboarded: false`
  - `last_updated > 1 hour ago`
  - `abandonment_sent: false`
- **Email sent:** `welcome-abandoned` template
  - Contains magic link to resume
  - Encourages completion
  - Shows location context

### 6. **3-Day Follow-up**
- Existing logic (unchanged)
- **Email sent:** `followup-3day` template
  - Progress update
  - Community building status

### 7. **Group Introduction**
- When groups are approved
- **Email sent:** `group-intro` template
  - Meet your group members
  - Reply-all to introduce yourself

---

## Phase 1: Setup & Configuration

### 1.1 Resend Template Setup ✅ COMPLETED
**Goal:** Create and publish all email templates in Resend dashboard

**Templates Created via API (UPDATED with location instead of postcode):**

1. **Welcome Email (Form Completed)** - `welcome-completed`
   - Template ID: `581857a1-c2d1-447e-b9a3-027c9686a844` (updated)
   - Variables: `{{{location}}}` (e.g., "Austin, TX")
   - Subject: "Welcome to DadCircles! 🎉"
   - From: Circle <circle@mail.dadcircles.com>
   - Status: ✅ Created & Updated

2. **Welcome Email (Form Abandoned)** - `welcome-abandoned`
   - Template ID: `a7bf64bb-16d9-4f6d-901f-d03390343678` (updated)
   - Variables: `{{{location}}}`, `{{{chat_link}}}` (magic link)
   - Subject: "Finish setting up your DadCircles profile"
   - From: Circle <circle@mail.dadcircles.com>
   - Use Case: Automated abandonment recovery (hourly job for 1hr+ dropoffs)
   - Status: ✅ Created & Updated

3. **Resume Session** - `resume-session` 🆕
   - Template ID: `995b6c14-d43b-4812-b2a2-b73ba520d9d9`
   - Variables: `{{{magic_link}}}`, `{{{location}}}`
   - Subject: "Your DadCircles session is ready to continue"
   - From: Circle <circle@mail.dadcircles.com>
   - Use Case: When duplicate email is detected on landing page
   - Security: Prevents session exposure, sends magic link via email
   - Status: ✅ Created

4. **Signup for Someone Else** - `signup-other`
   - Template ID: `d8f8d57b-157a-4789-a198-69a50264a415` (updated)
   - Variables: `{{{location}}}`
   - Subject: "Help a dad connect with his community"
   - From: Circle <circle@mail.dadcircles.com>
   - Messaging: ✅ Enhanced with "What is DadCircles?" explainer, forward encouragement, and Get Started CTA
   - Status: ✅ Created & Updated

5. **Follow-up Email (3 Days)** - `followup-3day`
   - Template ID: `75ff87d7-4f33-4feb-8dd0-037d8a4d2c7a` (updated)
   - Variables: `{{{location}}}`
   - Subject: "Building your local dad network in {{{location}}}"
   - From: Circle <circle@mail.dadcircles.com>
   - Status: ✅ Created & Updated

6. **Group Introduction** - `group-intro`
   - Template ID: `a5bc8d61-234d-4bb8-9f16-206a803aa51f`
   - Variables: `{{{group_name}}}`, `{{{members_list}}}` (HTML list)
   - Subject: "Meet Your DadCircles Group: {{{group_name}}}"
   - From: Circle <circle@mail.dadcircles.com>
   - Status: ✅ Created (no location needed)

**Location Utility Added:**
- Created `functions/src/utils/location.ts` with `getLocationFromPostcode()` function
- Converts zip codes to "City, State" format (e.g., "49506" → "Grand Rapids, MI")
- Shared between frontend and Cloud Functions
- Includes `formatLocation()` helper for consistent formatting

**Actions:**
- [x] Create templates in Resend dashboard via API
- [x] Update all templates to use location (city, state) instead of postcode
- [x] Add location utility to Cloud Functions
- [x] Enhanced signup-other template with better messaging
- [ ] Test each template with sample data (next step: send test emails)
- [ ] Publish all templates in Resend dashboard
- [x] Document template IDs for use in code

---

## Phase 2: Email Service Refactor

### 2.1 Update EmailService Interface
**Goal:** Support both template-based and simulation modes

**File:** `functions/src/emailService.ts`

**Changes:**

1. Add new interface for template emails:
```typescript
export interface TemplateEmail {
  to: string;
  templateId: string;
  variables: Record<string, string | number>;
  from?: string;
}
```

2. Add template constants with UPDATED IDs:
```typescript
export const EMAIL_TEMPLATES = {
  WELCOME_COMPLETED: '581857a1-c2d1-447e-b9a3-027c9686a844',
  WELCOME_ABANDONED: 'a7bf64bb-16d9-4f6d-901f-d03390343678',
  RESUME_SESSION: '995b6c14-d43b-4812-b2a2-b73ba520d9d9', // NEW
  SIGNUP_OTHER: 'd8f8d57b-157a-4789-a198-69a50264a415',
  FOLLOWUP_3DAY: '75ff87d7-4f33-4feb-8dd0-037d8a4d2c7a',
  GROUP_INTRO: 'a5bc8d61-234d-4bb8-9f16-206a803aa51f',
} as const;

// Or use friendly names and map to IDs:
export const EMAIL_TEMPLATE_NAMES = {
  WELCOME_COMPLETED: 'welcome-completed',
  WELCOME_ABANDONED: 'welcome-abandoned',
  RESUME_SESSION: 'resume-session', // NEW
  SIGNUP_OTHER: 'signup-other',
  FOLLOWUP_3DAY: 'followup-3day',
  GROUP_INTRO: 'group-intro',
} as const;
```

3. Create new `sendTemplateEmail` method:
```typescript
static async sendTemplateEmail(
  template: TemplateEmail,
  forceSimulation?: boolean
): Promise<boolean>
```

4. Update simulation logging to show template info:
```typescript
// Enhance console log to show:
// - Template ID
// - Variables being passed
// - Rendered preview (if possible)
```

**Actions:**
- [ ] Add new interfaces and constants
- [ ] Implement `sendTemplateEmail` method
- [ ] Enhance simulation logs for templates
- [ ] Keep existing `sendEmail` method for backward compatibility (during migration)
- [ ] Test simulation mode with template data

### 2.2 Resend API Integration
**Goal:** Update Resend SDK calls to use templates

**Implementation:**
```typescript
// Instead of:
await resend.emails.send({
  from: from,
  to: template.to,
  subject: template.subject,
  html: template.html,
});

// Use:
await resend.emails.send({
  from: from,
  to: templateEmail.to,
  react: templateEmail.templateId,  // or however Resend SDK handles templates
  // Check Resend SDK docs for exact syntax
});
```

**Actions:**
- [ ] Check Resend SDK documentation for template syntax
- [ ] Update API calls to use templates
- [ ] Test with actual Resend API
- [ ] Verify template variables are passed correctly

### 2.3 Location Variable Processing ✅ COMPLETED
**Goal:** Convert postcodes to "City, State" format for emails

**Implementation:**
```typescript
// In Cloud Functions, before sending emails:
import { getLocationFromPostcode, formatLocation } from './utils/location';

// Example usage:
const locationInfo = await getLocationFromPostcode(postcode);
const locationString = locationInfo
  ? formatLocation(locationInfo.city, locationInfo.stateCode)
  : postcode; // Fallback to postcode if lookup fails

// Then pass to email template:
const emailTemplate = {
  to: email,
  templateId: EMAIL_TEMPLATES.WELCOME_COMPLETED,
  variables: {
    location: locationString  // "Grand Rapids, MI" instead of "49506"
  }
};
```

**Benefits:**
- More professional and readable emails
- Better geographic context for users
- Consistent location formatting across all emails
- Falls back gracefully to postcode if API lookup fails

**Actions:**
- [x] Create shared location utility in `functions/src/utils/location.ts`
- [x] Update all email templates to use `{{{location}}}` variable
- [ ] Update email sending code to call `getLocationFromPostcode` before sending
- [ ] Add error handling for location lookup failures

---

## Phase 2.5: Magic Links & Security 🆕

### 2.5.1 Secure Session ID Generation
**Goal:** Use cryptographically secure UUIDs instead of Math.random()

**File:** `components/LandingPage.tsx`

**Current Code:**
```typescript
sessionId = `user-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
```

**New Code:**
```typescript
sessionId = crypto.randomUUID(); // e.g., "550e8400-e29b-41d4-a716-446655440000"
```

**Why:**
- `Math.random()` is predictable and can be guessed
- UUIDs are cryptographically secure and unguessable
- Prevents unauthorized session access
- No need for custom prefix - UUIDs are already unique

**Actions:**
- [ ] Replace `Math.random()` with `crypto.randomUUID()` in LandingPage.tsx
- [ ] Update session URL format to use plain UUID
- [ ] Test session links still work correctly

### 2.5.2 Magic Link Format
**Standard:** All session links use the format:
```
https://dadcircles.com/chat?session={UUID}
```

**Example:**
```
https://dadcircles.com/chat?session=550e8400-e29b-41d4-a716-446655440000
```

### 2.5.3 Duplicate Email Detection Flow
**Goal:** Prevent session exposure when users try to sign up with existing email

**Current Behavior (INSECURE):**
- User tries to sign up with existing email
- Frontend shows error: "Email already used"
- Problem: Could expose other user's session

**New Behavior (SECURE):**

**Frontend:** `components/LandingPage.tsx`
```typescript
// When duplicate email detected:
if (existingLead && existingLead.session_id && !signupForOther) {
  // Don't show session link directly!
  // Instead: trigger Cloud Function to send magic link

  setErrorMessage(
    "We found an existing account with this email. Check your inbox - we've sent you a link to continue your session."
  );

  // Call Cloud Function
  const sendMagicLinkFn = httpsCallable(functions, 'sendMagicLink');
  await sendMagicLinkFn({ email: email.toLowerCase() });

  setIsSubmitting(false);
  return;
}
```

**Backend:** New Cloud Function `functions/src/callable.ts`
```typescript
export const sendMagicLink = onCall(async (request) => {
  const { email } = request.data;

  // Find lead by email
  const lead = await getLeadByEmail(email);
  if (!lead || !lead.session_id) {
    return { success: false, message: "No session found" };
  }

  // Generate magic link
  const magicLink = `https://dadcircles.com/chat?session=${lead.session_id}`;

  // Get location
  const locationInfo = await getLocationFromPostcode(lead.postcode);
  const locationString = locationInfo
    ? formatLocation(locationInfo.city, locationInfo.stateCode)
    : lead.postcode;

  // Send resume-session email
  const emailTemplate = {
    to: email,
    templateId: EMAIL_TEMPLATES.RESUME_SESSION,
    variables: {
      magic_link: magicLink,
      location: locationString
    }
  };

  await EmailService.sendTemplateEmail(emailTemplate);

  return { success: true };
});
```

**Security Benefits:**
- User A cannot see User B's session
- Magic link sent privately via email
- Only the email owner can resume the session
- No session leakage in frontend errors

**Actions:**
- [ ] Add `sendMagicLink` callable function
- [ ] Update LandingPage.tsx duplicate email handling
- [ ] Test duplicate email flow
- [ ] Verify magic links work correctly

---

## Phase 3: Welcome Email Logic Changes

### 3.1 Remove Immediate Welcome Email
**Goal:** Stop sending welcome email on lead creation

**File:** `functions/src/index.ts`

**Current Behavior:**
- `sendWelcomeEmail` function triggers on lead document creation
- Sends email immediately

**New Behavior:**
- Remove automatic email sending from `sendWelcomeEmail`
- Only track that lead was created
- Mark `welcomeEmailPending: true` instead of sending

**Changes:**
```typescript
export const sendWelcomeEmail = onDocumentCreated(
  { document: "leads/{leadId}", region: "us-central1" },
  async (event) => {
    const leadData = event.data?.data();

    // If signing up for someone else, send immediate email
    if (leadData.signupForOther) {
      // Send "signup-other" template
      const emailTemplate = {
        to: leadData.email,
        templateId: EMAIL_TEMPLATES.SIGNUP_OTHER,
        variables: { postcode: leadData.postcode }
      };
      await EmailService.sendTemplateEmail(emailTemplate);

      await event.data?.ref.update({
        signupOtherEmailSent: true,
        signupOtherEmailSentAt: Date.now(),
      });
    } else {
      // Mark welcome email as pending (will be sent on completion or timeout)
      await event.data?.ref.update({
        welcomeEmailPending: true,
        welcomeEmailPendingAt: Date.now(),
      });
    }
  }
);
```

**Actions:**
- [ ] Update `sendWelcomeEmail` function
- [ ] Add `signupForOther` email template sending
- [ ] Add `welcomeEmailPending` tracking
- [ ] Test both signup flows

### 3.2 Add Onboarding Completion Email
**Goal:** Send welcome email when user enters FAQ mode

**File:** `api/chat.ts` or wherever profile updates happen after chat

**Trigger:** When profile is updated with:
- `onboarding_step === OnboardingStep.COMPLETE`
- `onboarded === true`
- `welcomeEmailPending === true` (hasn't been sent yet)

**Implementation:**
```typescript
// After profile update in chat API
if (profile.onboarding_step === OnboardingStep.COMPLETE &&
    profile.onboarded &&
    !profile.welcomeEmailSent) {

  // Get lead document
  const lead = await database.getLeadByEmail(profile.email);

  if (lead && lead.welcomeEmailPending) {
    // Send welcome-completed email via Cloud Function or directly
    // Option 1: Call a Cloud Function
    // Option 2: Send directly from chat API (less ideal)

    // Mark as sent
    await database.updateLead(lead.id, {
      welcomeEmailSent: true,
      welcomeEmailSentAt: Date.now(),
      welcomeEmailPending: false,
    });
  }
}
```

**Considerations:**
- Should we trigger a Cloud Function or send directly from chat API?
- Need to ensure lead document is linked to profile (already done via `session_id`)

**Actions:**
- [ ] Identify best place to trigger completion email
- [ ] Implement completion detection logic
- [ ] Send `welcome-completed` template
- [ ] Update lead document tracking fields
- [ ] Test with completed onboarding flow

### 3.3 Add Abandonment Recovery Email (Hourly Schedule)
**Goal:** Send re-engagement email to users who abandoned onboarding

**File:** `functions/src/index.ts`

**Schedule:** Hourly from 8am to 8pm Eastern Time (respect user timezones)

**New Cloud Function:**
```typescript
export const sendAbandonedOnboardingEmails = onSchedule(
  {
    schedule: "0 8-20 * * *", // Hourly from 8am-8pm
    timeZone: "America/New_York", // Eastern Time
    region: "us-central1",
  },
  async () => {
    const db = admin.firestore();
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000); // 1 hour

    // Find leads/profiles that:
    // - Have onboarded: false (not completed)
    // - last_updated > 1 hour ago
    // - abandonment_sent: false (haven't received this email yet)
    // - Didn't sign up for someone else

    const profilesQuery = db.collection("profiles")
      .where("onboarded", "==", false)
      .where("last_updated", "<=", oneHourAgo)
      .where("abandonment_sent", "!=", true)
      .limit(50);

    const snapshot = await profilesQuery.get();

    for (const doc of snapshot.docs) {
      const profile = doc.data();

      // Skip if no email
      if (!profile.email) continue;

      // Generate magic link with UUID session
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
          chat_link: magicLink // Secure UUID-based magic link
        }
      };

      await EmailService.sendTemplateEmail(emailTemplate);

      // Mark as sent (update profile, not lead)
      await doc.ref.update({
        abandonment_sent: true,
        abandonment_sent_at: Date.now(),
      });

      logger.info("Abandonment email sent", {
        session_id: profile.session_id,
        email: profile.email
      });
    }
  }
);
```

**Key Changes from Original Plan:**
- **Schedule:** Hourly (8am-8pm ET) instead of every 5 minutes
- **Threshold:** 1 hour instead of 10 minutes
- **Data Source:** Query `profiles` collection instead of `leads`
- **Tracking:** Use `abandonment_sent` field on profile
- **Timezone Aware:** Respects Eastern Time for sending hours
- **Magic Links:** Uses secure UUID-based session IDs

**Actions:**
- [ ] Create scheduled function for abandoned emails
- [ ] Add query for profiles with `onboarded: false` and `last_updated` > 1 hour
- [ ] Generate secure magic links with UUIDs
- [ ] Send `welcome-abandoned` template with location
- [ ] Test hourly schedule
- [ ] Verify emails stop after onboarding completion

---

## Phase 4: Follow-up & Group Emails

### 4.1 Update Follow-up Email to Use Templates
**Goal:** Replace inline HTML with template

**File:** `functions/src/index.ts` - `sendFollowUpEmails` function

**Changes:**
```typescript
// Replace:
const emailTemplate = EmailService.generateFollowUpEmail(email, postcode);
const success = await EmailService.sendEmail(emailTemplate);

// With:
const emailTemplate = {
  to: email,
  templateId: EMAIL_TEMPLATES.FOLLOWUP_3DAY,
  variables: { postcode }
};
const success = await EmailService.sendTemplateEmail(emailTemplate);
```

**Actions:**
- [ ] Update `sendFollowUpEmails` function
- [ ] Replace inline HTML with template call
- [ ] Test scheduled function
- [ ] Verify 3-day timing works correctly

### 4.2 Update Group Introduction Emails
**Goal:** Use templates for group introduction emails

**File:** `functions/src/emailService.ts`

**Changes:**
```typescript
// In sendGroupIntroductionEmail method:
// Instead of generating HTML inline, use template:

const membersListHtml = members
  .map(m => `<li><strong>${m.name}</strong> - ${m.childInfo}</li>`)
  .join('');

const emailTemplate = {
  to: member.email,
  templateId: EMAIL_TEMPLATES.GROUP_INTRO,
  variables: {
    group_name: groupName,
    members_list: membersListHtml,
  }
};

await EmailService.sendTemplateEmail(emailTemplate, testMode);
```

**Actions:**
- [ ] Update group introduction email sending
- [ ] Generate members list as HTML string for template variable
- [ ] Test with simulated group
- [ ] Verify all members receive emails

---

## Phase 5: Testing & Validation

### 5.1 Simulation Testing
**Goal:** Verify email simulation still works beautifully

**Test Cases:**
1. [ ] Landing page signup (not for someone else)
   - Should show pending welcome email
   - Should NOT send immediate email

2. [ ] Landing page signup (for someone else)
   - Should show immediate "signup-other" simulation

3. [ ] Complete onboarding flow
   - Should show "welcome-completed" simulation
   - Should happen when FAQ mode is entered

4. [ ] Abandon onboarding (wait 10+ minutes)
   - Should show "welcome-abandoned" simulation
   - Should include chat continuation link

5. [ ] 3-day follow-up
   - Should show "followup-3day" simulation

6. [ ] Group introduction
   - Should show "group-intro" simulation for each member

**Actions:**
- [ ] Run all test cases in emulator mode
- [ ] Verify console logs are still beautiful
- [ ] Check all template variables appear correctly
- [ ] Validate email tracking fields in Firestore

### 5.2 Production Testing
**Goal:** Verify real emails send correctly

**Test Cases:**
1. [ ] Send test email for each template via Resend API
2. [ ] Verify formatting looks correct in email clients
3. [ ] Check all variables render properly
4. [ ] Test unsubscribe links (if applicable)
5. [ ] Verify "From" address shows correctly

**Actions:**
- [ ] Create test accounts
- [ ] Send real test emails
- [ ] Review in multiple email clients (Gmail, Apple Mail, Outlook)
- [ ] Verify deliverability

---

## Phase 6: Cleanup & Documentation

### 6.1 Remove Old Code
**Goal:** Clean up deprecated email generation methods

**Files to Update:**
- `functions/src/emailService.ts`

**Actions:**
- [ ] Remove `generateWelcomeEmail` method (or mark deprecated)
- [ ] Remove `generateFollowUpEmail` method (or mark deprecated)
- [ ] Remove `generateGroupIntroductionEmail` method (or mark deprecated)
- [ ] Remove old `EmailTemplate` interface if no longer used
- [ ] Keep `sendEmail` method only if still needed elsewhere

### 6.2 Update Documentation
**Goal:** Document new email system

**Files to Update:**
- `AGENTS.md` - Update email service section
- `EMAIL_MIGRATION_PLAN.md` - Mark as completed, keep for reference

**Documentation to Add:**
1. How to create new email templates in Resend
2. How to trigger emails from code
3. Email simulation process
4. Troubleshooting guide

**Actions:**
- [ ] Update AGENTS.md with new email flow
- [ ] Document template creation process
- [ ] Add troubleshooting section
- [ ] Update architecture diagram (if exists)

---

## Database Schema Changes

### Profile Document Updates (Primary)
**New Fields:**
```typescript
interface UserProfile {
  // Existing fields...
  session_id: string;                   // Now uses crypto.randomUUID() instead of Math.random()

  // New fields for abandonment tracking:
  abandonment_sent?: boolean;           // True if abandonment email was sent
  abandonment_sent_at?: number;         // Timestamp when abandonment email sent
}
```

### Lead Document Updates (Secondary)
**New Fields:**
```typescript
interface Lead {
  // Existing fields...
  session_id?: string;                  // Links to profile (if not signup for other)

  // New fields for signup-other flow:
  signupOtherEmailSent?: boolean;       // True if "signup for other" email sent
  signupOtherEmailSentAt?: number;      // Timestamp
}
```

**Note:** The original plan tracked welcome emails on the Lead document, but for abandonment recovery we track on the Profile document since that's where `onboarded` and `last_updated` fields live.

---

## Implementation Checklist

### Phase 1: Setup
- [x] Create all Resend templates (via API)
- [x] Create resume-session template for magic links
- [ ] Test templates with sample data (send test emails from Resend dashboard)
- [ ] Publish templates (in Resend dashboard)
- [ ] Remove hard-coded API keys (if any found)
- [ ] Verify environment variables

### Phase 2: Email Service & Magic Links
- [ ] Add template interfaces
- [ ] Implement `sendTemplateEmail` method
- [ ] Update simulation logging
- [ ] Test template sending
- [x] Create location utility for Cloud Functions
- [x] Update templates to use location instead of postcode
- [ ] Integrate location lookup into email sending
- [ ] Replace Math.random() with crypto.randomUUID() in LandingPage.tsx
- [ ] Create sendMagicLink callable function
- [ ] Update duplicate email detection flow
- [ ] Test magic link sending

### Phase 3: Welcome Email Logic
- [ ] Update lead creation handler
- [ ] Add "signup for other" immediate email
- [ ] Add onboarding completion email
- [ ] Add hourly abandonment recovery (8am-8pm ET, 1hr threshold)
- [ ] Test all flows (signup, duplicate email, abandonment, completion)

### Phase 4: Other Emails
- [ ] Update follow-up email
- [ ] Update group introduction email
- [ ] Test scheduled functions

### Phase 5: Testing
- [ ] Complete simulation testing
- [ ] Complete production testing
- [ ] Verify all email tracking works

### Phase 6: Cleanup
- [ ] Remove old code
- [ ] Update documentation
- [ ] Final review

---

## Rollback Plan

If issues arise during migration:

1. **Phase 1-2 Issues:**
   - Revert `emailService.ts` changes
   - Continue using inline HTML templates
   - Fix issues and retry

2. **Phase 3-4 Issues:**
   - Disable new Cloud Functions
   - Re-enable old immediate welcome email
   - Debug and fix issues

3. **Database Issues:**
   - New fields are additive (safe)
   - Old fields still exist (backward compatible)
   - Can safely rollback code without data loss

---

## Notes & Considerations

### Template Variables Syntax
- Resend uses triple braces: `{{{variable_name}}}`
- Variables are case-sensitive
- Can use strings or numbers
- Fallback values can be set in template dashboard

### Email Simulation
- Keep the beautiful console logs
- Add template ID to simulation output
- Show variables being passed
- Keep the visual dividers and formatting

### Performance
- Scheduled functions run every 5 minutes for abandoned emails
- Batch process max 50 leads at a time
- Follow-up emails run daily (existing schedule)

### Security
- Never expose session IDs in emails to wrong recipients
- Verify lead/profile associations before sending
- Ensure magic links are properly scoped

### Future Enhancements
- Add email preferences/unsubscribe management
- Track email open rates via Resend
- A/B test different email templates
- Add more personalization variables
