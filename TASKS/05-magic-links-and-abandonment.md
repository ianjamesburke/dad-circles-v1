# Task 05: Magic Links & Abandonment Trigger

Implementation of secure Magic Links and automated abandonment recovery.

## 1. Secure Session IDs
- **File:** `components/LandingPage.tsx`
- **Change:** Replace `Math.random()` with `crypto.randomUUID()`.
- **Security:** Guarantees unguessable session tokens (UUID v4).

## 2. Magic Link "Resend" Logic
- **Goal:** Prevent session exposure while allowing legitimate users to resume.
- **Frontend:** `LandingPage.tsx` will trigger a Cloud Function if a duplicate email is found.
- **Backend:** New `sendMagicLink` callable function.
- **Privacy:** User A cannot see User B's session. User B receives an email to resume.

## 3. Abandonment Trigger (Scheduled)
- **Goal:** Automated recovery for drop-offs.
- **Schedule:** Hourly from 8am to 8pm ET (`America/New_York`).
- **Query:** Find `onboarded: false` where `last_updated` > 1 hour ago and `abandonment_sent: false`.
- **Action:** Send re-engagement email with the Magic Link.

## 4. Email Templates (Resend)
- **Template 1:** "Resume your session" (Triggered by Landing Page).
- **Template 2:** "Finish your onboarding" (Triggered by abandonment job).
