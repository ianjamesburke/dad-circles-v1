/**
 * Context Config Tests
 * 
 * Tests for the context configuration system that defines
 * message limits for different contexts (chat, AI service, admin).
 */

import { describe, it, expect } from 'vitest';
import { getContextConfig, type ContextConfig } from '../../config/contextConfig';

describe('getContextConfig', () => {
  describe('predefined configs', () => {
    it('should return chat config', () => {
      const config = getContextConfig('chat');

      expect(config).toEqual({
        maxMessages: 100,
        preserveFirstCount: 5,
        preserveRecentCount: 95,
        strategy: 'first-last',
      });
    });

    it('should return ai-service config', () => {
      const config = getContextConfig('ai-service');

      expect(config).toEqual({
        maxMessages: 50,
        preserveFirstCount: 3,
        preserveRecentCount: 47,
        strategy: 'first-last',
      });
    });

    it('should return admin config', () => {
      const config = getContextConfig('admin');

      expect(config).toEqual({
        maxMessages: 200,
        preserveFirstCount: 10,
        preserveRecentCount: 190,
        strategy: 'first-last',
      });
    });
  });

  describe('fallback behavior', () => {
    it('should return chat config for unknown type', () => {
      const config = getContextConfig('unknown-type');
      const chatConfig = getContextConfig('chat');

      expect(config).toEqual(chatConfig);
    });

    it('should return chat config for empty string', () => {
      const config = getContextConfig('');
      const chatConfig = getContextConfig('chat');

      expect(config).toEqual(chatConfig);
    });
  });

  describe('config validity', () => {
    const configTypes = ['chat', 'ai-service', 'admin'];

    configTypes.forEach((type) => {
      it(`should have valid ${type} config structure`, () => {
        const config = getContextConfig(type);

        expect(config).toHaveProperty('maxMessages');
        expect(config).toHaveProperty('preserveFirstCount');
        expect(config).toHaveProperty('preserveRecentCount');
        expect(config).toHaveProperty('strategy');

        expect(typeof config.maxMessages).toBe('number');
        expect(typeof config.preserveFirstCount).toBe('number');
        expect(typeof config.preserveRecentCount).toBe('number');
        expect(typeof config.strategy).toBe('string');
      });

      it(`should have sensible ${type} config values`, () => {
        const config = getContextConfig(type);

        expect(config.maxMessages).toBeGreaterThan(0);
        expect(config.preserveFirstCount).toBeGreaterThanOrEqual(0);
        expect(config.preserveRecentCount).toBeGreaterThanOrEqual(0);
        expect(config.preserveFirstCount + config.preserveRecentCount).toBeLessThanOrEqual(config.maxMessages);
      });

      it(`should use first-last strategy for ${type}`, () => {
        const config = getContextConfig(type);
        expect(config.strategy).toBe('first-last');
      });
    });
  });

  describe('config relationships', () => {
    it('should have ai-service with fewer messages than chat', () => {
      const chatConfig = getContextConfig('chat');
      const aiConfig = getContextConfig('ai-service');

      expect(aiConfig.maxMessages).toBeLessThan(chatConfig.maxMessages);
    });

    it('should have admin with more messages than chat', () => {
      const chatConfig = getContextConfig('chat');
      const adminConfig = getContextConfig('admin');

      expect(adminConfig.maxMessages).toBeGreaterThan(chatConfig.maxMessages);
    });
  });
});
