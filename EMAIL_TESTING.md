# Email Testing & Simulation Guide

This document describes how to test email functionality in the DadCircles development environment.

## 🚀 Overview

In the development environment (using `npm run dev:full`), the application prevents accidental real email sending by default. Instead, it uses a **Simulation Mode** that intercepts email requests and logs them to the console with full details.

## 🛠 Configuration

The behavior is controlled by environment variables in your `.env` file and the logic in `functions/src/emailService.ts`.

### 1. Simulated Mode (Default)
By default, if you are running locally (Emulator) OR if you do not have a valid `RESEND_API_KEY` configured, emails will be simulated.

**What happens:**
- No email is sent to Resend.
- A "SIMULATED EMAIL DISPATCHED" block is printed to your functions logs.
- The functions return `success: true` to the caller, allowing the app flow to proceed (e.g., updating database status).

### 2. Forcing Real Emails in Dev
If you want to send *real* emails from your local environment (e.g., to test the actual Resend integration), add the following flag to your `.env` file:

```bash
SEND_REAL_EMAILS=true
RESEND_API_KEY=your_actual_api_key
```

**⚠️ Warning:** This will send actual emails to the recipients specified. Use with caution.

## 📝 Viewing Simulated Emails

When an email is simulated, check your terminal output (where `npm run dev:full` is running). You will see a structured log entry like this:

```
==================================================
📧 SIMULATED EMAIL DISPATCHED
==================================================
To:      user@example.com
From:    DadCircles <noreply@dadcircles.com>
Subject: Welcome to DadCircles! 🎉
Reason:  Emulator Mode (Real Emails Disabled)
--------------------------------------------------
BODY PREVIEW:
<!DOCTYPE html>... (HTML content snippet)
==================================================
```

## 🧪 Testing Workflows

### 1. Test Welcome Email
1. Go to the Landing Page (http://localhost:3000).
2. Sign up with a new email address.
3. Check the terminal for the "Welcome" email log.
4. Verify in the Firestore Emulator UI (http://127.0.0.1:4004/firestore) that the lead document has `welcomeEmailSent: true`.

### 2. Test Group Introduction Email (Admin)
1. Go to the Admin Dashboard.
2. Run the Matching Algorithm (or use "Run Test Match").
3. Approve a pending group.
4. Check the terminal for "Meet Your DadCircles Group" email logs for each member.

## 🔧 Troubleshooting

- **"RESEND_API_KEY not configured"**: This warning is normal in dev if you haven't set the key. Email simulation will takeover automatically.
- **Logs not appearing**: Ensure you are looking at the `npm run dev:full` output or `firebase-emulator.log`.
