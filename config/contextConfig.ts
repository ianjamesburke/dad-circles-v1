interface ContextConfig {
  maxMessages: number;
  preserveFirstCount: number;
  preserveRecentCount: number;
  strategy: 'first-last' | 'recent-only' | 'smart';
}

// Maximum allowed message length (characters)
// Messages exceeding this are rejected before sending to AI or storing
// IMPORTANT: Keep in sync with functions/src/config.ts validation.maxMessageLength
export const MAX_MESSAGE_LENGTH = 1000;

const contextConfigs: Record<string, ContextConfig> = {
  'chat': {
    maxMessages: 100,
    preserveFirstCount: 5,
    preserveRecentCount: 95,
    strategy: 'first-last'
  },
  'ai-service': {
    maxMessages: 50,
    preserveFirstCount: 3,
    preserveRecentCount: 47,
    strategy: 'first-last'
  },
  'gemini-call': {
    maxMessages: 30,
    preserveFirstCount: 2,
    preserveRecentCount: 28,
    strategy: 'first-last'
  },
  'admin': {
    maxMessages: 200,
    preserveFirstCount: 10,
    preserveRecentCount: 190,
    strategy: 'first-last'
  }
};

export function getContextConfig(type: string): ContextConfig {
  return contextConfigs[type] || contextConfigs['chat'];
}

export { type ContextConfig };