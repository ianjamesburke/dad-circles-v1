/**
 * Configuration - Single Source of Truth
 * 
 * Centralized configuration for all constants and settings.
 * Makes it easy to adjust values without hunting through code.
 */

export const CONFIG = {
  /**
   * Gemini API configuration
   */
  gemini: {
    model: 'gemini-2.5-flash',
    timeout: 30,
    maxOutputTokens: 512,
    temperature: 0.4,
    thinkingLevel: 'MINIMAL' as const,
  },

  /**
   * Rate limiting configurations
   */
  rateLimits: {
    /**
     * Magic link rate limiting (strict)
     * - 3 attempts per hour
     * - Block for 1 hour if exceeded
     */
    magicLink: {
      collection: 'rate_limits',
      windowMs: 60 * 60 * 1000,      // 1 hour
      maxAttempts: 3,
      blockDurationMs: 60 * 60 * 1000, // 1 hour
      errorMessage: (mins: number) => 
        `Too many requests. Please try again in ${mins} minute${mins > 1 ? 's' : ''}.`,
    },
    /**
     * Gemini API rate limiting (generous for conversational UX)
     * - 20 requests per minute
     * - Block for 5 minutes if exceeded
     */
    gemini: {
      collection: 'rate_limits_gemini',
      windowMs: 60 * 1000,            // 1 minute
      maxAttempts: 20,
      blockDurationMs: 5 * 60 * 1000,  // 5 minutes
      errorMessage: (mins: number) => 
        `Too many requests. Please wait ${mins} minute${mins > 1 ? 's' : ''} before continuing.`,
    },
  },

  /**
   * Security settings
   */
  security: {
    // Magic link token time-to-live (ms)
    magicLinkTokenTtlMs: 24 * 60 * 60 * 1000, // 24 hours
  },

  /**
   * Validation constraints
   */
  validation: {
    maxMessageLength: 1000,
    maxHistoryLength: 50,
    minBirthYear: 2010,
    maxBirthYear: 2099,
    stateCodePattern: /^[A-Z]{2,3}$/,
    countryCodePattern: /^[A-Z]{2}$/,
  },

  /**
   * UI-related configuration
   */
  ui: {
    debounceMs: 500,
    maxMessages: 30,
    preserveFirst: 2,
    preserveRecent: 28,
  },
};

export type RateLimitConfig = typeof CONFIG.rateLimits.magicLink;
