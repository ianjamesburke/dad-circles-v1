/**
 * Tests for PII masking utilities
 */

import { describe, it, expect } from 'vitest';
import { maskEmail, maskPostcode, maskPII } from '../../functions/src/utils/pii';

describe('PII Masking Utilities', () => {
  describe('maskEmail', () => {
    it('should mask a standard email address', () => {
      expect(maskEmail('john.doe@example.com')).toBe('j***@example.com');
    });

    it('should mask a short email address', () => {
      expect(maskEmail('a@test.com')).toBe('a***@test.com');
    });

    it('should mask a long email address', () => {
      expect(maskEmail('verylongemail@domain.co.uk')).toBe('v***@domain.co.uk');
    });

    it('should handle undefined email', () => {
      expect(maskEmail(undefined)).toBe('[no-email]');
    });

    it('should handle null email', () => {
      expect(maskEmail(null)).toBe('[no-email]');
    });

    it('should handle invalid email format', () => {
      expect(maskEmail('notanemail')).toBe('[invalid-email]');
    });

    it('should handle empty string', () => {
      expect(maskEmail('')).toBe('[no-email]');
    });
  });

  describe('maskPostcode', () => {
    it('should mask a UK postcode', () => {
      expect(maskPostcode('SW1A 1AA')).toBe('SW1***');
    });

    it('should mask a US zip code', () => {
      expect(maskPostcode('12345')).toBe('123***');
    });

    it('should mask a postcode with spaces', () => {
      expect(maskPostcode('M1 1AA')).toBe('M11***');
    });

    it('should handle short postcodes', () => {
      expect(maskPostcode('123')).toBe('***');
    });

    it('should handle undefined postcode', () => {
      expect(maskPostcode(undefined)).toBe('[no-postcode]');
    });

    it('should handle null postcode', () => {
      expect(maskPostcode(null)).toBe('[no-postcode]');
    });
  });

  describe('maskPII', () => {
    it('should mask email in an object', () => {
      const obj = { email: 'test@example.com', name: 'John' };
      const masked = maskPII(obj);
      expect(masked.email).toBe('t***@example.com');
      expect(masked.name).toBe('John');
    });

    it('should mask postcode in an object', () => {
      const obj = { postcode: '12345', city: 'Austin' };
      const masked = maskPII(obj);
      expect(masked.postcode).toBe('123***');
      expect(masked.city).toBe('Austin');
    });

    it('should mask both email and postcode', () => {
      const obj = { email: 'user@test.com', postcode: 'SW1A 1AA', id: '123' };
      const masked = maskPII(obj);
      expect(masked.email).toBe('u***@test.com');
      expect(masked.postcode).toBe('SW1***');
      expect(masked.id).toBe('123');
    });

    it('should not modify objects without PII fields', () => {
      const obj = { name: 'John', age: 30 };
      const masked = maskPII(obj);
      expect(masked).toEqual(obj);
    });

    it('should create a new object (not mutate original)', () => {
      const obj = { email: 'test@example.com' };
      const masked = maskPII(obj);
      expect(obj.email).toBe('test@example.com');
      expect(masked.email).toBe('t***@example.com');
    });
  });
});
