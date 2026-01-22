import { db } from './firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  query,
  where,
  orderBy,
  writeBatch,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';
import { UserProfile, Message, OnboardingStep, Role, Lead, Group, MatchingStats, LifeStage } from './types';

// Firestore collections
const profilesCol = collection(db, 'profiles');
const messagesCol = collection(db, 'messages');
const leadsCol = collection(db, 'leads');
const groupsCol = collection(db, 'groups');

interface DatabaseInterface {
  // Profiles
  getProfile: (sessionId: string) => Promise<UserProfile | undefined>;
  createProfile: (sessionId: string, email?: string, postcode?: string) => Promise<UserProfile>;
  updateProfile: (sessionId: string, updates: Partial<UserProfile>) => Promise<UserProfile>;
  getAllProfiles: () => Promise<UserProfile[]>;

  // Messages
  addMessage: (msg: Omit<Message, 'id' | 'timestamp'>) => Promise<Message>;
  getMessages: (sessionId: string) => Promise<Message[]>;
  getAllMessages: () => Promise<Message[]>;

  // Leads
  addLead: (lead: Omit<Lead, 'id' | 'timestamp'>) => Promise<Lead>;
  getAllLeads: () => Promise<Lead[]>;
  getLeadByEmail: (email: string) => Promise<Lead | undefined>;
  updateLead: (leadId: string, updates: Partial<Lead>) => Promise<Lead>;

  // Groups
  createGroup: (group: Omit<Group, 'group_id' | 'created_at'>) => Promise<Group>;
  getGroup: (groupId: string) => Promise<Group | undefined>;
  getAllGroups: () => Promise<Group[]>;
  getGroupsByLocation: (city: string, stateCode: string) => Promise<Group[]>;
  updateGroup: (groupId: string, updates: Partial<Group>) => Promise<Group>;

  // Matching
  getUnmatchedUsers: (city?: string, stateCode?: string) => Promise<UserProfile[]>;
  getUsersInGroup: (groupId: string) => Promise<UserProfile[]>;
  updateUserGroupAssignment: (sessionId: string, groupId: string | null) => Promise<void>;
  getMatchingStats: () => Promise<MatchingStats>;

  // Database management (dev/emulator only)
  // Database management (dev/emulator only)
  seedTestData?: () => Promise<void>;
  resetDatabase?: () => Promise<void>;
  cleanTestData?: () => Promise<void>;

  // Functions
  runMatchingAlgorithm: () => Promise<any>;
  approveGroup: (groupId: string) => Promise<any>;
  deleteGroup: (groupId: string) => Promise<any>;
}

export const database: DatabaseInterface = {
  // Profile operations
  getProfile: async (sessionId: string): Promise<UserProfile | undefined> => {
    const ref = doc(profilesCol, sessionId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return undefined;
    return snap.data() as UserProfile;
  },

  createProfile: async (sessionId: string, email?: string, postcode?: string): Promise<UserProfile> => {
    const newProfile: UserProfile = {
      session_id: sessionId,
      ...(email && { email: email.toLowerCase() }), // Store email in lowercase for consistency
      ...(postcode && { postcode: postcode.trim() }), // Store postcode
      onboarded: false,
      onboarding_step: OnboardingStep.WELCOME,
      children: [],
      last_updated: Date.now(),
      matching_eligible: false, // Default to false until onboarding is complete
    };
    const ref = doc(profilesCol, sessionId);
    await setDoc(ref, newProfile);
    return newProfile;
  },

  updateProfile: async (sessionId: string, updates: Partial<UserProfile>): Promise<UserProfile> => {
    const existing = (await database.getProfile(sessionId)) ??
      (await database.createProfile(sessionId));
    const updated: UserProfile = {
      ...existing,
      ...updates,
      last_updated: Date.now(),
    };
    const ref = doc(profilesCol, sessionId);
    await setDoc(ref, updated, { merge: true });
    return updated;
  },

  getAllProfiles: async (): Promise<UserProfile[]> => {
    const q = query(profilesCol, orderBy('last_updated', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as UserProfile);
  },

  // Message operations
  addMessage: async (msg: Omit<Message, 'id' | 'timestamp'>): Promise<Message> => {
    const withTimestamp = {
      ...msg,
      timestamp: Date.now(),
    };
    const docRef = await addDoc(messagesCol, withTimestamp);
    const newMessage: Message = {
      ...withTimestamp,
      id: docRef.id,
    };
    await setDoc(doc(messagesCol, docRef.id), newMessage);
    return newMessage;
  },

  getMessages: async (sessionId: string): Promise<Message[]> => {
    const q = query(
      messagesCol,
      where('session_id', '==', sessionId),
      orderBy('timestamp', 'asc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as Message);
  },

  getAllMessages: async (): Promise<Message[]> => {
    const q = query(messagesCol, orderBy('timestamp', 'asc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as Message);
  },

  // Lead operations
  addLead: async (lead: Omit<Lead, 'id' | 'timestamp'>): Promise<Lead> => {
    const withTimestamp = {
      ...lead,
      timestamp: Date.now(),
    };
    const docRef = await addDoc(leadsCol, withTimestamp);
    const newLead: Lead = {
      ...withTimestamp,
      id: docRef.id,
    };
    await setDoc(doc(leadsCol, docRef.id), newLead);
    return newLead;
  },

  getAllLeads: async (): Promise<Lead[]> => {
    const q = query(leadsCol, orderBy('timestamp', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as Lead);
  },

  getLeadByEmail: async (email: string): Promise<Lead | undefined> => {
    const q = query(leadsCol, where('email', '==', email.toLowerCase()));
    const snap = await getDocs(q);
    if (snap.empty) return undefined;
    return snap.docs[0].data() as Lead;
  },

  updateLead: async (leadId: string, updates: Partial<Lead>): Promise<Lead> => {
    const ref = doc(leadsCol, leadId);
    await setDoc(ref, updates, { merge: true });
    const snap = await getDoc(ref);
    return snap.data() as Lead;
  },

  // Group operations
  createGroup: async (group: Omit<Group, 'group_id' | 'created_at'>): Promise<Group> => {
    const groupId = `group-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newGroup: Group = {
      ...group,
      group_id: groupId,
      created_at: Date.now(),
    };
    const ref = doc(groupsCol, groupId);
    await setDoc(ref, newGroup);
    return newGroup;
  },

  getGroup: async (groupId: string): Promise<Group | undefined> => {
    const ref = doc(groupsCol, groupId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return undefined;
    return snap.data() as Group;
  },

  getAllGroups: async (): Promise<Group[]> => {
    const q = query(groupsCol, orderBy('created_at', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as Group);
  },

  getGroupsByLocation: async (city: string, stateCode: string): Promise<Group[]> => {
    const q = query(
      groupsCol,
      where('location.city', '==', city),
      where('location.state_code', '==', stateCode),
      orderBy('created_at', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as Group);
  },

  updateGroup: async (groupId: string, updates: Partial<Group>): Promise<Group> => {
    const ref = doc(groupsCol, groupId);
    await setDoc(ref, updates, { merge: true });
    const snap = await getDoc(ref);
    return snap.data() as Group;
  },

  // Matching operations
  getUnmatchedUsers: async (city?: string, stateCode?: string): Promise<UserProfile[]> => {
    try {
      // Get all eligible users first, then filter in JavaScript for better reliability
      let baseQuery = query(
        profilesCol,
        where('matching_eligible', '==', true)
      );

      // Add location filter if specified
      if (city && stateCode) {
        baseQuery = query(
          profilesCol,
          where('matching_eligible', '==', true),
          where('location.city', '==', city),
          where('location.state_code', '==', stateCode)
        );
      }

      const snapshot = await getDocs(baseQuery);
      const eligibleUsers = snapshot.docs.map(doc => doc.data() as UserProfile);

      // Filter out users that have a group_id (handles both null and undefined)
      const unmatchedUsers = eligibleUsers.filter(user => !user.group_id);

      if (import.meta.env.DEV) {
        console.log(`📊 getUnmatchedUsers: ${eligibleUsers.length} eligible, ${unmatchedUsers.length} unmatched${city ? ` in ${city}, ${stateCode}` : ''}`);
      }

      return unmatchedUsers;
    } catch (error) {
      console.error('❌ Error in getUnmatchedUsers:', error);
      throw new Error(`Failed to get unmatched users: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },

  getUsersInGroup: async (groupId: string): Promise<UserProfile[]> => {
    const q = query(profilesCol, where('group_id', '==', groupId));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as UserProfile);
  },

  updateUserGroupAssignment: async (sessionId: string, groupId: string | null): Promise<void> => {
    const ref = doc(profilesCol, sessionId);
    const updates: Partial<UserProfile> = {
      group_id: groupId ?? undefined,
      last_updated: Date.now(),
    };

    if (groupId) {
      updates.matched_at = Date.now();
    } else {
      updates.matched_at = undefined;
    }

    await setDoc(ref, updates, { merge: true });
  },

  getMatchingStats: async (): Promise<MatchingStats> => {
    const allProfiles = await database.getAllProfiles();
    const eligibleUsers = allProfiles.filter(p => p.matching_eligible);
    const matchedUsers = eligibleUsers.filter(p => p.group_id);
    const unmatchedUsers = eligibleUsers.filter(p => !p.group_id);

    const byLocation: Record<string, any> = {};

    for (const user of eligibleUsers) {
      if (!user.location) continue;

      const locationKey = `${user.location.city}, ${user.location.state_code}`;
      if (!byLocation[locationKey]) {
        byLocation[locationKey] = {
          total: 0,
          matched: 0,
          unmatched: 0,
          by_life_stage: {
            [LifeStage.EXPECTING]: 0,
            [LifeStage.NEWBORN]: 0,
            [LifeStage.INFANT]: 0,
            [LifeStage.TODDLER]: 0,
          }
        };
      }

      byLocation[locationKey].total++;
      if (user.group_id) {
        byLocation[locationKey].matched++;
      } else {
        byLocation[locationKey].unmatched++;
      }

      // Count by life stage
      const lifeStage = getLifeStageFromUser(user);
      if (lifeStage) {
        byLocation[locationKey].by_life_stage[lifeStage]++;
      }
    }

    return {
      total_users: eligibleUsers.length,
      matched_users: matchedUsers.length,
      unmatched_users: unmatchedUsers.length,
      by_location: byLocation,
    };
  },

  // Development/testing methods (only use with emulator)
  seedTestData: async (): Promise<void> => {
    try {
      const seedDataFn = httpsCallable(functions, 'seedData');
      const result = await seedDataFn();
      if (import.meta.env.DEV) console.log('✅ Seed data result:', result.data);
    } catch (error) {
      console.error('❌ Error seeding data:', error);
      throw error;
    }
  },

  resetDatabase: async (): Promise<void> => {
    if (import.meta.env.PROD) {
      console.warn('Reset disabled in production');
      return;
    }

    // Note: In a real app, you'd want to batch delete documents
    // For now, this is just a placeholder
    if (import.meta.env.DEV) console.log('Reset database (implement batch delete for emulator use)');
  },

  cleanTestData: async (): Promise<void> => {
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
  },

  runMatchingAlgorithm: async (): Promise<any> => {
    try {
      const runMatchingFn = httpsCallable(functions, 'runMatching');
      // No longer passing testMode per V1 spec
      const result = await runMatchingFn({});
      return result.data;
    } catch (error) {
      console.error('❌ Error running matching algorithm:', error);
      throw error;
    }
  },

  approveGroup: async (groupId: string): Promise<any> => {
    try {
      const approveGroupFn = httpsCallable(functions, 'approveGroup');
      const result = await approveGroupFn({ groupId });
      return result.data;
    } catch (error) {
      console.error('❌ Error approving group:', error);
      throw error;
    }
  },

  deleteGroup: async (groupId: string): Promise<any> => {
    try {
      const deleteGroupFn = httpsCallable(functions, 'deleteGroup');
      const result = await deleteGroupFn({ groupId });
      return result.data;
    } catch (error) {
      console.error('❌ Error deleting group:', error);
      throw error;
    }
  }
};

// Helper function to determine life stage from user profile
function getLifeStageFromUser(user: UserProfile): LifeStage | null {
  if (!user.children || user.children.length === 0) return null;

  const primaryChild = user.children[0]; // Use first child for life stage
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // JavaScript months are 0-indexed

  if (primaryChild.type === 'expecting') {
    return LifeStage.EXPECTING;
  }

  // Calculate age in months
  const birthYear = primaryChild.birth_year;
  const birthMonth = primaryChild.birth_month;
  const ageInMonths = (currentYear - birthYear) * 12 + (currentMonth - birthMonth);

  if (ageInMonths <= 6) {
    return LifeStage.NEWBORN;
  } else if (ageInMonths <= 18) {
    return LifeStage.INFANT;
  } else if (ageInMonths <= 36) {
    return LifeStage.TODDLER;
  }

  return null; // Child is too old for our current matching system
}

// Export helper function for use in other modules
export { getLifeStageFromUser };