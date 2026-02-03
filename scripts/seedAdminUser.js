#!/usr/bin/env node

/**
 * Seed Admin User Script
 * 
 * This script creates an admin user in Firebase Auth emulator on server start.
 * It reads credentials from environment variables and creates a user with display name "admin".
 * 
 * Usage: node scripts/seedAdminUser.js
 */

import admin from 'firebase-admin';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const PRIMARY_ADMIN_EMAIL = process.env.PRIMARY_ADMIN_EMAIL;
const PRIMARY_ADMIN_PASSWORD = process.env.PRIMARY_ADMIN_PASSWORD;

// Validate environment variables
if (!PRIMARY_ADMIN_EMAIL || !PRIMARY_ADMIN_PASSWORD) {
    console.log('⚠️  Admin credentials not found in .env file. Skipping admin user seeding.');
    console.log('   Set PRIMARY_ADMIN_EMAIL and PRIMARY_ADMIN_PASSWORD to enable automatic admin seeding.');
    process.exit(0);
}

// Initialize Firebase Admin SDK for emulator
if (!admin.apps.length) {
    admin.initializeApp({
        projectId: 'dad-circles',
    });
}

// Connect to Auth emulator
process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';

async function waitForEmulator(maxRetries = 30, delayMs = 1000) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            // Try to list users to check if emulator is ready
            await admin.auth().listUsers(1);
            console.log('   Auth emulator is ready!');
            return true;
        } catch (error) {
            if (i < maxRetries - 1) {
                if (i === 0 || i % 5 === 0) {
                    console.log(`   Waiting for Auth emulator... (attempt ${i + 1}/${maxRetries})`);
                }
                await new Promise(resolve => setTimeout(resolve, delayMs));
            }
        }
    }
    throw new Error(`Auth emulator did not become ready after ${maxRetries} attempts`);
}

async function seedAdminUser() {
    try {
        console.log('🔐 Seeding admin user...');

        // Wait for emulator to be ready
        await waitForEmulator();

        // Check if user already exists
        let userRecord;
        try {
            userRecord = await admin.auth().getUserByEmail(PRIMARY_ADMIN_EMAIL);
            console.log(`✅ Admin user already exists: ${PRIMARY_ADMIN_EMAIL}`);

            //Update display name if needed
            if (userRecord.displayName !== 'admin') {
                await admin.auth().updateUser(userRecord.uid, {
                    displayName: 'admin',
                });
                console.log('   Updated display name to "admin"');
            }
        } catch (error) {
            // User doesn't exist, create it
            if (error.code === 'auth/user-not-found') {
                userRecord = await admin.auth().createUser({
                    email: PRIMARY_ADMIN_EMAIL,
                    password: PRIMARY_ADMIN_PASSWORD,
                    displayName: 'admin',
                    emailVerified: true,
                });

                console.log(`✅ Admin user created successfully!`);
                console.log(`   Email: ${PRIMARY_ADMIN_EMAIL}`);
                console.log(`   Display Name: admin`);
                console.log(`   UID: ${userRecord.uid}`);
            } else {
                throw error;
            }
        }

        // Ensure admin custom claim is set for Firestore rules
        const hasAdminClaim = userRecord.customClaims?.admin === true;
        if (!hasAdminClaim) {
            await admin.auth().setCustomUserClaims(userRecord.uid, { admin: true });
            console.log('   Set custom claim admin=true');
        }
    } catch (error) {
        console.error('❌ Error seeding admin user:', error.message);
        process.exit(1);
    }
}

// Run the seeding function
seedAdminUser()
    .then(() => {
        console.log('🎉 Admin user seeding complete!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Fatal error:', error);
        process.exit(1);
    });
