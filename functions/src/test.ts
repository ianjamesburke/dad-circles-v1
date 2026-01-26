/**
 * Simple test script to validate our email service
 * Run with: npx ts-node src/test.ts
 */

import {EmailService, EMAIL_TEMPLATES} from "./emailService";

async function testEmailService() {
  console.log("🧪 Testing Email Service (Templates)...\n");

  // Test 1: Send welcome email template
  console.log("1. Testing welcome email template sending...");
  const welcomeEmail = {
    to: "test@example.com",
    templateId: EMAIL_TEMPLATES.WELCOME_COMPLETED,
    variables: {
        location: "London, UK"
    }
  };

  const success1 = await EmailService.sendTemplateEmail(welcomeEmail, true); // force simulation

  if (success1) {
    console.log("✅ Welcome email template simulated successfully\n");
  } else {
    console.log("❌ Welcome email template failed\n");
  }

  // Test 2: Send follow-up email template
  console.log("2. Testing follow-up email template sending...");
  const followUpEmail = {
    to: "test@example.com",
    templateId: EMAIL_TEMPLATES.FOLLOWUP_3DAY,
    variables: {
        location: "London, UK"
    }
  };

  const success2 = await EmailService.sendTemplateEmail(followUpEmail, true); // force simulation

  if (success2) {
    console.log("✅ Follow-up email template simulated successfully\n");
  } else {
    console.log("❌ Follow-up email template failed\n");
  }

  console.log("🎉 All tests completed!");
}

// Run the test
testEmailService().catch(console.error);
