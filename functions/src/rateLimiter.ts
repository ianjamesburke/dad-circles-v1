/**
 * Rate Limiter for Magic Link Requests
 * 
 * Prevents spam attacks by tracking and limiting magic link requests per email.
 * Uses Firestore as the rate limit store for simplicity and consistency.
 */

import * as admin from 'firebase-admin';
import { logger } from './logger';

interface RateLimitRecord {
  email: string;
  attempts: number;
  firstAttemptAt: number;
  lastAttemptAt: number;
  blockedUntil?: number;
}

export class RateLimiter {
  private static readonly COLLECTION = 'rate_limits';
  private static readonly WINDOW_MS = 60 * 60 * 1000; // 1 hour
  private static readonly MAX_ATTEMPTS = 3; // 3 attempts per hour
  private static readonly BLOCK_DURATION_MS = 60 * 60 * 1000; // Block for 1 hour

  /**
   * Check if a magic link request should be allowed for this email
   * Returns { allowed: boolean, reason?: string }
   */
  static async checkMagicLinkRequest(email: string): Promise<{ allowed: boolean; reason?: string }> {
    const db = admin.firestore();
    const normalizedEmail = email.toLowerCase();
    const now = Date.now();
    
    const docRef = db.collection(this.COLLECTION).doc(encodeURIComponent(normalizedEmail));
    
    try {
      const result = await db.runTransaction(async (transaction) => {
        const doc = await transaction.get(docRef);
        
        if (!doc.exists) {
          // First request - allow and create record
          const newRecord: RateLimitRecord = {
            email: normalizedEmail,
            attempts: 1,
            firstAttemptAt: now,
            lastAttemptAt: now,
          };
          transaction.set(docRef, newRecord);
          return { allowed: true };
        }
        
        const record = doc.data() as RateLimitRecord;
        
        // Check if currently blocked
        if (record.blockedUntil && record.blockedUntil > now) {
          const minutesLeft = Math.ceil((record.blockedUntil - now) / 60000);
          logger.warn('Rate limit block active', { email: normalizedEmail, minutesLeft });
          return { 
            allowed: false, 
            reason: `Too many requests. Please try again in ${minutesLeft} minute${minutesLeft > 1 ? 's' : ''}.` 
          };
        }
        
        // Check if window has expired - reset if so
        if (now - record.firstAttemptAt > this.WINDOW_MS) {
          const resetRecord: RateLimitRecord = {
            email: normalizedEmail,
            attempts: 1,
            firstAttemptAt: now,
            lastAttemptAt: now,
          };
          transaction.set(docRef, resetRecord);
          return { allowed: true };
        }
        
        // Within window - check attempt count
        if (record.attempts >= this.MAX_ATTEMPTS) {
          // Block the email
          const updatedRecord: RateLimitRecord = {
            ...record,
            attempts: record.attempts + 1,
            lastAttemptAt: now,
            blockedUntil: now + this.BLOCK_DURATION_MS,
          };
          transaction.set(docRef, updatedRecord);
          
          logger.warn('Rate limit exceeded - blocking email', { 
            email: normalizedEmail, 
            attempts: record.attempts + 1 
          });
          
          return { 
            allowed: false, 
            reason: 'Too many requests. Please try again in 1 hour.' 
          };
        }
        
        // Increment attempt count
        const updatedRecord: RateLimitRecord = {
          ...record,
          attempts: record.attempts + 1,
          lastAttemptAt: now,
        };
        transaction.set(docRef, updatedRecord);
        
        return { allowed: true };
      });
      
      return result;
    } catch (error) {
      logger.error('Rate limiter error', { email: normalizedEmail, error });
      
      // SECURITY: Fail-closed approach
      // We prioritize security over availability. If the rate limiter encounters an error,
      // we block the request rather than allowing it through. This prevents attackers from
      // bypassing rate limiting by triggering errors in the system.
      //
      // Trade-offs:
      // - Fail-closed (current): Prioritizes security. An attacker cannot bypass the limiter
      //   even if it's malfunctioning. However, legitimate users may be temporarily blocked
      //   if there's a bug in the rate limiter.
      // - Fail-open (alternative): Prioritizes availability. A bug in the rate limiter won't
      //   lock users out, but an attacker could potentially exploit the error to bypass
      //   rate limiting entirely.
      //
      // Given that this protects a security-sensitive magic link endpoint, we choose to
      // fail closed. If the rate limiter is broken, we'd rather temporarily block all
      // requests than allow unlimited spam/enumeration attacks.
      throw new Error('Rate limiter unavailable - request blocked for security');
    }
  }

  /**
   * Manually reset rate limit for an email (admin use)
   */
  static async resetEmail(email: string): Promise<void> {
    const db = admin.firestore();
    const normalizedEmail = email.toLowerCase();
    await db.collection(this.COLLECTION).doc(encodeURIComponent(normalizedEmail)).delete();
    logger.info('Rate limit reset', { email: normalizedEmail });
  }
}
