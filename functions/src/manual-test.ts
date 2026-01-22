/**
 * Manual test function to verify Resend integration
 * Call this function directly to test email sending
 */

import { onRequest } from "firebase-functions/v2/https";
import { EmailService } from "./emailService";

export const manualEmailTest = onRequest(async (req, res) => {
  try {
    console.log("Manual email test triggered");
    
    // Generate test email
    const testEmail = EmailService.generateWelcomeEmail(
      "djesushnnh@gmail.com", 
      "SW1A 1AA"
    );
    
    // Send email
    const success = await EmailService.sendEmail(testEmail);
    
    if (success) {
      res.json({ 
        success: true, 
        message: "Test email sent successfully!",
        to: "djesushnnh@gmail.com"
      });
    } else {
      res.json({ 
        success: false, 
        message: "Failed to send test email"
      });
    }
    
  } catch (error) {
    console.error("Manual test error:", error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});