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
    model: 'gemini-3-flash-preview',
    timeout: 30,
    maxOutputTokens: 1024,
    temperature: 0.4,
    thinkingLevel: 'MINIMAL' as const,
  },

  /**
   * Weekend Mission generator configuration
   */
  mission: {
    researchModels: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-3-flash-preview', 'gemini-3-pro-preview'] as const,
    reasoningModels: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-3-pro-preview', 'gemini-3-flash-preview'] as const,
    internalModels: ['gemini-3-flash-preview', 'gemini-2.5-flash'] as const,
    useInternalResearchDocument: process.env.MISSION_USE_INTERNAL_RESEARCH !== 'false',
    internalResearchDocumentPath: process.env.MISSION_INTERNAL_RESEARCH_DOC_PATH || 'research/ann-arbor.md',
    internalIdeaCount: 6,
    timeout: 540,
    requestBudgetMs: 420000,
    researchTimeoutMs: 240000,
    reasoningTimeoutMs: 150000,
    researchMaxOutputTokens: 16384,
    reasoningMaxOutputTokens: 12288,
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
     * Magic link IP-based rate limiting
     * - 3 attempts per 10 minutes per IP address
     * - Block for 10 minutes if exceeded
     * - Defense against enumeration attacks from a single source
     */
    magicLinkByIP: {
      collection: 'rate_limits_magic_link_ip',
      windowMs: 10 * 60 * 1000,         // 10 minutes
      maxAttempts: 3,
      blockDurationMs: 10 * 60 * 1000,  // 10 minutes
      errorMessage: (mins: number) =>
        `Too many requests from your location. Please try again in ${mins} minute${mins > 1 ? 's' : ''}.`,
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
    /**
     * Weekend mission generation limit (public endpoint)
     * - 8 attempts per minute per IP/postcode
     * - Block for 10 minutes if exceeded
     */
    weekendMission: {
      collection: 'rate_limits_weekend_mission',
      windowMs: 60 * 1000,              // 1 minute
      maxAttempts: 8,
      blockDurationMs: 10 * 60 * 1000,  // 10 minutes
      errorMessage: (mins: number) =>
        `Too many mission requests. Please try again in ${mins} minute${mins > 1 ? 's' : ''}.`,
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
