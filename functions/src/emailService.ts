import {Resend} from "resend";
import * as logger from "firebase-functions/logger";

// Initialize Resend with API key from environment
// Handle missing API key gracefully for development/testing
let resend: Resend | null = null;

try {
  if (process.env.RESEND_API_KEY && process.env.RESEND_API_KEY !== "your_resend_api_key_here") {
    resend = new Resend(process.env.RESEND_API_KEY);
    logger.info("🔑 Resend initialized successfully with API key");
  } else {
    logger.warn("⚠️ RESEND_API_KEY not configured - email sending will be simulated");
  }
} catch (error) {
  logger.error("❌ Failed to initialize Resend:", error);
}

export interface EmailTemplate {
  to: string;
  subject: string;
  html: string;
  from?: string;
}
export class EmailService {
  private static readonly DEFAULT_FROM = "DadCircles <noreply@dadcircles.com>";

  /**
   * Send an email using Resend
   */
  static async sendEmail(template: EmailTemplate): Promise<boolean> {
    logger.info("📧 EmailService.sendEmail called", {
      to: template.to,
      subject: template.subject,
      from: template.from || this.DEFAULT_FROM,
      hasResend: !!resend,
      apiKeyConfigured: !!process.env.RESEND_API_KEY
    });

    try {
      // If Resend is not configured, simulate email sending for development
      if (!resend) {
        logger.warn("⚠️ SIMULATED EMAIL (Resend not configured)", {
          to: template.to,
          subject: template.subject,
          from: template.from || this.DEFAULT_FROM,
        });
        return true; // Return success for development
      }

      logger.info("🚀 Sending email via Resend API", {
        to: template.to,
        from: template.from || this.DEFAULT_FROM,
        subject: template.subject
      });

      const result = await resend.emails.send({
        from: template.from || this.DEFAULT_FROM,
        to: template.to,
        subject: template.subject,
        html: template.html,
      });

      logger.info("📬 Resend API response received", {
        hasError: !!result.error,
        hasData: !!result.data,
        emailId: result.data?.id
      });

      if (result.error) {
        logger.error("❌ Resend API error:", result.error);
        return false;
      }

      logger.info("✅ Email sent successfully", {
        emailId: result.data?.id,
        to: template.to,
        subject: template.subject,
      });

      return true;
    } catch (error) {
      logger.error("Email service error:", error);
      return false;
    }
  }

  /**
   * Generate welcome email template
   */
  static generateWelcomeEmail(email: string, postcode: string): EmailTemplate {
    return {
      to: email,
      subject: "Welcome to DadCircles! 🎉",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome to DadCircles</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f8fafc; }
            .container { max-width: 600px; margin: 0 auto; background-color: white; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center; }
            .logo { width: 60px; height: 60px; background: rgba(255,255,255,0.2); border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 24px; margin-bottom: 20px; }
            .header h1 { color: white; margin: 0; font-size: 28px; font-weight: 600; }
            .content { padding: 40px 20px; }
            .content h2 { color: #1a1a1a; margin-bottom: 20px; }
            .content p { color: #4a5568; line-height: 1.6; margin-bottom: 20px; }
            .highlight { background: #f0fdf4; border-left: 4px solid #10b981; padding: 16px; margin: 20px 0; border-radius: 4px; }
            .footer { background: #f8fafc; padding: 20px; text-align: center; color: #718096; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">DC</div>
              <h1>Welcome to DadCircles!</h1>
            </div>
            
            <div class="content">
              <h2>Thanks for joining our waitlist! 🎉</h2>
              
              <p>Hey there!</p>
              
              <p>We're excited to have you join the DadCircles community. You've just taken the first step toward connecting with other dads in your area who share your interests and experiences.</p>
              
              <div class="highlight">
                <strong>What happens next?</strong><br>
                We're building something special for dads in <strong>${postcode}</strong>. We'll be in touch soon with updates about local dad groups and activities in your area.
              </div>
              
              <p>In the meantime, we're working hard to:</p>
              <ul>
                <li>Find other dads near you</li>
                <li>Match you with people who share your interests</li>
                <li>Set up local meetups and activities</li>
                <li>Build a supportive community for modern fathers</li>
              </ul>
              
              <p>Keep an eye on your inbox - we'll have more exciting updates coming your way soon!</p>
              
              <p>Thanks for being part of the journey.</p>
              
              <p><strong>The DadCircles Team</strong></p>
            </div>
            
            <div class="footer">
              <p>DadCircles is in early alpha - we're building something amazing for dads everywhere.</p>
              <p>Questions? Just reply to this email - we'd love to hear from you!</p>
            </div>
          </div>
        </body>
        </html>
      `,
    };
  }

  /**
   * Generate follow-up email template
   */
  static generateFollowUpEmail(email: string, postcode: string): EmailTemplate {
    return {
      to: email,
      subject: "Building your local dad network in " + postcode,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Your DadCircles Update</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f8fafc; }
            .container { max-width: 600px; margin: 0 auto; background-color: white; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center; }
            .logo { width: 60px; height: 60px; background: rgba(255,255,255,0.2); border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 24px; margin-bottom: 20px; }
            .header h1 { color: white; margin: 0; font-size: 28px; font-weight: 600; }
            .content { padding: 40px 20px; }
            .content h2 { color: #1a1a1a; margin-bottom: 20px; }
            .content p { color: #4a5568; line-height: 1.6; margin-bottom: 20px; }
            .highlight { background: #eff6ff; border-left: 4px solid #3b82f6; padding: 16px; margin: 20px 0; border-radius: 4px; }
            .footer { background: #f8fafc; padding: 20px; text-align: center; color: #718096; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">DC</div>
              <h1>Building Your Network</h1>
            </div>
            
            <div class="content">
              <h2>Progress update from ${postcode} 📍</h2>
              
              <p>Hi again!</p>
              
              <p>We wanted to give you a quick update on what we're building for dads in your area.</p>
              
              <div class="highlight">
                <strong>What we're working on:</strong><br>
                We're actively connecting dads in <strong>${postcode}</strong> and surrounding areas. Our goal is to create meaningful connections between fathers who share similar experiences and interests.
              </div>
              
              <p>Here's what's happening behind the scenes:</p>
              <ul>
                <li><strong>Community Building:</strong> We're identifying other dads in your area</li>
                <li><strong>Interest Matching:</strong> Finding people with shared hobbies and parenting styles</li>
                <li><strong>Local Events:</strong> Planning meetups, playdates, and dad-friendly activities</li>
                <li><strong>Support Network:</strong> Creating spaces for advice, tips, and friendship</li>
              </ul>
              
              <p>We're getting closer to launching the first local groups. When we're ready, you'll be among the first to know about opportunities to connect with other dads near you.</p>
              
              <p>Thanks for your patience as we build something truly valuable for the dad community.</p>
              
              <p><strong>The DadCircles Team</strong></p>
            </div>
            
            <div class="footer">
              <p>Still in early development - but we're making great progress!</p>
              <p>Have ideas or feedback? Reply to this email - we read every message.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    };
  }

  /**
   * Generate group introduction email template
   */
  static generateGroupIntroductionEmail(
    groupName: string, 
    members: Array<{ name: string; childInfo: string }>,
    testMode: boolean = false
  ): EmailTemplate {
    const membersList = members.map(member => 
      `<li><strong>${member.name}</strong> - ${member.childInfo}</li>`
    ).join('');

    return {
      to: '', // Will be set per recipient
      subject: `Meet Your DadCircles Group: ${groupName}${testMode ? ' (TEST)' : ''}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Meet Your DadCircles Group</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f8fafc; }
            .container { max-width: 600px; margin: 0 auto; background-color: white; }
            .header { background: linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%); padding: 40px 20px; text-align: center; }
            .logo { width: 60px; height: 60px; background: rgba(255,255,255,0.2); border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 24px; margin-bottom: 20px; }
            .header h1 { color: white; margin: 0; font-size: 28px; font-weight: 600; }
            .content { padding: 40px 20px; }
            .content h2 { color: #1a1a1a; margin-bottom: 20px; }
            .content p { color: #4a5568; line-height: 1.6; margin-bottom: 20px; }
            .highlight { background: #faf5ff; border-left: 4px solid #8b5cf6; padding: 16px; margin: 20px 0; border-radius: 4px; }
            .members-list { background: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0; }
            .members-list ul { margin: 0; padding-left: 20px; }
            .members-list li { margin-bottom: 8px; color: #374151; }
            .cta { background: #8b5cf6; color: white; padding: 16px 24px; border-radius: 8px; text-align: center; margin: 30px 0; text-decoration: none; display: block; font-weight: bold; }
            .footer { background: #f8fafc; padding: 20px; text-align: center; color: #718096; font-size: 14px; }
            ${testMode ? '.test-banner { background: #fef3c7; border: 2px solid #f59e0b; padding: 12px; text-align: center; color: #92400e; font-weight: bold; }' : ''}
          </style>
        </head>
        <body>
          ${testMode ? '<div class="test-banner">🧪 THIS IS A TEST EMAIL - No real group has been formed</div>' : ''}
          <div class="container">
            <div class="header">
              <div class="logo">DC</div>
              <h1>Meet Your Group!</h1>
            </div>
            
            <div class="content">
              <h2>Welcome to ${groupName}! 🎉</h2>
              
              <p>Great news! We've matched you with other dads in your area who are at a similar stage in their parenting journey.</p>
              
              <div class="highlight">
                <strong>Your Group Members:</strong><br>
                You've been matched based on your location and where you are in your parenting journey. Here's who you'll be connecting with:
              </div>
              
              <div class="members-list">
                <h3 style="margin-top: 0; color: #374151;">Group Members:</h3>
                <ul>
                  ${membersList}
                </ul>
              </div>
              
              <p><strong>What's next?</strong></p>
              <ul>
                <li>Reply all to this email to introduce yourself to the group</li>
                <li>Share a bit about yourself and what you're looking forward to</li>
                <li>Start planning your first meetup or playdate</li>
                <li>Exchange contact information if you'd like</li>
              </ul>
              
              <div class="cta">
                Reply All to Say Hi! 👋
              </div>
              
              <p>We're excited to see the connections you'll make. Remember, this is just the beginning - your group can grow and evolve as you get to know each other.</p>
              
              <p>If you have any questions or need support, just reply to this email.</p>
              
              <p><strong>The DadCircles Team</strong></p>
            </div>
            
            <div class="footer">
              <p>DadCircles - Connecting fathers, building community</p>
              <p>Questions? Just reply to this email - we're here to help!</p>
            </div>
          </div>
        </body>
        </html>
      `,
    };
  }

  /**
   * Send group introduction email to all members
   */
  static async sendGroupIntroductionEmail(
    groupName: string,
    members: Array<{ email: string; name: string; childInfo: string }>,
    testMode: boolean = false
  ): Promise<{ success: boolean; emailedMembers: string[] }> {
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
      const template = this.generateGroupIntroductionEmail(
        groupName,
        members.map(m => ({ name: m.name, childInfo: m.childInfo })),
        testMode
      );

      logger.info("✉️ Email template generated successfully", {
        subject: template.subject,
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

          if (testMode || !resend) {
            // In test mode or without Resend, just log
            logger.info("📧 SIMULATED GROUP EMAIL", {
              to: member.email,
              groupName,
              testMode,
              reason: testMode ? 'test mode' : 'no resend configured'
            });
            emailedMembers.push(member.email);
          } else {
            // Send real email
            logger.info("🚀 Sending real email via Resend", {
              to: member.email,
              groupName
            });
            
            const success = await this.sendEmail(memberTemplate);
            if (success) {
              emailedMembers.push(member.email);
              logger.info("✅ Group introduction email sent successfully", {
                to: member.email,
                groupName
              });
            } else {
              logger.error("❌ Failed to send group introduction email", {
                to: member.email,
                groupName
              });
            }
          }
        } catch (memberError) {
          logger.error("❌ Error sending group email to individual member", {
            email: member.email,
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
