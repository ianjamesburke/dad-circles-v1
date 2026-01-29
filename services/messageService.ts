
import { db } from '../firebase';
import {
  collection,
  addDoc,
  doc,
  getDocs,
  setDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { Message } from '../types';

const messagesCol = collection(db, 'messages');

export const addMessage = async (msg: Omit<Message, 'id' | 'timestamp'>): Promise<Message> => {
    const withTimestamp = {
      ...msg,
      timestamp: serverTimestamp() as any,
    };
    const docRef = await addDoc(messagesCol, withTimestamp);
    const newMessage: Message = {
      ...withTimestamp,
      id: docRef.id,
    };
    await setDoc(doc(messagesCol, docRef.id), newMessage);
    return newMessage;
};

export const getMessages = async (sessionId: string): Promise<Message[]> => {
    const q = query(
      messagesCol,
      where('session_id', '==', sessionId),
      orderBy('timestamp', 'asc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as Message);
};

export const getAllMessages = async (): Promise<Message[]> => {
    const q = query(messagesCol, orderBy('timestamp', 'asc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as Message);
};
