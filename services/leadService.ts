
import { db } from '../firebase';
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
  serverTimestamp,
  deleteDoc,
  writeBatch,
} from 'firebase/firestore';
import { Lead } from '../types';

const leadsCol = collection(db, 'leads');

export const addLead = async (lead: Omit<Lead, 'id' | 'timestamp'>): Promise<Lead> => {
    const withTimestamp = {
      ...lead,
      timestamp: serverTimestamp() as any,
    };
    const docRef = await addDoc(leadsCol, withTimestamp);
    const newLead: Lead = {
      ...withTimestamp,
      id: docRef.id,
    };
    await setDoc(doc(leadsCol, docRef.id), newLead);
    return newLead;
};

export const getAllLeads = async (): Promise<Lead[]> => {
    const q = query(leadsCol, orderBy('timestamp', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as Lead);
};

export const getLeadByEmail = async (email: string): Promise<Lead | undefined> => {
    const q = query(leadsCol, where('email', '==', email.toLowerCase()));
    const snap = await getDocs(q);
    if (snap.empty) return undefined;
    return snap.docs[0].data() as Lead;
};

export const updateLead = async (leadId: string, updates: Partial<Lead>): Promise<Lead> => {
    const ref = doc(leadsCol, leadId);
    await setDoc(ref, updates, { merge: true });
    const snap = await getDoc(ref);
    return snap.data() as Lead;
};

export const deleteLeadsForUser = async (email?: string, sessionId?: string): Promise<void> => {
    const deleteDocs = async (q: ReturnType<typeof query>) => {
      const snap = await getDocs(q);
      if (snap.empty) return;
      let batch = writeBatch(db);
      let count = 0;
      for (const docSnap of snap.docs) {
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
    };

    const tasks: Promise<void>[] = [];
    if (email) {
      tasks.push(deleteDocs(query(leadsCol, where('email', '==', email.toLowerCase()))));
    }
    if (sessionId) {
      tasks.push(deleteDocs(query(leadsCol, where('session_id', '==', sessionId))));
    }
    if (tasks.length > 0) {
      await Promise.all(tasks);
    }
};
