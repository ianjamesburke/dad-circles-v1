import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { logger } from "./logger";
import * as admin from 'firebase-admin';
import { FieldValue } from "firebase-admin/firestore";
import { EmailService, EMAIL_TEMPLATES } from './emailService';
import { getLocationFromPostcode, formatLocation } from './utils/location';
import { generateMagicLink } from "./utils/link";
import { runMatchingAlgorithm, seedTestData, approveAndEmailGroup, deleteGroup as deleteGroupLogic } from "./matching";

// Define secrets for callable functions
const resendApiKey = defineSecret("RESEND_API_KEY");
const defaultFromEmail = defineSecret("DEFAULT_FROM_EMAIL");
const sendRealEmails = defineSecret("SEND_REAL_EMAILS");

/**
 * Callable function to run the matching algorithm
 * Can be called from the Admin Dashboard
 */
export const runMatching = onCall({ cors: true }, async (request) => {
    // Stricter admin auth check
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'The function must be called while authenticated.');
    }

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

  // Only send if profile has session
  if (!profile.session_id) {
    return { success: true };
  }

  // Generate magic link
        const magicLink = generateMagicLink(profile.session_id);

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
      welcomeEmailSentAt: FieldValue.serverTimestamp(),
    });

    // Update lead if exists
    const leadQuery = db.collection('leads')
      .where('email', '==', email.toLowerCase())
      .limit(1);
    const leadSnap = await leadQuery.get();

    if (!leadSnap.empty) {
      await leadSnap.docs[0].ref.update({
        welcomeEmailSent: true,
        welcomeEmailSentAt: FieldValue.serverTimestamp(),
        welcomeEmailPending: false,
      });
    }
  }

  return { success };
});

/**
 * Callable function to seed test data
 * ONLY works in development/emulator environment or if explicitly allowed
 */
export const seedData = onCall({ cors: true }, async (request) => {
    // Stricter admin auth check
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'The function must be called while authenticated.');
    }

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
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'The function must be called while authenticated.');
    }

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
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'The function must be called while authenticated.');
    }

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
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'The function must be called while authenticated.');
    }

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
        const magicLink = generateMagicLink(profile.session_id);

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
                magic_link: magicLink
            }
        };

        const success = await EmailService.sendTemplateEmail(emailTemplate);

        if (success) {
            await profileRef.update({
                abandonment_sent: true,
                abandonment_sent_at: Date.now(),
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
