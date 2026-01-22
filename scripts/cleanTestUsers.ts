#!/usr/bin/env node

/**
 * Clean Test Users Script
 * 
 * Removes all test data from Firestore:
 * - Test users (session_id starts with "test-")
 * - Test groups (test_mode: true)
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator, collection, query, where, getDocs, writeBatch } from 'firebase/firestore';

// Firebase config for emulator
const firebaseConfig = {
  projectId: 'dad-circles',
  // Other config not needed for emulator
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Connect to emulator if running locally
if (process.env.NODE_ENV !== 'production') {
  try {
    connectFirestoreEmulator(db, 'localhost', 8083);
    console.log('🔧 Connected to Firestore emulator');
  } catch (error) {
    console.log('⚠️ Firestore emulator already connected or not available');
  }
}

const cleanTestUsers = async () => {
  console.log('🧹 Starting test data cleanup...');
  
  try {
    const batch = writeBatch(db);
    let deletedCount = 0;

    // Delete test users (session_id starts with "test-")
    console.log('🔍 Finding test users...');
    const profilesCol = collection(db, 'profiles');
    const allProfilesSnap = await getDocs(profilesCol);
    
    allProfilesSnap.docs.forEach(doc => {
      const data = doc.data();
      if (data.session_id && data.session_id.startsWith('test-')) {
        batch.delete(doc.ref);
        deletedCount++;
      }
    });

    console.log(`📝 Found ${deletedCount} test users to delete`);

    // Delete test groups (test_mode: true)
    console.log('🔍 Finding test groups...');
    const groupsCol = collection(db, 'groups');
    const testGroupsQuery = query(groupsCol, where('test_mode', '==', true));
    const testGroupsSnap = await getDocs(testGroupsQuery);
    
    testGroupsSnap.docs.forEach(doc => {
      batch.delete(doc.ref);
      deletedCount++;
    });

    console.log(`📝 Found ${testGroupsSnap.size} test groups to delete`);

    if (deletedCount === 0) {
      console.log('✨ No test data found to clean');
      return;
    }

    // Execute the batch delete
    console.log(`🗑️ Deleting ${deletedCount} test documents...`);
    await batch.commit();

    console.log(`🎉 Successfully cleaned ${deletedCount} test documents!`);
    console.log('✨ Database is now clean of test data');

  } catch (error) {
    console.error('❌ Error cleaning test data:', error);
    process.exit(1);
  }
};

// Run the cleanup if this script is executed directly
cleanTestUsers()
  .then(() => {
    console.log('✅ Cleanup complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Cleanup failed:', error);
    process.exit(1);
  });

export { cleanTestUsers };