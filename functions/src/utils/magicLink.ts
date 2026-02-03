import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import crypto from 'crypto';
import { CONFIG } from '../config';
import { logger } from '../logger';

const COLLECTION = 'magic_links';

const hashToken = (token: string): string =>
  crypto.createHash('sha256').update(token).digest('hex');

export const createMagicLinkToken = async (
  sessionId: string,
  email?: string
): Promise<string> => {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(token);
  const now = Date.now();
  const expiresAt = now + CONFIG.security.magicLinkTokenTtlMs;

  await admin.firestore().collection(COLLECTION).doc(tokenHash).set({
    session_id: sessionId,
    email: email?.toLowerCase(),
    created_at: FieldValue.serverTimestamp(),
    expires_at_ms: expiresAt,
    used: false,
  });

  return token;
};

export const redeemMagicLinkToken = async (token: string): Promise<{
  sessionId: string;
  email?: string;
}> => {
  const tokenHash = hashToken(token);
  const docRef = admin.firestore().collection(COLLECTION).doc(tokenHash);
  const now = Date.now();

  const result = await admin.firestore().runTransaction(async (tx) => {
    const snap = await tx.get(docRef);
    if (!snap.exists) {
      throw new Error('Magic link not found');
    }

    const data = snap.data() as {
      session_id: string;
      email?: string;
      expires_at_ms?: number;
      used?: boolean;
    };

    if (data.used) {
      throw new Error('Magic link already used');
    }

    if (data.expires_at_ms && data.expires_at_ms < now) {
      throw new Error('Magic link expired');
    }

    tx.update(docRef, {
      used: true,
      used_at: FieldValue.serverTimestamp(),
    });

    return { sessionId: data.session_id, email: data.email };
  });

  logger.info('Magic link redeemed', { sessionId: result.sessionId });
  return result;
};
