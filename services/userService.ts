
import { db } from '../firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  query,
  orderBy,
  where,
} from 'firebase/firestore';
import { UserProfile, OnboardingStep } from '../types';

const profilesCol = collection(db, 'profiles');

export const getProfile = async (sessionId: string): Promise<UserProfile | undefined> => {
  const ref = doc(profilesCol, sessionId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return undefined;
  return snap.data() as UserProfile;
};

export const createProfile = async (sessionId: string, email?: string, postcode?: string): Promise<UserProfile> => {
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
};

export const updateProfile = async (sessionId: string, updates: Partial<UserProfile>): Promise<UserProfile> => {
  const existing = (await getProfile(sessionId)) ??
    (await createProfile(sessionId));
  const updated: UserProfile = {
    ...existing,
    ...updates,
    last_updated: Date.now(),
  };
  const ref = doc(profilesCol, sessionId);
  await setDoc(ref, updated, { merge: true });
  return updated;
};

export const getAllProfiles = async (): Promise<UserProfile[]> => {
  const q = query(profilesCol, orderBy('last_updated', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data() as UserProfile);
};

export const getUsersInGroup = async (groupId: string): Promise<UserProfile[]> => {
    const q = query(profilesCol, where('group_id', '==', groupId));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as UserProfile);
};

export const updateUserGroupAssignment = async (sessionId: string, groupId: string | null): Promise<void> => {
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
};
