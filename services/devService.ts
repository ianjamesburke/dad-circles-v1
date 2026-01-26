
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';
import { db } from '../firebase';
import {
    collection,
    query,
    getDocs,
    writeBatch,
    where,
  } from 'firebase/firestore';
import { UserProfile } from '../types';

const profilesCol = collection(db, 'profiles');
const groupsCol = collection(db, 'groups');

export const seedTestData = async (): Promise<void> => {
    try {
      const seedDataFn = httpsCallable(functions, 'seedData');
      const result = await seedDataFn();
      if (import.meta.env.DEV) console.log('✅ Seed data result:', result.data);
    } catch (error) {
      console.error('❌ Error seeding data:', error);
      throw error;
    }
};

export const resetDatabase = async (): Promise<void> => {
    if (import.meta.env.PROD) {
      console.warn('Reset disabled in production');
      return;
    }

    // Note: In a real app, you'd want to batch delete documents
    // For now, this is just a placeholder
    if (import.meta.env.DEV) console.log('Reset database (implement batch delete for emulator use)');
};

export const cleanTestData = async (): Promise<void> => {
    if (import.meta.env.PROD) {
      console.warn('Clean test data disabled in production');
      return;
    }

    const batch = writeBatch(db);

    // Delete test users (session_id starts with "test-")
    const testUsersQuery = query(profilesCol);
    const testUsersSnap = await getDocs(testUsersQuery);

    testUsersSnap.docs.forEach(doc => {
      const data = doc.data() as UserProfile;
      if (data.session_id.startsWith('test-')) {
        batch.delete(doc.ref);
      }
    });

    // Delete test groups
    // In V1 spec, test groups might not have test_mode=true anymore if we just ran matching
    // But we still want to clean up groups that look like test groups if possible.
    // For now, let's keep the logic of deleting groups that have test_mode=true (legacy)
    // AND maybe groups created by test run?
    // Actually, cleanTestData is mostly for dev cleanup.
    // Let's just stick to deleting test_mode=true for now, or maybe delete all groups?
    // The previous implementation only deleted test_mode=true groups.
    const testGroupsQuery = query(groupsCol, where('test_mode', '==', true));
    const testGroupsSnap = await getDocs(testGroupsQuery);

    testGroupsSnap.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    if (import.meta.env.DEV) console.log('Cleaned test data from Firestore');
};
