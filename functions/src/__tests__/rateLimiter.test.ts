/**
 * Rate Limiter Tests
 * 
 * Tests for both magic link and Gemini rate limiting
 */

// @ts-nocheck - Disable type checking for test mocks

import { RateLimiter } from '../rateLimiter';
import { CONFIG } from '../config';

// Mock Firebase Admin
const mockTransaction = {
  get: jest.fn(),
  set: jest.fn(),
};

const mockDocRef = {
  get: jest.fn(),
};

const mockFirestore = {
  collection: jest.fn(() => ({
    doc: jest.fn(() => mockDocRef),
  })),
  runTransaction: jest.fn((callback: any) => callback(mockTransaction)),
};

jest.mock('firebase-admin', () => ({
  firestore: jest.fn(() => mockFirestore),
}));

jest.mock('../logger', () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  },
}));

jest.mock('../utils/pii', () => ({
  maskEmail: (email: string) => email.replace(/(.{2}).*(@.*)/, '$1***$2'),
}));

describe('RateLimiter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('checkMagicLinkRequest', () => {
    it('should allow first request for an email', async () => {
      mockTransaction.get.mockResolvedValue({
        exists: false,
      });

      const result = await RateLimiter.checkMagicLinkRequest('test@example.com');

      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
      expect(mockTransaction.set).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          email: 'test@example.com',
          attempts: 1,
        })
      );
    });

    it('should allow requests within limit', async () => {
      mockTransaction.get.mockResolvedValue({
        exists: true,
        data: () => ({
          email: 'test@example.com',
          attempts: 2,
          firstAttemptAt: Date.now() - 1000, // 1 second ago
          lastAttemptAt: Date.now() - 500,
        }),
      });

      const result = await RateLimiter.checkMagicLinkRequest('test@example.com');

      expect(result.allowed).toBe(true);
      expect(mockTransaction.set).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          attempts: 3, // Incremented
        })
      );
    });

    it('should block requests when limit exceeded', async () => {
      const now = Date.now();
      mockTransaction.get.mockResolvedValue({
        exists: true,
        data: () => ({
          email: 'test@example.com',
          attempts: CONFIG.rateLimits.magicLink.maxAttempts,
          firstAttemptAt: now - 1000,
          lastAttemptAt: now - 500,
        }),
      });

      const result = await RateLimiter.checkMagicLinkRequest('test@example.com');

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Too many requests');
      expect(mockTransaction.set).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          blockedUntil: expect.any(Number),
        })
      );
    });

    it('should reset counter after window expires', async () => {
      const now = Date.now();
      const expiredTime = now - CONFIG.rateLimits.magicLink.windowMs - 1000;
      
      mockTransaction.get.mockResolvedValue({
        exists: true,
        data: () => ({
          email: 'test@example.com',
          attempts: 5,
          firstAttemptAt: expiredTime,
          lastAttemptAt: expiredTime + 1000,
        }),
      });

      const result = await RateLimiter.checkMagicLinkRequest('test@example.com');

      expect(result.allowed).toBe(true);
      expect(mockTransaction.set).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          attempts: 1, // Reset
        })
      );
    });

    it('should block if currently blocked', async () => {
      const now = Date.now();
      mockTransaction.get.mockResolvedValue({
        exists: true,
        data: () => ({
          email: 'test@example.com',
          attempts: 5,
          firstAttemptAt: now - 1000,
          lastAttemptAt: now - 500,
          blockedUntil: now + 3600000, // Blocked for 1 hour
        }),
      });

      const result = await RateLimiter.checkMagicLinkRequest('test@example.com');

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('minute');
    });
  });

  describe('checkGeminiRequest', () => {
    it('should allow first request for a session', async () => {
      mockTransaction.get.mockResolvedValue({
        exists: false,
      });

      const result = await RateLimiter.checkGeminiRequest('session-123');

      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
      expect(mockTransaction.set).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          email: 'session-123', // Generic field name
          attempts: 1,
        })
      );
    });

    it('should allow many requests within generous limit', async () => {
      mockTransaction.get.mockResolvedValue({
        exists: true,
        data: () => ({
          email: 'session-123',
          attempts: 10, // Well within 20 limit
          firstAttemptAt: Date.now() - 1000,
          lastAttemptAt: Date.now() - 100,
        }),
      });

      const result = await RateLimiter.checkGeminiRequest('session-123');

      expect(result.allowed).toBe(true);
      expect(mockTransaction.set).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          attempts: 11,
        })
      );
    });

    it('should block after 20 requests per minute', async () => {
      const now = Date.now();
      mockTransaction.get.mockResolvedValue({
        exists: true,
        data: () => ({
          email: 'session-123',
          attempts: CONFIG.rateLimits.gemini.maxAttempts,
          firstAttemptAt: now - 30000, // 30 seconds ago
          lastAttemptAt: now - 100,
        }),
      });

      const result = await RateLimiter.checkGeminiRequest('session-123');

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('wait');
    });

    it('should reset faster than magic link (1 minute window)', async () => {
      const now = Date.now();
      const expiredTime = now - CONFIG.rateLimits.gemini.windowMs - 1000;
      
      mockTransaction.get.mockResolvedValue({
        exists: true,
        data: () => ({
          email: 'session-123',
          attempts: 25,
          firstAttemptAt: expiredTime,
          lastAttemptAt: expiredTime + 1000,
        }),
      });

      const result = await RateLimiter.checkGeminiRequest('session-123');

      expect(result.allowed).toBe(true);
      expect(mockTransaction.set).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          attempts: 1, // Reset
        })
      );
    });
  });

  describe('reset', () => {
    it('should delete rate limit record', async () => {
      const mockDelete = jest.fn().mockResolvedValue(undefined);
      mockFirestore.collection = jest.fn(() => ({
        doc: jest.fn(() => ({
          delete: mockDelete,
        })),
      }));

      await RateLimiter.reset('test@example.com', 'rate_limits');

      expect(mockFirestore.collection).toHaveBeenCalledWith('rate_limits');
      expect(mockDelete).toHaveBeenCalled();
    });
  });

  describe('resetEmail (backwards compatibility)', () => {
    it('should call reset with magic link collection', async () => {
      const resetSpy = jest.spyOn(RateLimiter, 'reset').mockResolvedValue();

      await RateLimiter.resetEmail('test@example.com');

      expect(resetSpy).toHaveBeenCalledWith(
        'test@example.com',
        CONFIG.rateLimits.magicLink.collection
      );

      resetSpy.mockRestore();
    });
  });
});
