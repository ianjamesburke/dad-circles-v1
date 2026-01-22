import { Message } from '../types';

interface ContextConfig {
  maxMessages: number;
  preserveFirstCount: number;
  preserveRecentCount: number;
  strategy: 'first-last' | 'recent-only' | 'smart';
}

interface ContextStats {
  originalCount: number;
  limitedCount: number;
  removedCount: number;
  compressionRatio: number;
  preservedFirstCount: number;
  preservedRecentCount: number;
}

class ContextManager {
  constructor(private config: ContextConfig) {}

  limitContext(messages: Message[]): Message[] {
    if (messages.length <= this.config.maxMessages) {
      return messages;
    }

    const { preserveFirstCount, preserveRecentCount } = this.config;
    const totalPreserved = preserveFirstCount + preserveRecentCount;

    if (totalPreserved >= messages.length) {
      return messages;
    }

    // Take first N messages
    const firstMessages = messages.slice(0, preserveFirstCount);
    
    // Take last N messages
    const lastMessages = messages.slice(-preserveRecentCount);

    return [...firstMessages, ...lastMessages];
  }

  getStats(originalMessages: Message[], limitedMessages: Message[]): ContextStats {
    const originalCount = originalMessages.length;
    const limitedCount = limitedMessages.length;
    const removedCount = originalCount - limitedCount;
    const compressionRatio = limitedCount / originalCount;

    return {
      originalCount,
      limitedCount,
      removedCount,
      compressionRatio,
      preservedFirstCount: Math.min(this.config.preserveFirstCount, originalCount),
      preservedRecentCount: Math.min(this.config.preserveRecentCount, originalCount)
    };
  }
}

export function createContextManager(config: ContextConfig): ContextManager {
  return new ContextManager(config);
}

// Utility function for quick context limiting
export function limitMessageContext(
  messages: Message[], 
  options: { maxMessages: number; preserveFirst?: number; preserveRecent?: number }
): Message[] {
  const config: ContextConfig = {
    maxMessages: options.maxMessages,
    preserveFirstCount: options.preserveFirst || 5,
    preserveRecentCount: options.preserveRecent || Math.max(0, options.maxMessages - (options.preserveFirst || 5)),
    strategy: 'first-last'
  };

  const manager = createContextManager(config);
  return manager.limitContext(messages);
}