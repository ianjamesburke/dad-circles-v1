import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { logger } from "./logger";
import * as admin from 'firebase-admin';
import { FieldValue } from "firebase-admin/firestore";
import crypto from "crypto";
import { EmailService, EMAIL_TEMPLATES } from './emailService';
import { getLocationFromPostcode, formatLocation } from './utils/location';
import { generateMagicLink } from "./utils/link";
import { createMagicLinkToken, redeemMagicLinkToken } from "./utils/magicLink";
import { runMatchingAlgorithm, seedTestData, approveAndEmailGroup, deleteGroup as deleteGroupLogic } from "./matching";
import { RateLimiter } from "./rateLimiter";
import { maskEmail, maskPostcode } from "./utils/pii";

// Define secrets for callable functions
const resendApiKey = defineSecret("RESEND_API_KEY");
const defaultFromEmail = defineSecret("DEFAULT_FROM_EMAIL");
const sendRealEmails = defineSecret("SEND_REAL_EMAILS");

const isAdmin = (auth: any): boolean => !!auth?.token?.admin;

const requireAdmin = (request: any) => {
  if (!request.auth || !isAdmin(request.auth)) {
    throw new HttpsError('permission-denied', 'Admin privileges required.');
  }
};

const requireAuth = (request: any) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Authentication required.');
  }
};

/**
 * Callable function to run the matching algorithm
 * Can be called from the Admin Dashboard
 */
export const runMatching = onCall({ cors: true }, async (request) => {
    requireAdmin(request);

    // V1 Spec: Test mode concept removed, always false
    const testMode = false;
    logger.info("Run matching called", { uid: request.auth?.uid, testMode });

    try {
        const result = await runMatchingAlgorithm(undefined, undefined, testMode);
        return {
            success: true,
            result: result
        };
    } catch (error) {
        logger.error("Error in runMatching callable:", error);
        throw new HttpsError('internal', 'Matching algorithm failed', error);
    }
});

/**
 * Send a magic link to resume a session
 * Rate limited to prevent spam attacks
 */
export const sendMagicLink = onCall(
  {
    cors: true,
    secrets: [resendApiKey, defaultFromEmail, sendRealEmails],
  },
  async (request) => {
  const { email } = request.data;

  if (!email) {
    throw new HttpsError('invalid-argument', 'Email is required');
  }

  // Rate limit check - prevents spam attacks
  const rateLimitCheck = await RateLimiter.checkMagicLinkRequest(email);
  if (!rateLimitCheck.allowed) {
    logger.warn('Magic link request blocked by rate limiter', { 
      email: maskEmail(email.toLowerCase()) 
    });
    throw new HttpsError('resource-exhausted', rateLimitCheck.reason || 'Too many requests');
  }

  const db = admin.firestore();

  // Find profile by email
  const profileQuery = db.collection('profiles')
    .where('email', '==', email.toLowerCase())
    .limit(1);

  const snapshot = await profileQuery.get();

  if (snapshot.empty) {
    // Don't reveal whether email exists (prevent enumeration)
    // But still count against rate limit
    logger.info('Magic link requested for non-existent email', { 
      email: maskEmail(email.toLowerCase()) 
    });
    return { success: true };
  }

  const profile = snapshot.docs[0].data();

  // Only send if profile has session
  if (!profile.session_id) {
    logger.info('Magic link requested for profile without session', { 
      email: maskEmail(email.toLowerCase()) 
    });
    return { success: true };
  }

  // Generate one-time magic link token
  const token = await createMagicLinkToken(profile.session_id, email);
  const magicLink = generateMagicLink(token);

  // Get location string
  const locationInfo = await getLocationFromPostcode(profile.postcode);
  if (!locationInfo) {
    logger.warn("⚠️ Location lookup failed, using postcode fallback", {
      postcode: maskPostcode(profile.postcode),
      email: maskEmail(email.toLowerCase())
    });
  }
  const locationString = locationInfo
    ? formatLocation(locationInfo.city, locationInfo.stateCode, locationInfo.countryCode)
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

  logger.info('Magic link sent', { email: maskEmail(email.toLowerCase()) });

  return { success: true };
});

/**
 * Start a new session or send a magic link for an existing one.
 * This is the only entry point for the landing page.
 */
export const startSession = onCall(
  {
    cors: true,
    secrets: [resendApiKey, defaultFromEmail, sendRealEmails],
  },
  async (request) => {
    const { email, postcode } = request.data || {};
    const signupForOther = Boolean(request.data?.signupForOther);

    if (!email || !postcode) {
      throw new HttpsError('invalid-argument', 'Email and postcode are required');
    }

    const normalizedEmail = String(email).toLowerCase();
    const normalizedPostcode = String(postcode).trim();

    const db = admin.firestore();

    const leadQuery = db.collection('leads')
      .where('email', '==', normalizedEmail)
      .limit(1);
    const leadSnap = await leadQuery.get();
    const existingLead = leadSnap.empty ? undefined : leadSnap.docs[0];

    if (existingLead?.data()?.session_id && !signupForOther) {
      // Existing session - send magic link (rate limited)
      const rateLimitCheck = await RateLimiter.checkMagicLinkRequest(normalizedEmail);
      if (!rateLimitCheck.allowed) {
        logger.warn('Magic link request blocked by rate limiter', {
          email: maskEmail(normalizedEmail)
        });
        throw new HttpsError('resource-exhausted', rateLimitCheck.reason || 'Too many requests');
      }

      const sessionId = existingLead.data().session_id as string;
      const token = await createMagicLinkToken(sessionId, normalizedEmail);
      const magicLink = generateMagicLink(token);

      const locationInfo = await getLocationFromPostcode(existingLead.data().postcode || normalizedPostcode);
      const locationString = locationInfo
        ? formatLocation(locationInfo.city, locationInfo.stateCode, locationInfo.countryCode)
        : (existingLead.data().postcode || normalizedPostcode);

      await EmailService.sendTemplateEmail({
        to: normalizedEmail,
        templateId: EMAIL_TEMPLATES.RESUME_SESSION,
        variables: { magic_link: magicLink, location: locationString }
      });

      return { status: 'magic_link_sent' };
    }

    // New session flow (or signup for other)
    if (signupForOther) {
      await db.collection('leads').add({
        email: normalizedEmail,
        postcode: normalizedPostcode,
        signupForOther: true,
        source: 'landing_page',
        timestamp: FieldValue.serverTimestamp(),
      });
      return { status: 'signup_other_recorded' };
    }

    const sessionId = crypto.randomUUID();

    const leadData = {
      email: normalizedEmail,
      postcode: normalizedPostcode,
      signupForOther: false,
      session_id: sessionId,
      source: 'landing_page',
      timestamp: FieldValue.serverTimestamp(),
    };

    if (existingLead) {
      await existingLead.ref.set(leadData, { merge: true });
    } else {
      await db.collection('leads').add(leadData);
    }

    // Create profile
    await db.collection('profiles').doc(sessionId).set({
      session_id: sessionId,
      email: normalizedEmail,
      postcode: normalizedPostcode,
      onboarded: false,
      onboarding_step: 'welcome',
      children: [],
      last_updated: FieldValue.serverTimestamp(),
      matching_eligible: false,
    });

    // Create a Firebase custom auth token tied to the session ID
    const authToken = await admin.auth().createCustomToken(sessionId);

    return { status: 'session_created', sessionId, authToken };
  }
);

/**
 * Redeem a magic link token and return a custom auth token for the session.
 */
export const redeemMagicLink = onCall({ cors: true }, async (request) => {
  const { token } = request.data || {};
  if (!token) {
    throw new HttpsError('invalid-argument', 'Token is required');
  }

  try {
    const { sessionId } = await redeemMagicLinkToken(String(token));
    const authToken = await admin.auth().createCustomToken(sessionId);
    return { sessionId, authToken };
  } catch (error: any) {
    logger.warn('Magic link redemption failed', { error: error?.message });
    throw new HttpsError('failed-precondition', 'Magic link is invalid or expired');
  }
});

/**
 * Send completion email when user finishes onboarding
 */
export const sendCompletionEmail = onCall(
  {
    cors: true,
    secrets: [resendApiKey, defaultFromEmail, sendRealEmails],
  },
  async (request) => {
  const { email, sessionId } = request.data;

  requireAuth(request);
  if (!isAdmin(request.auth) && request.auth?.uid !== sessionId) {
    throw new HttpsError('permission-denied', 'Not authorized for this session');
  }

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

  if (!profile) {
    throw new HttpsError('not-found', 'Profile data missing');
  }

  // Only send if onboarded and hasn't been sent yet
  if (!profile.onboarded || profile.welcomeEmailSent) {
    return { success: false, message: 'Already sent or not onboarded' };
  }

  const targetEmail = profile.email || String(email).toLowerCase();
  if (!targetEmail) {
    throw new HttpsError('invalid-argument', 'Email missing on profile');
  }

  // Get location
  const locationInfo = await getLocationFromPostcode(profile.postcode);
  if (!locationInfo) {
    logger.warn("⚠️ Location lookup failed, using postcode fallback", {
      postcode: maskPostcode(profile.postcode),
      email: maskEmail(email.toLowerCase())
    });
  }
  const locationString = locationInfo
    ? formatLocation(locationInfo.city, locationInfo.stateCode, locationInfo.countryCode)
    : profile.postcode;

  // Send welcome-completed email
  const emailTemplate = {
    to: targetEmail,
    templateId: EMAIL_TEMPLATES.WELCOME_COMPLETED,
    variables: {
      location: locationString
    }
  };

  const success = await EmailService.sendTemplateEmail(emailTemplate);

  if (success) {
    // Use batch write for atomic updates to profile and lead
    const batch = db.batch();

    // Update profile
    batch.update(profileRef, {
      welcomeEmailSent: true,
      welcomeEmailSentAt: FieldValue.serverTimestamp(),
    });

    // Update lead if exists
    const leadQuery = db.collection('leads')
      .where('email', '==', targetEmail)
      .limit(1);
    const leadSnap = await leadQuery.get();

    if (!leadSnap.empty) {
      batch.update(leadSnap.docs[0].ref, {
        welcomeEmailSent: true,
        welcomeEmailSentAt: FieldValue.serverTimestamp(),
        welcomeEmailPending: false,
        last_communication_at: FieldValue.serverTimestamp(), // Track for follow-up emails
      });
    }

    // Commit all updates atomically
    await batch.commit();
  }

  return { success };
});

/**
 * Callable function to seed test data
 * ONLY works in development/emulator environment or if explicitly allowed
 */
export const seedData = onCall({ cors: true }, async (request) => {
    requireAdmin(request);

    logger.info("Seed data called", { uid: request.auth?.uid });

    try {
        await seedTestData();
        return { success: true, message: "Test data seeded successfully" };
    } catch (error) {
        logger.error("Error in seedData callable:", error);
        throw new HttpsError('internal', 'Seeding failed', error);
    }
});

/**
 * Callable function to approve a group and send emails
 */
export const approveGroup = onCall(
  {
    cors: true,
    secrets: [resendApiKey, defaultFromEmail, sendRealEmails],
  },
  async (request) => {
    requireAdmin(request);

    const { groupId } = request.data;
    if (!groupId) {
        throw new HttpsError('invalid-argument', 'groupId is required');
    }

    logger.info("Approve group called", { uid: request.auth?.uid, groupId });

    try {
        const result = await approveAndEmailGroup(groupId);
        return result;
    } catch (error) {
        logger.error("Error in approveGroup callable:", error);
        throw new HttpsError('internal', 'Group approval failed', error);
    }
});

/**
 * Callable function to delete a group
 */
export const deleteGroup = onCall({ cors: true }, async (request) => {
    requireAdmin(request);

    const { groupId } = request.data;
    if (!groupId) {
        throw new HttpsError('invalid-argument', 'groupId is required');
    }

    logger.info("Delete group called", { uid: request.auth?.uid, groupId });

    try {
        const result = await deleteGroupLogic(groupId);
        return result;
    } catch (error) {
        logger.error("Error in deleteGroup callable:", error);
        throw new HttpsError('internal', 'Group deletion failed', error);
    }
});

/**
 * Send an abandonment email manually from the admin dashboard
 */
export const sendManualAbandonmentEmail = onCall(
  {
    cors: true,
    secrets: [resendApiKey, defaultFromEmail, sendRealEmails],
  },
  async (request) => {
    requireAdmin(request);

    const { sessionId } = request.data;
    if (!sessionId) {
        throw new HttpsError('invalid-argument', 'sessionId is required');
    }

    logger.info("Manual abandonment email requested", { uid: request.auth?.uid, sessionId });

    const db = admin.firestore();
    const profileRef = db.collection('profiles').doc(sessionId);
    
    try {
        const profileSnap = await profileRef.get();

        if (!profileSnap.exists) {
            throw new HttpsError('not-found', 'Profile not found');
        }

        const profile = profileSnap.data();

        if (!profile) {
          throw new HttpsError('data-loss', 'Profile data is missing.');
        }

        // Pre-conditions for sending the email
        if (profile.onboarded) {
            return { success: false, message: 'User has already completed onboarding.' };
        }
        if (profile.welcomeEmailSent) {
            return { success: false, message: 'User has already received the completion email.' };
        }
        if (!profile.email) {
            return { success: false, message: 'User profile does not have an email address.' };
        }

        // Generate magic link
        const token = await createMagicLinkToken(profile.session_id, profile.email);
        const magicLink = generateMagicLink(token);

        // Get location
        const locationInfo = await getLocationFromPostcode(profile.postcode);
        if (!locationInfo) {
          logger.warn("⚠️ Location lookup failed, using postcode fallback", {
            postcode: maskPostcode(profile.postcode),
            sessionId: sessionId
          });
        }
        const locationString = locationInfo
            ? formatLocation(locationInfo.city, locationInfo.stateCode, locationInfo.countryCode)
            : profile.postcode;

        // Send welcome-abandoned email
        const emailTemplate = {
            to: profile.email,
            templateId: EMAIL_TEMPLATES.WELCOME_ABANDONED,
            variables: {
                location: locationString,
                magic_link: magicLink
            }
        };

        const success = await EmailService.sendTemplateEmail(emailTemplate);

        if (success) {
            await profileRef.update({
                abandonment_sent: true,
                abandonment_sent_at: FieldValue.serverTimestamp(),
            });
            logger.info("✅ Manual abandonment email sent successfully", { sessionId });
            return { success: true, message: 'Abandonment email sent successfully.' };
        } else {
            logger.error("❌ Failed to send manual abandonment email", { sessionId });
            throw new HttpsError('internal', 'Email service failed to send the email.');
        }
    } catch (error) {
        logger.error("Error in sendManualAbandonmentEmail callable:", error);
        if (error instanceof HttpsError) {
          throw error;
        }
        throw new HttpsError('internal', 'An unexpected error occurred.', error);
    }
});
