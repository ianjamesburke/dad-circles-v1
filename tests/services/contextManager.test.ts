/**
 * Context Manager Tests
 * 
 * Tests for the context window management system that controls
 * how many messages are sent to the AI service.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createContextManager, limitMessageContext } from '../../services/contextManager';
import { createMessages, createConversation, resetFactories } from '../factories';

describe('ContextManager', () => {
  beforeEach(() => {
    resetFactories();
  });

  describe('createContextManager', () => {
    it('should create a context manager with given config', () => {
      const manager = createContextManager({
        maxMessages: 10,
        preserveFirstCount: 2,
        preserveRecentCount: 8,
        strategy: 'first-last',
      });

      expect(manager).toBeDefined();
      expect(typeof manager.limitContext).toBe('function');
      expect(typeof manager.getStats).toBe('function');
    });
  });

  describe('limitContext', () => {
    it('should return all messages when under the limit', () => {
      const manager = createContextManager({
        maxMessages: 20,
        preserveFirstCount: 5,
        preserveRecentCount: 15,
        strategy: 'first-last',
      });

      const messages = createMessages(10);
      const result = manager.limitContext(messages);

      expect(result).toHaveLength(10);
      expect(result).toEqual(messages);
    });

    it('should preserve first and last messages when over limit', () => {
      const manager = createContextManager({
        maxMessages: 10,
        preserveFirstCount: 3,
        preserveRecentCount: 4,
        strategy: 'first-last',
      });

      const messages = createMessages(20);
      const result = manager.limitContext(messages);

      // Should have first 3 + last 4 = 7 messages
      expect(result).toHaveLength(7);
      
      // First 3 should be preserved
      expect(result[0]).toEqual(messages[0]);
      expect(result[1]).toEqual(messages[1]);
      expect(result[2]).toEqual(messages[2]);
      
      // Last 4 should be preserved
      expect(result[3]).toEqual(messages[16]);
      expect(result[4]).toEqual(messages[17]);
      expect(result[5]).toEqual(messages[18]);
      expect(result[6]).toEqual(messages[19]);
    });

    it('should handle empty message array', () => {
      const manager = createContextManager({
        maxMessages: 10,
        preserveFirstCount: 3,
        preserveRecentCount: 7,
        strategy: 'first-last',
      });

      const result = manager.limitContext([]);
      expect(result).toHaveLength(0);
    });

    it('should return all messages when preserve counts exceed message count', () => {
      const manager = createContextManager({
        maxMessages: 10,
        preserveFirstCount: 5,
        preserveRecentCount: 10,
        strategy: 'first-last',
      });

      const messages = createMessages(8);
      const result = manager.limitContext(messages);

      expect(result).toHaveLength(8);
      expect(result).toEqual(messages);
    });

    it('should handle exactly maxMessages count', () => {
      const manager = createContextManager({
        maxMessages: 10,
        preserveFirstCount: 3,
        preserveRecentCount: 7,
        strategy: 'first-last',
      });

      const messages = createMessages(10);
      const result = manager.limitContext(messages);

      expect(result).toHaveLength(10);
      expect(result).toEqual(messages);
    });

    it('should maintain message order after limiting', () => {
      const manager = createContextManager({
        maxMessages: 10,
        preserveFirstCount: 2,
        preserveRecentCount: 3,
        strategy: 'first-last',
      });

      const conversation = createConversation(10); // 20 messages total
      const result = manager.limitContext(conversation);

      // Verify chronological order is maintained
      for (let i = 1; i < result.length; i++) {
        expect(result[i].timestamp).toBeGreaterThanOrEqual(result[i - 1].timestamp);
      }
    });
  });

  describe('getStats', () => {
    it('should return correct stats for limited context', () => {
      const manager = createContextManager({
        maxMessages: 10,
        preserveFirstCount: 3,
        preserveRecentCount: 4,
        strategy: 'first-last',
      });

      const original = createMessages(20);
      const limited = manager.limitContext(original);
      const stats = manager.getStats(original, limited);

      expect(stats.originalCount).toBe(20);
      expect(stats.limitedCount).toBe(7);
      expect(stats.removedCount).toBe(13);
      expect(stats.compressionRatio).toBeCloseTo(0.35, 2);
      expect(stats.preservedFirstCount).toBe(3);
      expect(stats.preservedRecentCount).toBe(4);
    });

    it('should return 1.0 compression ratio when no messages removed', () => {
      const manager = createContextManager({
        maxMessages: 20,
        preserveFirstCount: 5,
        preserveRecentCount: 15,
        strategy: 'first-last',
      });

      const original = createMessages(10);
      const limited = manager.limitContext(original);
      const stats = manager.getStats(original, limited);

      expect(stats.compressionRatio).toBe(1);
      expect(stats.removedCount).toBe(0);
    });

    it('should handle empty arrays', () => {
      const manager = createContextManager({
        maxMessages: 10,
        preserveFirstCount: 3,
        preserveRecentCount: 7,
        strategy: 'first-last',
      });

      const stats = manager.getStats([], []);

      expect(stats.originalCount).toBe(0);
      expect(stats.limitedCount).toBe(0);
      expect(stats.removedCount).toBe(0);
    });

    it('should cap preserved counts to original message count', () => {
      const manager = createContextManager({
        maxMessages: 100,
        preserveFirstCount: 50,
        preserveRecentCount: 50,
        strategy: 'first-last',
      });

      const original = createMessages(5);
      const limited = manager.limitContext(original);
      const stats = manager.getStats(original, limited);

      expect(stats.preservedFirstCount).toBe(5);
      expect(stats.preservedRecentCount).toBe(5);
    });
  });
});

describe('limitMessageContext utility', () => {
  beforeEach(() => {
    resetFactories();
  });

  it('should limit messages with default preserve values', () => {
    const messages = createMessages(30);
    const result = limitMessageContext(messages, { maxMessages: 20 });

    // Default preserveFirst is 5, so preserveRecent would be 15
    expect(result.length).toBeLessThanOrEqual(20);
  });

  it('should respect custom preserve values', () => {
    const messages = createMessages(50);
    const result = limitMessageContext(messages, {
      maxMessages: 20,
      preserveFirst: 5,
      preserveRecent: 10,
    });

    expect(result).toHaveLength(15); // 5 + 10
  });

  it('should handle small message arrays', () => {
    const messages = createMessages(5);
    const result = limitMessageContext(messages, {
      maxMessages: 20,
      preserveFirst: 5,
      preserveRecent: 15,
    });

    expect(result).toHaveLength(5);
    expect(result).toEqual(messages);
  });
});
