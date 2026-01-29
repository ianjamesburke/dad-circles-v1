import { Resend } from "resend";
import { logger } from "./logger";
import { maskEmail } from "./utils/pii";

// Initialize Resend with API key from environment
// Handle missing API key gracefully for development/testing
let resend: Resend | null = null;

export interface EmailTemplate {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

export interface TemplateEmail {
  to: string;
  templateId: string;
  variables: Record<string, string | number>;
  from?: string;
}

export const EMAIL_TEMPLATES = {
  WELCOME_COMPLETED: 'welcome-completed',
  WELCOME_ABANDONED: 'welcome-abandoned',
  RESUME_SESSION: 'resume-session',
  SIGNUP_OTHER: 'signup-other',
  FOLLOWUP_3DAY: 'followup-3day',
  GROUP_INTRO: 'group-intro',
} as const;

export class EmailService {
  private static readonly DEFAULT_FROM = "DadCircles <info@mail.dadcircles.com>";
  
  /**
   * Initialize Resend client lazily
   */
  private static initResend(): Resend | null {
    if (resend) return resend;
    
    try {
      if (process.env.RESEND_API_KEY && process.env.RESEND_API_KEY !== "your_resend_api_key_here") {
        resend = new Resend(process.env.RESEND_API_KEY);
        logger.info("🔑 Resend initialized successfully with API key");
      } else {
        // Only warn once
        if (!process.env.SILENCE_RESEND_WARNING) {
          logger.warn("⚠️ RESEND_API_KEY not configured - email sending will be simulated");
          process.env.SILENCE_RESEND_WARNING = "true";
        }
      }
    } catch (error) {
      logger.error("❌ Failed to initialize Resend:", error);
    }
    
    return resend;
  }

  /**
   * Send an email using Resend
   * Handles simulation in development/emulator unless SEND_REAL_EMAILS is true
   */
  static async sendEmail(template: EmailTemplate, forceSimulation: boolean = false): Promise<boolean> {
    const from = template.from || this.DEFAULT_FROM;
    this.initResend();

    const isEmulator = process.env.FUNCTIONS_EMULATOR === "true";
    const sendRealEmails = process.env.SEND_REAL_EMAILS === "true";

    // Determine if we should simulate
    const shouldSimulate =
      forceSimulation ||
      (isEmulator && !sendRealEmails) ||
      !resend;

    if (shouldSimulate) {
      const reason = forceSimulation ? "Force Simulation" :
        (isEmulator && !sendRealEmails) ? "Emulator Mode (Real Emails Disabled)" :
          "Missing API Key";

      logger.info("📝 SIMULATED EMAIL LOG", {
        reason,
        to: maskEmail(template.to),
        from: from,
        subject: template.subject,
        htmlPreview: template.html.substring(0, 100) + "...",
        fullContent: "Check usage logs for full content if needed"
      });

      // In emulator, print a visual divider and details to stdout for easy reading
      if (isEmulator) {
        console.log("\n" + "=".repeat(50));
        console.log("📧 SIMULATED EMAIL DISPATCHED");
        console.log("=".repeat(50));
        console.log(`To:      ${maskEmail(template.to)}`);
        console.log(`From:    ${from}`);
        console.log(`Subject: ${template.subject}`);
        console.log(`Reason:  ${reason}`);
        console.log("-".repeat(50));
        console.log("BODY PREVIEW:");
        console.log(template.html.replace(/<[^>]*>/g, '').substring(0, 300).trim() + "...");
        console.log("=".repeat(50) + "\n");
      }

      return true; // Return success for simulation
    }

    try {
      if (!resend) throw new Error("Resend client not initialized");

      logger.info("🚀 Sending REAL email via Resend API", {
        to: maskEmail(template.to),
        from: from,
        subject: template.subject
      });

      const result = await resend.emails.send({
        from: from,
        to: template.to,
        subject: template.subject,
        html: template.html,
      });

      if (result.error) {
        logger.error("❌ Resend API error:", result.error);
        return false;
      }

      logger.info("✅ Email sent successfully", {
        emailId: result.data?.id,
        to: maskEmail(template.to),
      });

      return true;
    } catch (error) {
      logger.error("Email service error:", error);
      return false;
    }
  }

  /**
   * Send a template email using Resend
   * Handles simulation in development/emulator unless SEND_REAL_EMAILS is true
   */
  static async sendTemplateEmail(
    template: TemplateEmail,
    forceSimulation: boolean = false
  ): Promise<boolean> {
    const from = template.from || this.DEFAULT_FROM;
    this.initResend();

    const isEmulator = process.env.FUNCTIONS_EMULATOR === "true";
    const sendRealEmails = process.env.SEND_REAL_EMAILS === "true";

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
      console.log(`To:       ${maskEmail(template.to)}`);
      console.log(`From:     ${from}`);
      console.log(`Template: ${template.templateId}`);
      console.log(`Variables:`, template.variables);
      console.log("=".repeat(50) + "\n");

      return true;
    }

    try {
      if (!resend) throw new Error("Resend client not initialized");

      // Send using Resend API with template ID (alias)
      const result = await resend.emails.send({
        from: from,
        to: template.to,
        // Using 'any' cast here because the installed @types/resend might not fully support the 'template' property yet
        // even though the underlying library does, or to bypass strict type checking if definitions are lagging.
        // However, based on our investigation, it should be supported.
        // We omit 'subject' and 'html' as they are defined in the template.
        template: {
            id: template.templateId,
            variables: template.variables
        }
      } as any);

      if (result.error) {
        logger.error("❌ Resend template API error:", result.error);
        return false;
      }

      logger.info("✅ Template email sent successfully", {
        emailId: result.data?.id,
        to: maskEmail(template.to),
        templateId: template.templateId,
      });

      return true;
    } catch (error) {
      logger.error("Template email service error:", error);
      return false;
    }
  }





  /**
   * Send group introduction email to all members
   */
  static async sendGroupIntroductionEmail(
    groupName: string,
    members: Array<{ email: string; name: string; childInfo: string }>,
    testMode: boolean = false
  ): Promise<{ success: boolean; emailedMembers: string[] }> {
    this.initResend();
    
    logger.info("📧 EmailService.sendGroupIntroductionEmail called", {
      groupName,
      memberCount: members.length,
      testMode,
      hasResend: !!resend
    });

    const emailedMembers: string[] = [];

    try {
      // Validate inputs
      if (!groupName || !members || members.length === 0) {
        logger.error("❌ Invalid input parameters for group introduction email", {
          groupName: !!groupName,
          membersCount: members?.length || 0
        });
        return { success: false, emailedMembers: [] };
      }

      // Generate the email template
      const membersListHtml = members.map(member =>
        `<li><strong>${member.name}</strong> - ${member.childInfo}</li>`
      ).join('');

      const template: TemplateEmail = {
        to: '', // Will be set per recipient
        templateId: EMAIL_TEMPLATES.GROUP_INTRO,
        variables: {
          group_name: groupName,
          members_list: membersListHtml,
          test_mode: testMode ? 'true' : 'false'
        }
      };

      logger.info("✉️ Email template generated successfully", {
        templateId: template.templateId,
        memberCount: members.length
      });

      // Send to each member
      for (const member of members) {
        try {
          // Validate member data
          if (!member.email || !member.name) {
            logger.warn("⚠️ Skipping member with invalid data", {
              hasEmail: !!member.email,
              hasName: !!member.name
            });
            continue;
          }

          const memberTemplate = {
            ...template,
            to: member.email
          };

          // Use sendTemplateEmail with forceSimulation if testMode is true
          const success = await this.sendTemplateEmail(memberTemplate, testMode);

          if (success) {
            emailedMembers.push(member.email);
          } else {
            logger.error("❌ Failed to send group introduction email", {
              to: maskEmail(member.email),
              groupName
            });
          }
        } catch (memberError) {
          logger.error("❌ Error sending group email to individual member", {
            email: maskEmail(member.email),
            error: memberError instanceof Error ? memberError.message : 'Unknown error',
            stack: memberError instanceof Error ? memberError.stack : undefined
          });
          // Continue with other members rather than failing completely
        }
      }

      const success = emailedMembers.length > 0;
      logger.info("📬 Group introduction email batch complete", {
        groupName,
        totalMembers: members.length,
        emailedMembers: emailedMembers.length,
        success,
        successRate: `${Math.round((emailedMembers.length / members.length) * 100)}%`
      });

      return { success, emailedMembers };

    } catch (error) {
      logger.error("❌ Critical error in group introduction email service", {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        groupName,
        memberCount: members?.length || 0
      });
      return { success: false, emailedMembers };
    }
  }
}
