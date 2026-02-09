#!/usr/bin/env node

/**
 * Set admin custom claims for Firebase Auth users (production).
 *
 * Usage:
 *   node scripts/setAdminClaim.js <uid-or-email> [more...]
 *
 * Examples:
 *   node scripts/setAdminClaim.js abcd1234efgh5678
 *   node scripts/setAdminClaim.js admin1@example.com admin2@example.com
 *   node scripts/setAdminClaim.js abcd1234efgh5678 admin@example.com
 *
 * Auth:
 *   export GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccount.json
 */

import admin from 'firebase-admin';

const inputs = process.argv.slice(2).filter(Boolean);

if (inputs.length === 0) {
  console.error('Usage: node scripts/setAdminClaim.js <uid-or-email> [more...]');
  process.exit(1);
}

if (!admin.apps.length) {
  admin.initializeApp();
}

const isEmail = (value) => /@/.test(value);

async function resolveUser(input) {
  if (isEmail(input)) {
    return admin.auth().getUserByEmail(input);
  }
  return admin.auth().getUser(input);
}

async function setAdminClaim(userRecord) {
  const current = userRecord.customClaims || {};
  if (current.admin === true) {
    console.log(`✅ ${userRecord.uid} already has admin=true`);
    return;
  }
  await admin.auth().setCustomUserClaims(userRecord.uid, {
    ...current,
    admin: true,
  });
  console.log(`✅ Set admin=true for ${userRecord.uid}`);
}

async function run() {
  for (const input of inputs) {
    try {
      const user = await resolveUser(input);
      await setAdminClaim(user);
    } catch (error) {
      console.error(`❌ Failed for ${input}: ${error.message || error}`);
    }
  }
  console.log('Done. Users must sign out/in (or refresh token) to receive new claims.');
}

run().catch((error) => {
  console.error('❌ Fatal error:', error.message || error);
  process.exit(1);
});
