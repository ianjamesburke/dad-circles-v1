/**
 * Simple test script to validate our email service
 * Run with: npx ts-node src/test.ts
 */

import {EmailService} from "./emailService";

async function testEmailService() {
  console.log("🧪 Testing Email Service...\n");

  // Test 1: Generate welcome email template
  console.log("1. Testing welcome email template generation...");
  const welcomeEmail = EmailService.generateWelcomeEmail("test@example.com", "SW1A 1AA");

  console.log("✅ Welcome email template generated:");
  console.log(`   To: ${welcomeEmail.to}`);
  console.log(`   Subject: ${welcomeEmail.subject}`);
  console.log(`   HTML length: ${welcomeEmail.html.length} characters\n`);

  // Test 2: Generate follow-up email template
  console.log("2. Testing follow-up email template generation...");
  const followUpEmail = EmailService.generateFollowUpEmail("test@example.com", "SW1A 1AA");

  console.log("✅ Follow-up email template generated:");
  console.log(`   To: ${followUpEmail.to}`);
  console.log(`   Subject: ${followUpEmail.subject}`);
  console.log(`   HTML length: ${followUpEmail.html.length} characters\n`);

  // Test 3: Test email sending (will be simulated since no API key)
  console.log("3. Testing email sending (simulated)...");
  const success = await EmailService.sendEmail(welcomeEmail);

  if (success) {
    console.log("✅ Email service working correctly (simulated)\n");
  } else {
    console.log("❌ Email service failed\n");
  }

  console.log("🎉 All tests completed!");
}

// Run the test
testEmailService().catch(console.error);
