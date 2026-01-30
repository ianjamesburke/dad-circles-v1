/**
 * Rate Limiter - Unified Implementation
 * 
 * Generic rate limiting for all endpoints. Prevents spam attacks by tracking
 * and limiting requests per identifier. Uses Firestore as the rate limit store.
 */

import * as admin from 'firebase-admin';
import { logger } from './logger';
import { maskEmail } from './utils/pii';
import { CONFIG, RateLimitConfig } from './config';

interface RateLimitRecord {
  email: string; // Generic field name for consistency
  attempts: number;
  firstAttemptAt: number;
  lastAttemptAt: number;
  blockedUntil?: number;
}

export class RateLimiter {
  /**
   * Generic rate limiting check - used for all rate limiting
   * 
   * @param identifier - Unique identifier (email, session ID, etc.)
   * @param config - Rate limit configuration
   * @param maskFn - Optional function to mask identifier in logs
   * @returns Object with allowed flag and optional reason
   */
  private static async check(
    identifier: string,
    config: RateLimitConfig,
    maskFn?: (id: string) => string
  ): Promise<{ allowed: boolean; reason?: string }> {
    const db = admin.firestore();
    const now = Date.now();
    const docRef = db.collection(config.collection).doc(encodeURIComponent(identifier));
    
    try {
      const result = await db.runTransaction(async (transaction) => {
        const doc = await transaction.get(docRef);
        
        // First request - allow and create record
        if (!doc.exists) {
          const newRecord: RateLimitRecord = {
            email: identifier,
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
          const maskedId = maskFn ? maskFn(identifier) : identifier;
          logger.warn('Rate limit block active', { 
            identifier: maskedId, 
            minutesLeft 
          });
          return { 
            allowed: false, 
            reason: config.errorMessage(minutesLeft)
          };
        }
        
        // Check if window has expired - reset if so
        if (now - record.firstAttemptAt > config.windowMs) {
          const resetRecord: RateLimitRecord = {
            email: identifier,
            attempts: 1,
            firstAttemptAt: now,
            lastAttemptAt: now,
          };
          transaction.set(docRef, resetRecord);
          return { allowed: true };
        }
        
        // Within window - check attempt count
        if (record.attempts >= config.maxAttempts) {
          // Block the identifier
          const updatedRecord: RateLimitRecord = {
            ...record,
            attempts: record.attempts + 1,
            lastAttemptAt: now,
            blockedUntil: now + config.blockDurationMs,
          };
          transaction.set(docRef, updatedRecord);
          
          const maskedId = maskFn ? maskFn(identifier) : identifier;
          logger.warn('Rate limit exceeded - blocking', { 
            identifier: maskedId, 
            attempts: record.attempts + 1 
          });
          
          const blockMins = Math.ceil(config.blockDurationMs / 60000);
          return { 
            allowed: false, 
            reason: config.errorMessage(blockMins)
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
      const maskedId = maskFn ? maskFn(identifier) : identifier;
      logger.error('Rate limiter error', { 
        identifier: maskedId, 
        error 
      });
      
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
      // Given that this protects security-sensitive endpoints, we choose to fail closed.
      // If the rate limiter is broken, we'd rather temporarily block all requests than
      // allow unlimited spam/enumeration attacks.
      throw new Error('Rate limiter unavailable - request blocked for security');
    }
  }

  /**
   * Check if a magic link request should be allowed for this email
   * 
   * @param email - Email address to check
   * @returns Object with allowed flag and optional reason
   */
  static async checkMagicLinkRequest(email: string): Promise<{ allowed: boolean; reason?: string }> {
    return this.check(
      email.toLowerCase(), 
      CONFIG.rateLimits.magicLink, 
      maskEmail
    );
  }

  /**
   * Check if a Gemini API request should be allowed for this session
   * 
   * @param sessionId - Session ID to check
   * @returns Object with allowed flag and optional reason
   */
  static async checkGeminiRequest(sessionId: string): Promise<{ allowed: boolean; reason?: string }> {
    return this.check(
      sessionId, 
      CONFIG.rateLimits.gemini
    );
  }

  /**
   * Reset rate limit for an identifier (admin use)
   * 
   * @param identifier - Identifier to reset (email or session ID)
   * @param collection - Collection name
   */
  static async reset(identifier: string, collection: string): Promise<void> {
    const db = admin.firestore();
    await db.collection(collection).doc(encodeURIComponent(identifier)).delete();
    logger.info('Rate limit reset', { identifier });
  }

  /**
   * Manually reset rate limit for an email (admin use, backwards compatible)
   * 
   * @param email - Email address to reset
   */
  static async resetEmail(email: string): Promise<void> {
    return this.reset(email.toLowerCase(), CONFIG.rateLimits.magicLink.collection);
  }
}
