
import { db } from '../firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { Group } from '../types';

const groupsCol = collection(db, 'groups');

export const createGroup = async (group: Omit<Group, 'group_id' | 'created_at'>): Promise<Group> => {
    const groupId = `group-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    const newGroup: Group = {
      ...group,
      group_id: groupId,
      created_at: serverTimestamp() as any,
    };
    const ref = doc(groupsCol, groupId);
    await setDoc(ref, newGroup);
    return newGroup;
};

export const getGroup = async (groupId: string): Promise<Group | undefined> => {
    const ref = doc(groupsCol, groupId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return undefined;
    return snap.data() as Group;
};

export const getAllGroups = async (): Promise<Group[]> => {
    const q = query(groupsCol, orderBy('created_at', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as Group);
};

export const getGroupsByLocation = async (city: string, stateCode: string): Promise<Group[]> => {
    const q = query(
      groupsCol,
      where('location.city', '==', city),
      where('location.state_code', '==', stateCode),
      orderBy('created_at', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as Group);
};

export const updateGroup = async (groupId: string, updates: Partial<Group>): Promise<Group> => {
    const ref = doc(groupsCol, groupId);
    await setDoc(ref, updates, { merge: true });
    const snap = await getDoc(ref);
    return snap.data() as Group;
};
