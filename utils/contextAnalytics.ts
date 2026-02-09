interface ContextStats {
  originalCount: number;
  limitedCount: number;
  removedCount: number;
  compressionRatio: number;
  preservedFirstCount: number;
  preservedRecentCount: number;
}

interface AnalyticsOperation {
  sessionId: string;
  operation: string;
  stats: ContextStats;
  context: string;
  processingTime: number;
  timestamp: number;
}

interface AnalyticsSummary {
  totalOperations: number;
  totalMessagesProcessed: number;
  totalMessagesRemoved: number;
  averageCompressionRatio: number;
  averageProcessingTime: number;
}

class ContextAnalytics {
  private operations: AnalyticsOperation[] = [];

  recordOperation(
    sessionId: string,
    operation: string,
    stats: ContextStats,
    context: string,
    processingTime: number
  ): void {
    this.operations.push({
      sessionId,
      operation,
      stats,
      context,
      processingTime,
      timestamp: Date.now()
    });
  }

  getSummary(): AnalyticsSummary {
    if (this.operations.length === 0) {
      return {
        totalOperations: 0,
        totalMessagesProcessed: 0,
        totalMessagesRemoved: 0,
        averageCompressionRatio: 0,
        averageProcessingTime: 0
      };
    }

    const totalProcessed = this.operations.reduce((sum, op) => sum + op.stats.originalCount, 0);
    const totalRemoved = this.operations.reduce((sum, op) => sum + op.stats.removedCount, 0);
    const avgCompression = this.operations.reduce((sum, op) => sum + op.stats.compressionRatio, 0) / this.operations.length;
    const avgProcessingTime = this.operations.reduce((sum, op) => sum + op.processingTime, 0) / this.operations.length;

    return {
      totalOperations: this.operations.length,
      totalMessagesProcessed: totalProcessed,
      totalMessagesRemoved: totalRemoved,
      averageCompressionRatio: avgCompression,
      averageProcessingTime: avgProcessingTime
    };
  }

  getInsights(): string[] {
    const insights: string[] = [];
    const summary = this.getSummary();

    if (summary.averageCompressionRatio > 0.8) {
      insights.push("High compression ratio - most messages are being preserved");
    } else if (summary.averageCompressionRatio < 0.3) {
      insights.push("Low compression ratio - significant message reduction occurring");
    }

    if (summary.averageProcessingTime > 100) {
      insights.push("Processing time is high - consider optimization");
    } else if (summary.averageProcessingTime < 10) {
      insights.push("Very fast processing - system is performing well");
    }

    if (summary.totalOperations > 10) {
      insights.push("Multiple operations recorded - good test coverage");
    }

    return insights;
  }

  clear(): void {
    this.operations = [];
  }
}

export const contextAnalytics = new ContextAnalytics();

export function generateContextReport(): string {
  const summary = contextAnalytics.getSummary();
  const insights = contextAnalytics.getInsights();

  return `
Context Management Report
========================

Summary:
- Total Operations: ${summary.totalOperations}
- Messages Processed: ${summary.totalMessagesProcessed}
- Messages Removed: ${summary.totalMessagesRemoved}
- Average Compression: ${(summary.averageCompressionRatio * 100).toFixed(1)}%
- Average Processing Time: ${summary.averageProcessingTime.toFixed(0)}ms

Insights:
${insights.map(insight => `- ${insight}`).join('\n')}
  `.trim();
}