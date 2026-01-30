/**
 * DadCircles Email Integration Cloud Functions
 *
 * This module handles all email functionality for the DadCircles platform:
 * - Welcome emails sent immediately when users sign up
 * - Follow-up emails sent on a schedule to nurture leads
 * - Group introduction emails for matched dads
 * - Daily matching and email processing
 */

import { setGlobalOptions } from "firebase-functions";
import { defineSecret } from "firebase-functions/params";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { logger, DebugLogger } from "./logger";
import { EmailService, EMAIL_TEMPLATES } from "./emailService";
import { getLocationFromPostcode, formatLocation } from "./utils/location";
// import { generateMagicLink } from "./utils/link"; // Temporarily unused while abandonment cron is disabled
// import { runDailyMatching } from "./matching"; // Temporarily unused while matching cron is disabled
import { maskEmail, maskPostcode } from "./utils/pii";

// Define secrets - these are automatically loaded from .env in emulator mode
// and from Cloud Secret Manager in production
export const resendApiKey = defineSecret("RESEND_API_KEY");
export const defaultFromEmail = defineSecret("DEFAULT_FROM_EMAIL");
export const sendRealEmails = defineSecret("SEND_REAL_EMAILS");

// Export Callable Functions for Admin Dashboard
export { runMatching, seedData, approveGroup, deleteGroup, sendMagicLink, sendCompletionEmail, sendManualAbandonmentEmail } from "./callable";

// Export Gemini AI Function
export { getGeminiResponse } from "./gemini/index";

// Initialize Firebase Admin SDK
admin.initializeApp();

// Set global options for cost control
setGlobalOptions({ maxInstances: 10 });

/**
 * Welcome Email Function
 *
 * Triggered automatically when a new lead document is created in Firestore.
 * Sends an immediate welcome email to the new subscriber.
 * If RESEND_API_KEY is not configured, emails are simulated (logged but not sent).
 */
export const sendWelcomeEmail = onDocumentCreated(
  {
    document: "leads/{leadId}",
    region: "us-central1",
    secrets: [resendApiKey, defaultFromEmail, sendRealEmails],
  },
  async (event) => {
    DebugLogger.info("🚀 WELCOME EMAIL FUNCTION TRIGGERED", {
      functionName: "sendWelcomeEmail",
      leadId: event.params.leadId,
      timestamp: new Date().toISOString()
    });

    try {
      DebugLogger.info("📄 Extracting lead data from event");
      const leadData = event.data?.data();
      
      
      if (!leadData) {
        DebugLogger.error("❌ No lead data found in document");
        logger.error("No lead data found in document");
        return;
      }
      
      const { email, postcode, signupForOther } = leadData;

      DebugLogger.info("📊 Lead data extracted", {
        hasData: !!leadData,
        email: maskEmail(email),
        postcode: maskPostcode(postcode)
      });

      DebugLogger.info("🔍 Validating required fields", {
        email: maskEmail(email),
        postcode: maskPostcode(postcode),
        signupForOther: signupForOther,
        hasEmail: !!email,
        hasPostcode: !!postcode
      });

      if (!email || !postcode) {
        DebugLogger.error("❌ Missing required fields", { 
          email: maskEmail(email), 
          postcode: maskPostcode(postcode) 
        });
        logger.error("Missing required fields", { 
          email: maskEmail(email), 
          postcode: maskPostcode(postcode) 
        });
        return;
      }

      // If signing up for someone else, send immediate email
      if (signupForOther) {
        DebugLogger.info("📧 Sending immediate email for 'signup for other'", { 
          email: maskEmail(email) 
        });
        
        const locationInfo = await getLocationFromPostcode(postcode);
        if (!locationInfo) {
          logger.warn("⚠️ Location lookup failed, using postcode fallback", {
            postcode: maskPostcode(postcode),
            email: maskEmail(email)
          });
        }
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
            signupOtherEmailSentAt: FieldValue.serverTimestamp(),
            last_communication_at: FieldValue.serverTimestamp(), // Track for follow-up emails
          });
          logger.info("Signup-other email sent", { leadId: event.params.leadId });
        } else {
          logger.error("Failed to send signup-other email", { leadId: event.params.leadId });
        }
      } else {
        // Mark welcome email as pending (sent on completion or abandonment)
        DebugLogger.info("⏳ Deferring welcome email for personal signup");
        
        await event.data?.ref.update({
          welcomeEmailPending: true,
          welcomeEmailPendingAt: FieldValue.serverTimestamp(),
        });
        
        logger.info("Welcome email deferred", { leadId: event.params.leadId });
      }
    } catch (error) {
      logger.error("Welcome email function error:", error);
    }
  }
);

/**
 * Follow-up Email Function
 *
 * Scheduled to run daily at 10 AM UTC (adjust timezone as needed).
 * Sends follow-up emails to leads who received a welcome or abandonment email
 * 24+ hours ago and haven't received a follow-up email yet.
 * 
 * Uses the unified `last_communication_at` field to simplify querying.
 * This field is set whenever a welcome-completed, welcome-abandoned, or
 * signup-other email is sent, allowing us to use a single query instead
 * of multiple queries with deduplication.
 */
export const sendFollowUpEmails = onSchedule(
  {
    schedule: "0 10 * * *", // Daily at 10 AM UTC
    timeZone: "UTC",
    region: "us-central1",
    secrets: [resendApiKey, defaultFromEmail, sendRealEmails],
  },
  async () => {
    try {
      logger.info("Starting follow-up email job");

      const db = admin.firestore();
      const now = Date.now();
      const oneDayAgo = now - (24 * 60 * 60 * 1000); // 24 hours ago

      // Single unified query using last_communication_at
      // This replaces the previous dual-query approach (welcomeEmailSent + abandonmentEmailSent)
      // and eliminates the need for manual deduplication
      const leadsQuery = db.collection("leads")
        .where("last_communication_at", "<=", oneDayAgo)
        .where("followUpEmailSent", "!=", true)
        .limit(50);

      const snapshot = await leadsQuery.get();

      if (snapshot.empty) {
        logger.info("No leads found for follow-up emails");
        return;
      }

      logger.info(`Processing ${snapshot.size} leads for follow-up emails`);

      const batch = db.batch();
      let emailsSent = 0;
      let emailsFailed = 0;

      // Process each lead
      for (const doc of snapshot.docs) {
        const leadData = doc.data();
        const { email, postcode } = leadData;

        try {
          // Generate and send follow-up email
          const locationInfo = await getLocationFromPostcode(postcode);
          if (!locationInfo) {
            logger.warn("⚠️ Location lookup failed, using postcode fallback", {
              postcode: maskPostcode(postcode),
              email: maskEmail(email),
              leadId: doc.id
            });
          }
          const locationString = locationInfo
            ? formatLocation(locationInfo.city, locationInfo.stateCode)
            : postcode;

          const emailTemplate = {
            to: email,
            templateId: EMAIL_TEMPLATES.FOLLOWUP_3DAY,
            variables: { location: locationString }
          };
          const success = await EmailService.sendTemplateEmail(emailTemplate);

          if (success) {
            // Mark follow-up email as sent
            batch.update(doc.ref, {
              followUpEmailSent: true,
              followUpEmailSentAt: FieldValue.serverTimestamp(),
            });
            emailsSent++;

            logger.info("Follow-up email sent", {
              leadId: doc.id,
              email: maskEmail(email),
            });
          } else {
            // Mark as failed
            batch.update(doc.ref, {
              followUpEmailFailed: true,
              followUpEmailFailedAt: FieldValue.serverTimestamp(),
            });
            emailsFailed++;

            logger.error("Follow-up email failed", {
              leadId: doc.id,
              email: maskEmail(email),
            });
          }
        } catch (error) {
          logger.error("Error processing lead for follow-up", {
            leadId: doc.id,
            error,
          });
          emailsFailed++;
        }
      }

      // Commit all database updates
      await batch.commit();

      logger.info("Follow-up email job completed", {
        totalProcessed: snapshot.size,
        emailsSent,
        emailsFailed,
      });
    } catch (error) {
      logger.error("Follow-up email job error:", error);
    }
  }
);

/**
 * Test function for development
 * Can be called manually to test email functionality
 */
export const testEmail = onSchedule(
  {
    schedule: "every 24 hours", // Won't actually run unless manually triggered
    region: "us-central1",
  },
  async () => {
    logger.info("Test email function - this should only be triggered manually");

    // Test welcome email
    const testWelcomeEmail = {
      to: "test@example.com",
      templateId: EMAIL_TEMPLATES.WELCOME_COMPLETED,
      variables: {
        location: "London, UK"
      }
    };

    logger.info("Test email template generated", {
      templateId: testWelcomeEmail.templateId,
      to: testWelcomeEmail.to,
    });
  }
);

/**
 * Daily Matching Function
 *
 * Scheduled to run daily at 9 AM UTC.
 * Scans all cities and runs matching for any city with >= 4 unmatched users in a bucket.
 * 
 * TEMPORARILY DISABLED - Use manual matching in Admin Dashboard instead
 */
/*
export const runDailyMatchingJob = onSchedule(
  {
    schedule: "0 9 * * *", // Daily at 9 AM UTC
    timeZone: "UTC",
    region: "us-central1",
    secrets: [resendApiKey, defaultFromEmail, sendRealEmails],
  },
  async () => {
    try {
      logger.info("🚀 Starting daily matching job");
      await runDailyMatching();
      logger.info("✅ Daily matching job completed successfully");
    } catch (error) {
      logger.error("❌ Daily matching job failed:", error);
    }
  }
);
*/

/**
 * Abandonment Recovery Email Function
 *
 * Scheduled to run hourly from 8am-8pm ET.
 * Sends recovery emails to users who started onboarding but stopped for > 1 hour.
 * 
 * Note: last_updated tracks both profile changes AND user activity (messages).
 * This means users actively chatting won't receive abandonment emails (correct behavior).
 * The email is sent 1 hour after the user's last interaction.
 * 
 * TEMPORARILY DISABLED - Use manual trigger in Admin Dashboard instead
 */
/*
export const sendAbandonedOnboardingEmails = onSchedule(
  {
    schedule: "0 8-20 * * *",
    timeZone: "America/New_York",
    region: "us-central1",
    secrets: [resendApiKey, defaultFromEmail, sendRealEmails],
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
           const magicLink = generateMagicLink(profile.session_id);

          // Get location
          const locationInfo = await getLocationFromPostcode(profile.postcode);
          if (!locationInfo) {
            logger.warn("⚠️ Location lookup failed, using postcode fallback", {
              postcode: maskPostcode(profile.postcode),
              session_id: profile.session_id
            });
          }
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
            // Use batch write for atomic updates to profile and lead
            const batch = db.batch();

            // Update profile
            batch.update(doc.ref, {
              abandonment_sent: true,
              abandonment_sent_at: FieldValue.serverTimestamp(),
            });

            // Update lead record to track abandonment email
            const leadQuery = db.collection("leads")
              .where("email", "==", profile.email.toLowerCase())
              .limit(1);
            const leadSnap = await leadQuery.get();

            if (!leadSnap.empty) {
              batch.update(leadSnap.docs[0].ref, {
                abandonmentEmailSent: true,
                abandonmentEmailSentAt: FieldValue.serverTimestamp(),
                last_communication_at: FieldValue.serverTimestamp(), // Track for follow-up emails
              });
            }

            // Commit all updates atomically
            await batch.commit();

            emailsSent++;

            logger.info("✅ Abandonment email sent", {
              session_id: profile.session_id,
              email: maskEmail(profile.email),
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
// End of commented out function
*/

