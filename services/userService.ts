
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
  serverTimestamp,
  deleteDoc,
  writeBatch,
} from 'firebase/firestore';
import { UserProfile, OnboardingStep } from '../types';
import { getGroup, updateGroup } from './groupService';
import { deleteLeadsForUser } from './leadService';

const profilesCol = collection(db, 'profiles');
const messagesCol = collection(db, 'messages');

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
    children_complete: false,
    last_updated: serverTimestamp() as any,
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
    last_updated: serverTimestamp() as any,
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
      last_updated: serverTimestamp() as any,
    };

    if (groupId) {
      updates.matched_at = serverTimestamp() as any;
    } else {
      updates.matched_at = undefined;
    }

    await setDoc(ref, updates, { merge: true });
};

export const deleteUserData = async (sessionId: string): Promise<void> => {
  const profile = await getProfile(sessionId);
  if (!profile) return;

  if (profile.group_id) {
    const group = await getGroup(profile.group_id);
    if (group) {
      const updatedMemberIds = group.member_ids.filter((id) => id !== sessionId);
      const updatedMemberEmails = profile.email
        ? group.member_emails.filter((email) => email !== profile.email)
        : group.member_emails;
      const updatedEmailedMemberIds = group.emailed_member_ids.filter((id) => id !== sessionId);

      await updateGroup(profile.group_id, {
        member_ids: updatedMemberIds,
        member_emails: updatedMemberEmails,
        emailed_member_ids: updatedEmailedMemberIds,
      });
    }
  }

  await deleteLeadsForUser(profile.email, sessionId);

  const messagesQuery = query(messagesCol, where('session_id', '==', sessionId));
  const messagesSnap = await getDocs(messagesQuery);
  let batch = writeBatch(db);
  let count = 0;

  for (const docSnap of messagesSnap.docs) {
    batch.delete(docSnap.ref);
    count += 1;
    if (count >= 450) {
      await batch.commit();
      batch = writeBatch(db);
      count = 0;
    }
  }

  if (count > 0) {
    await batch.commit();
  }

  await deleteDoc(doc(profilesCol, sessionId));
};
