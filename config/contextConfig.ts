interface ContextConfig {
  maxMessages: number;
  preserveFirstCount: number;
  preserveRecentCount: number;
  strategy: 'first-last' | 'recent-only' | 'smart';
}

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