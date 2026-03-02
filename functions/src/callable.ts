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
import { runMatchingAlgorithm, seedTestData, approveAndEmailGroup, deleteGroup as deleteGroupLogic, sendGroupIntroductionEmails } from "./matching";
import { RateLimiter } from "./rateLimiter";
import { maskEmail, maskPostcode, maskIP } from "./utils/pii";
import { calculateGroupScore, getLifeStageFromUser, formatChildAge, LifeStage } from "./matchability";

/**
 * Extract client IP address from a callable request.
 * Handles x-forwarded-for behind proxies and falls back gracefully.
 */
const getClientIP = (request: any): string => {
  const raw = request?.rawRequest;
  const ip = raw?.ip || raw?.headers?.["x-forwarded-for"] || "unknown";
  return String(ip).split(",")[0].trim();
};

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

const isUnmatchedProfile = (profile: any): boolean => profile?.group_id == null;

type MatchArea = { key: string; label: string };

const normalizeKeyPart = (value: string): string =>
  value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

const deriveMatchArea = (profile: any): MatchArea | null => {
  const rawPostcode = typeof profile?.postcode === 'string'
    ? profile.postcode.trim().toUpperCase()
    : '';

  // US ZIP / ZIP+4 => use first 3 digits as a coarse "area"
  if (/^\d{5}(?:-\d{4})?$/.test(rawPostcode)) {
    const zip3 = rawPostcode.slice(0, 3);
    return {
      key: `zip3:${zip3}`,
      label: `ZIP ${zip3}`,
    };
  }

  // UK-style / generic alphanumeric postcodes => use outcode (before first space)
  if (/[A-Z]/.test(rawPostcode)) {
    const outcode = rawPostcode.split(/\s+/)[0]?.replace(/[^A-Z0-9]/g, '');
    if (outcode && outcode.length >= 2) {
      return {
        key: `pc:${outcode}`,
        label: outcode,
      };
    }
  }

  const city = typeof profile?.location?.city === 'string' ? profile.location.city.trim() : '';
  const stateCode = typeof profile?.location?.state_code === 'string'
    ? profile.location.state_code.trim().toUpperCase()
    : '';

  if (!city || !stateCode) return null;

  return {
    key: `loc:${normalizeKeyPart(city)}|${normalizeKeyPart(stateCode)}`,
    label: `${city}, ${stateCode}`,
  };
};

const normalizeLifeStageFilter = (value: unknown): LifeStage | null => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return (Object.values(LifeStage) as string[]).includes(normalized)
    ? (normalized as LifeStage)
    : null;
};

const formatPrimaryChildSummary = (profile: any): string | null => {
  const children = Array.isArray(profile?.children) ? profile.children : [];
  if (!children[0]) return null;

  const base = formatChildAge(children[0]);
  return children.length > 1 ? `${base} +${children.length - 1} more` : base;
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

  // IP-based rate limit check - prevents enumeration from a single source
  const clientIP = getClientIP(request);
  const ipRateLimitCheck = await RateLimiter.checkMagicLinkRequestByIP(clientIP);
  if (!ipRateLimitCheck.allowed) {
    logger.warn('Magic link request blocked by IP rate limiter', {
      ip: maskIP(clientIP),
    });
    throw new HttpsError('resource-exhausted', ipRateLimitCheck.reason || 'Too many requests');
  }

  // Email-based rate limit check - prevents targeted harassment of specific emails
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

    // Extract and sanitize UTM parameters
    const rawUtm = request.data?.utm;
    const utmKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
    const utm: Record<string, string> = {};
    if (rawUtm && typeof rawUtm === 'object') {
      for (const key of utmKeys) {
        if (typeof rawUtm[key] === 'string' && rawUtm[key].length <= 200) {
          utm[key] = rawUtm[key].trim();
        }
      }
    }
    const hasUtm = Object.keys(utm).length > 0;

    if (!email || !postcode) {
      logger.warn('startSession missing required fields', {
        hasEmail: Boolean(email),
        hasPostcode: Boolean(postcode)
      });
      throw new HttpsError('invalid-argument', 'Email and postcode are required');
    }

    const normalizedEmail = String(email).toLowerCase();
    const normalizedPostcode = String(postcode).trim();

    const db = admin.firestore();

    try {
      logger.info('startSession called', {
        email: maskEmail(normalizedEmail),
        postcode: maskPostcode(normalizedPostcode),
        signupForOther
      });

      const leadQuery = db.collection('leads')
        .where('email', '==', normalizedEmail)
        .limit(1);
      const leadSnap = await leadQuery.get();
      const existingLead = leadSnap.empty ? undefined : leadSnap.docs[0];

      if (existingLead?.data()?.session_id && !signupForOther) {
        // Existing session - send magic link (rate limited)
        const clientIP = getClientIP(request);
        const ipRateLimitCheck = await RateLimiter.checkMagicLinkRequestByIP(clientIP);
        if (!ipRateLimitCheck.allowed) {
          logger.warn('Magic link request blocked by IP rate limiter', {
            ip: maskIP(clientIP),
            email: maskEmail(normalizedEmail)
          });
          throw new HttpsError('resource-exhausted', ipRateLimitCheck.reason || 'Too many requests');
        }

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
          ...(hasUtm && { utm }),
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
        ...(hasUtm && { utm }),
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
        group_id: null,
        last_updated: FieldValue.serverTimestamp(),
        matching_eligible: false,
        ...(hasUtm && { utm }),
      });

      // Create a Firebase custom auth token tied to the session ID
      const authToken = await admin.auth().createCustomToken(sessionId);

      return { status: 'session_created', sessionId, authToken };
    } catch (error: any) {
      logger.error('startSession failed', {
        email: maskEmail(normalizedEmail),
        postcode: maskPostcode(normalizedPostcode),
        signupForOther,
        error: error?.message,
        code: error?.code
      });
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError('internal', 'Failed to start session');
    }
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
    // Add user to Resend onboarded segment (creates contact if needed)
    await EmailService.addToOnboardedSegment(targetEmail, profile.name);

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

/**
 * Get matchable users with scores for manual group creation
 */
export const getMatchableUsers = onCall({ cors: true }, async (request) => {
  requireAdmin(request);

  const { areaKey, lifeStage } = request.data || {};
  const normalizedAreaKey = typeof areaKey === 'string' && areaKey.trim() ? areaKey.trim() : undefined;
  const normalizedLifeStage = normalizeLifeStageFilter(lifeStage);

  logger.info("Get matchable users called", { 
    uid: request.auth?.uid, 
    areaKey: normalizedAreaKey,
    lifeStage: normalizedLifeStage,
    hasAdminClaim: request.auth?.token?.admin 
  });

  try {
    const db = admin.firestore();
    const snapshot = await db.collection('profiles')
      .where('matching_eligible', '==', true)
      .get();

    const unmatchedUsers = snapshot.docs
      .map(doc => doc.data())
      .filter(user => isUnmatchedProfile(user));

    const areaCountMap = new Map<string, { key: string; label: string; count: number }>();
    for (const user of unmatchedUsers) {
      const area = deriveMatchArea(user);
      if (!area) continue;
      const existing = areaCountMap.get(area.key);
      if (existing) {
        existing.count += 1;
      } else {
        areaCountMap.set(area.key, { ...area, count: 1 });
      }
    }

    const areas = Array.from(areaCountMap.values()).sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.label.localeCompare(b.label);
    });

    if (!normalizedAreaKey) {
      logger.info("Returning matchable area list only", {
        eligibleCount: snapshot.size,
        unmatchedCount: unmatchedUsers.length,
        areaCount: areas.length,
      });
      return {
        users: [],
        areas,
        eligibleCount: snapshot.size,
        unmatchedCount: unmatchedUsers.length,
        filteredCount: 0,
        requiresAreaSelection: true,
      };
    }

    const users = unmatchedUsers
      .filter(user => deriveMatchArea(user)?.key === normalizedAreaKey)
      .filter(user => {
        if (!normalizedLifeStage) return true;
        return getLifeStageFromUser(user as any) === normalizedLifeStage;
      });

    logger.info("Matchable users query results", {
      eligibleCount: snapshot.size,
      totalUnmatchedCount: unmatchedUsers.length,
      unmatchedCount: users.length,
      areaKey: normalizedAreaKey,
      lifeStage: normalizedLifeStage,
    });

    // Calculate matchability scores and enrich with formatted data
    const enrichedUsers = users.map(user => {
      try {
        const lifeStage = getLifeStageFromUser(user as any);
        const childAge = user.children?.[0] ? formatChildAge(user.children[0]) : null;
        
        return {
          session_id: user.session_id,
          email: user.email,
          name: user.name,
          location: user.location,
          children: user.children,
          interests: user.interests || [],
          life_stage: lifeStage,
          child_age: childAge,
          child_summary: formatPrimaryChildSummary(user),
          child_count: Array.isArray(user.children) ? user.children.length : 0,
          area_key: deriveMatchArea(user)?.key ?? null,
          area_label: deriveMatchArea(user)?.label ?? null,
        };
      } catch (error) {
        logger.error("Error enriching user data", { 
          sessionId: user.session_id, 
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        // Return basic user data if enrichment fails
        return {
          session_id: user.session_id,
          email: user.email,
          name: user.name,
          location: user.location,
          children: user.children || [],
          interests: user.interests || [],
          life_stage: null,
          child_age: null,
          child_summary: null,
          child_count: Array.isArray(user.children) ? user.children.length : 0,
          area_key: deriveMatchArea(user)?.key ?? null,
          area_label: deriveMatchArea(user)?.label ?? null,
        };
      }
    });

    logger.info(`Returning ${enrichedUsers.length} enriched users`, {
      areaKey: normalizedAreaKey,
      lifeStage: normalizedLifeStage,
    });
    return {
      users: enrichedUsers,
      areas,
      eligibleCount: snapshot.size,
      unmatchedCount: unmatchedUsers.length,
      filteredCount: enrichedUsers.length,
      requiresAreaSelection: false,
    };
  } catch (error) {
    logger.error("Error in getMatchableUsers callable:", error);
    throw new HttpsError('internal', 'Failed to get matchable users', error);
  }
});

/**
 * Calculate matchability score between users or for a group
 */
export const calculateMatchabilityScore = onCall({ cors: true }, async (request) => {
  requireAdmin(request);

  const { userIds } = request.data;

  if (!userIds || !Array.isArray(userIds) || userIds.length < 2) {
    throw new HttpsError('invalid-argument', 'At least 2 user IDs required');
  }

  try {
    const db = admin.firestore();
    const users = await Promise.all(
      userIds.map(async (id: string) => {
        const doc = await db.collection('profiles').doc(id).get();
        return doc.exists ? doc.data() : null;
      })
    );

    const validUsers = users.filter(u => u !== null);

    if (validUsers.length < 2) {
      throw new HttpsError('invalid-argument', 'Not enough valid users found');
    }

    const groupScore = calculateGroupScore(validUsers as any);

    return { score: groupScore };
  } catch (error) {
    logger.error("Error in calculateMatchabilityScore callable:", error);
    throw new HttpsError('internal', 'Failed to calculate matchability', error);
  }
});

/**
 * Create a group manually and send introduction emails immediately
 */
export const createManualGroup = onCall(
  {
    cors: true,
    secrets: [resendApiKey, defaultFromEmail, sendRealEmails],
  },
  async (request) => {
    requireAdmin(request);

    const { memberIds, groupName } = request.data;

    if (!memberIds || !Array.isArray(memberIds) || memberIds.length === 0) {
      throw new HttpsError('invalid-argument', 'memberIds array is required');
    }

    const normalizedMemberIds = Array.from(
      new Set(
        memberIds
          .filter((id: unknown): id is string => typeof id === 'string')
          .map((id: string) => id.trim())
          .filter(Boolean)
      )
    );

    if (normalizedMemberIds.length === 0) {
      throw new HttpsError('invalid-argument', 'At least one valid member ID is required');
    }

    if (normalizedMemberIds.length > 6) {
      throw new HttpsError('invalid-argument', 'Maximum 6 members allowed per group');
    }

    logger.info("Create manual group called", { 
      uid: request.auth?.uid, 
      memberCount: normalizedMemberIds.length,
      requestedMemberCount: memberIds.length,
      groupName 
    });

    const db = admin.firestore();

    try {
      // Fetch all member profiles
      const memberDocs = await Promise.all(
        normalizedMemberIds.map((id: string) => db.collection('profiles').doc(id).get())
      );

      const missingMemberIds = memberDocs
        .map((doc, idx) => (doc.exists ? null : normalizedMemberIds[idx]))
        .filter((id): id is string => Boolean(id));

      if (missingMemberIds.length > 0) {
        throw new HttpsError(
          'invalid-argument',
          `Some selected users no longer exist (${missingMemberIds.length})`
        );
      }

      const members = memberDocs.map(doc => doc.data());

      // Validate all members are unmatched
      const alreadyMatched = members.filter(m => m?.group_id != null);
      if (alreadyMatched.length > 0) {
        throw new HttpsError('failed-precondition', 
          `${alreadyMatched.length} user(s) already in a group`);
      }

      // Validate all members are still eligible for matching
      const ineligibleMembers = members.filter(m => m?.matching_eligible !== true);
      if (ineligibleMembers.length > 0) {
        throw new HttpsError(
          'failed-precondition',
          `${ineligibleMembers.length} user(s) are not matchable anymore`
        );
      }

      // Get location and life stage from first member
      const firstMember = members[0];
      const location = firstMember?.location;
      const lifeStage = getLifeStageFromUser(firstMember as any);
      const firstMatchArea = deriveMatchArea(firstMember);

      if (!location?.city || !location?.state_code) {
        throw new HttpsError('invalid-argument', 'Members must have location data');
      }

      if (!firstMatchArea) {
        throw new HttpsError('invalid-argument', 'Members must have postcode or location data');
      }

      // Keep manual grouping simple: require a shared matching area (postcode area or city fallback).
      const crossAreaMembers = members.filter(m => deriveMatchArea(m)?.key !== firstMatchArea.key);
      if (crossAreaMembers.length > 0) {
        throw new HttpsError(
          'failed-precondition',
          'All selected users must be in the same area'
        );
      }

      // Calculate group score
      const groupScore = calculateGroupScore(members as any);

      // Generate group name if not provided
      const trimmedGroupName = typeof groupName === 'string' ? groupName.trim() : '';
      const finalGroupName = trimmedGroupName || 
        `${firstMatchArea.label} ${lifeStage || 'Dads'} - Group ${Date.now()}`;

      // Create group
      const groupId = crypto.randomUUID();
      const group = {
        group_id: groupId,
        name: finalGroupName,
        created_at: FieldValue.serverTimestamp(),
        location: location,
        member_ids: normalizedMemberIds,
        member_emails: members.map(m => m?.email || '').filter(e => e),
        status: 'active', // Active immediately since we're sending emails
        emailed_member_ids: [],
        test_mode: false,
        life_stage: lifeStage || 'Mixed',
        matchability_score: groupScore,
        match_area_key: firstMatchArea.key,
      };

      // Save group
      await db.collection('groups').doc(groupId).set(group);

      // Assign users to group
      const batch = db.batch();
      for (const memberId of normalizedMemberIds) {
        const userRef = db.collection('profiles').doc(memberId);
        batch.update(userRef, {
          group_id: groupId,
          matched_at: FieldValue.serverTimestamp(),
          last_updated: FieldValue.serverTimestamp()
        });
      }
      await batch.commit();

      // Send introduction emails
      const emailResult = await sendGroupIntroductionEmails(group as any, false);

      if (emailResult.success && emailResult.emailedMembers.length > 0) {
        return { 
          success: true, 
          groupId,
          message: `Group created and emails sent to ${emailResult.emailedMembers.length} members`,
          matchability_score: groupScore
        };
      } else {
        return { 
          success: true, 
          groupId,
          message: `Group created but no emails sent`,
          matchability_score: groupScore
        };
      }
    } catch (error) {
      logger.error("Error in createManualGroup callable:", error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError('internal', 'Failed to create group', error);
    }
});
