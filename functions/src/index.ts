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
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import { EmailService } from "./emailService";
import { DebugLogger } from "./logger";
import { runDailyMatching, sendPendingGroupEmails } from "./matching";

// Import manual test function
export { manualEmailTest } from "./manual-test";

// Export Callable Functions for Admin Dashboard
export { runMatching, seedData, approveGroup, deleteGroup } from "./callable";

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

      DebugLogger.info("📊 Lead data extracted", {
        hasData: !!leadData,
        leadData: leadData
      });

      if (!leadData) {
        DebugLogger.error("❌ No lead data found in document");
        logger.error("No lead data found in document");
        return;
      }

      const { email, postcode } = leadData;

      DebugLogger.info("🔍 Validating required fields", {
        email: email,
        postcode: postcode,
        hasEmail: !!email,
        hasPostcode: !!postcode
      });

      if (!email || !postcode) {
        DebugLogger.error("❌ Missing required fields", { email, postcode });
        logger.error("Missing required fields", { email, postcode });
        return;
      }

      DebugLogger.info("📧 Generating welcome email template", {
        email,
        postcode
      });

      logger.info("Sending welcome email", {
        leadId: event.params.leadId,
        email,
        postcode,
      });

      // Generate and send welcome email
      const emailTemplate = EmailService.generateWelcomeEmail(email, postcode);

      DebugLogger.info("✉️ Email template generated", {
        to: emailTemplate.to,
        subject: emailTemplate.subject,
        from: emailTemplate.from,
        htmlLength: emailTemplate.html.length
      });

      // Send email (EmailService handles simulation when API key not configured)
      DebugLogger.info("🚀 Attempting to send email via EmailService");
      const success = await EmailService.sendEmail(emailTemplate);

      DebugLogger.info("📬 Email send result", {
        success: success,
        email: email,
        leadId: event.params.leadId
      });

      if (success) {
        DebugLogger.info("✅ Email sent/simulated successfully, updating database");
        // Update the lead document to mark welcome email as sent
        await event.data?.ref.update({
          welcomeEmailSent: true,
          welcomeEmailSentAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        DebugLogger.info("✅ Database updated successfully");
        logger.info("Welcome email processed successfully", {
          leadId: event.params.leadId,
          email,
        });
      } else {
        DebugLogger.error("❌ Email sending failed, marking as failed");
        logger.error("Failed to send welcome email", {
          leadId: event.params.leadId,
          email,
        });

        // Mark as failed for retry logic
        await event.data?.ref.update({
          welcomeEmailFailed: true,
          welcomeEmailFailedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
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
 * Sends follow-up emails to leads who signed up 24+ hours ago
 * and haven't received a follow-up email yet.
 */
export const sendFollowUpEmails = onSchedule(
  {
    schedule: "0 10 * * *", // Daily at 10 AM UTC
    timeZone: "UTC",
    region: "us-central1",
  },
  async () => {
    try {
      logger.info("Starting follow-up email job");

      const db = admin.firestore();
      const now = Date.now();
      const oneDayAgo = now - (24 * 60 * 60 * 1000); // 24 hours ago

      // Query for leads that need follow-up emails
      const leadsQuery = db.collection("leads")
        .where("timestamp", "<=", oneDayAgo)
        .where("welcomeEmailSent", "==", true)
        .where("followUpEmailSent", "!=", true)
        .limit(50); // Process in batches to avoid timeouts

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
          const emailTemplate = EmailService.generateFollowUpEmail(email, postcode);
          const success = await EmailService.sendEmail(emailTemplate);

          if (success) {
            // Mark follow-up email as sent
            batch.update(doc.ref, {
              followUpEmailSent: true,
              followUpEmailSentAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            emailsSent++;

            logger.info("Follow-up email sent", {
              leadId: doc.id,
              email,
            });
          } else {
            // Mark as failed
            batch.update(doc.ref, {
              followUpEmailFailed: true,
              followUpEmailFailedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            emailsFailed++;

            logger.error("Follow-up email failed", {
              leadId: doc.id,
              email,
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
    const testWelcomeEmail = EmailService.generateWelcomeEmail(
      "test@example.com",
      "SW1A 1AA"
    );

    logger.info("Test email template generated", {
      subject: testWelcomeEmail.subject,
      to: testWelcomeEmail.to,
    });
  }
);

/**
 * Daily Matching Function
 *
 * Scheduled to run daily at 9 AM UTC.
 * Scans all cities and runs matching for any city with >= 4 unmatched users in a bucket.
 */
export const runDailyMatchingJob = onSchedule(
  {
    schedule: "0 9 * * *", // Daily at 9 AM UTC
    timeZone: "UTC",
    region: "us-central1",
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

/**
 * Group Email Processing Function
 *
 * Scheduled to run every 2 hours.
 * Sends introduction emails to newly formed groups.
 */
export const processGroupEmails = onSchedule(
  {
    schedule: "0 */2 * * *", // Every 2 hours
    timeZone: "UTC",
    region: "us-central1",
  },
  async () => {
    try {
      logger.info("📧 Starting group email processing job");
      await sendPendingGroupEmails();
      logger.info("✅ Group email processing job completed successfully");
    } catch (error) {
      logger.error("❌ Group email processing job failed:", error);
    }
  }
);
