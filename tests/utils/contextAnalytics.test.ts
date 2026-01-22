/**
 * Context Analytics Tests
 * 
 * Tests for the analytics system that tracks context management operations.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { contextAnalytics, generateContextReport } from '../../utils/contextAnalytics';

describe('ContextAnalytics', () => {
  beforeEach(() => {
    contextAnalytics.clear();
  });

  describe('recordOperation', () => {
    it('should record a single operation', () => {
      contextAnalytics.recordOperation(
        'session-1',
        'limitContext',
        {
          originalCount: 100,
          limitedCount: 50,
          removedCount: 50,
          compressionRatio: 0.5,
          preservedFirstCount: 5,
          preservedRecentCount: 45,
        },
        'chat',
        25
      );

      const summary = contextAnalytics.getSummary();
      expect(summary.totalOperations).toBe(1);
    });

    it('should record multiple operations', () => {
      for (let i = 0; i < 5; i++) {
        contextAnalytics.recordOperation(
          `session-${i}`,
          'limitContext',
          {
            originalCount: 100,
            limitedCount: 50,
            removedCount: 50,
            compressionRatio: 0.5,
            preservedFirstCount: 5,
            preservedRecentCount: 45,
          },
          'chat',
          20
        );
      }

      const summary = contextAnalytics.getSummary();
      expect(summary.totalOperations).toBe(5);
    });
  });

  describe('getSummary', () => {
    it('should return zeros for empty analytics', () => {
      const summary = contextAnalytics.getSummary();

      expect(summary).toEqual({
        totalOperations: 0,
        totalMessagesProcessed: 0,
        totalMessagesRemoved: 0,
        averageCompressionRatio: 0,
        averageProcessingTime: 0,
      });
    });

    it('should calculate correct totals', () => {
      contextAnalytics.recordOperation('s1', 'op1', {
        originalCount: 100,
        limitedCount: 80,
        removedCount: 20,
        compressionRatio: 0.8,
        preservedFirstCount: 5,
        preservedRecentCount: 75,
      }, 'chat', 10);

      contextAnalytics.recordOperation('s2', 'op2', {
        originalCount: 50,
        limitedCount: 30,
        removedCount: 20,
        compressionRatio: 0.6,
        preservedFirstCount: 5,
        preservedRecentCount: 25,
      }, 'chat', 20);

      const summary = contextAnalytics.getSummary();

      expect(summary.totalOperations).toBe(2);
      expect(summary.totalMessagesProcessed).toBe(150);
      expect(summary.totalMessagesRemoved).toBe(40);
      expect(summary.averageCompressionRatio).toBeCloseTo(0.7, 2);
      expect(summary.averageProcessingTime).toBe(15);
    });

    it('should handle single operation correctly', () => {
      contextAnalytics.recordOperation('s1', 'op1', {
        originalCount: 100,
        limitedCount: 100,
        removedCount: 0,
        compressionRatio: 1.0,
        preservedFirstCount: 5,
        preservedRecentCount: 95,
      }, 'chat', 5);

      const summary = contextAnalytics.getSummary();

      expect(summary.totalOperations).toBe(1);
      expect(summary.totalMessagesProcessed).toBe(100);
      expect(summary.totalMessagesRemoved).toBe(0);
      expect(summary.averageCompressionRatio).toBe(1.0);
      expect(summary.averageProcessingTime).toBe(5);
    });
  });

  describe('getInsights', () => {
    it('should handle no operations gracefully', () => {
      // When no operations recorded, getSummary returns zeros
      // getInsights may still generate insights based on those zero values
      const summary = contextAnalytics.getSummary();
      expect(summary.totalOperations).toBe(0);
      
      // Insights are generated based on summary values, even if zero
      const insights = contextAnalytics.getInsights();
      expect(Array.isArray(insights)).toBe(true);
    });

    it('should detect high compression ratio', () => {
      contextAnalytics.recordOperation('s1', 'op1', {
        originalCount: 100,
        limitedCount: 90,
        removedCount: 10,
        compressionRatio: 0.9,
        preservedFirstCount: 5,
        preservedRecentCount: 85,
      }, 'chat', 5);

      const insights = contextAnalytics.getInsights();
      expect(insights).toContain('High compression ratio - most messages are being preserved');
    });

    it('should detect low compression ratio', () => {
      contextAnalytics.recordOperation('s1', 'op1', {
        originalCount: 100,
        limitedCount: 20,
        removedCount: 80,
        compressionRatio: 0.2,
        preservedFirstCount: 5,
        preservedRecentCount: 15,
      }, 'chat', 5);

      const insights = contextAnalytics.getInsights();
      expect(insights).toContain('Low compression ratio - significant message reduction occurring');
    });

    it('should detect high processing time', () => {
      contextAnalytics.recordOperation('s1', 'op1', {
        originalCount: 100,
        limitedCount: 50,
        removedCount: 50,
        compressionRatio: 0.5,
        preservedFirstCount: 5,
        preservedRecentCount: 45,
      }, 'chat', 150);

      const insights = contextAnalytics.getInsights();
      expect(insights).toContain('Processing time is high - consider optimization');
    });

    it('should detect fast processing', () => {
      contextAnalytics.recordOperation('s1', 'op1', {
        originalCount: 100,
        limitedCount: 50,
        removedCount: 50,
        compressionRatio: 0.5,
        preservedFirstCount: 5,
        preservedRecentCount: 45,
      }, 'chat', 5);

      const insights = contextAnalytics.getInsights();
      expect(insights).toContain('Very fast processing - system is performing well');
    });

    it('should detect good test coverage', () => {
      for (let i = 0; i < 15; i++) {
        contextAnalytics.recordOperation(`s${i}`, 'op', {
          originalCount: 100,
          limitedCount: 50,
          removedCount: 50,
          compressionRatio: 0.5,
          preservedFirstCount: 5,
          preservedRecentCount: 45,
        }, 'chat', 10);
      }

      const insights = contextAnalytics.getInsights();
      expect(insights).toContain('Multiple operations recorded - good test coverage');
    });
  });

  describe('clear', () => {
    it('should clear all recorded operations', () => {
      contextAnalytics.recordOperation('s1', 'op1', {
        originalCount: 100,
        limitedCount: 50,
        removedCount: 50,
        compressionRatio: 0.5,
        preservedFirstCount: 5,
        preservedRecentCount: 45,
      }, 'chat', 10);

      expect(contextAnalytics.getSummary().totalOperations).toBe(1);

      contextAnalytics.clear();

      expect(contextAnalytics.getSummary().totalOperations).toBe(0);
    });
  });
});

describe('generateContextReport', () => {
  beforeEach(() => {
    contextAnalytics.clear();
  });

  it('should generate report for empty analytics', () => {
    const report = generateContextReport();

    expect(report).toContain('Context Management Report');
    expect(report).toContain('Total Operations: 0');
    expect(report).toContain('Messages Processed: 0');
  });

  it('should generate report with data', () => {
    contextAnalytics.recordOperation('s1', 'op1', {
      originalCount: 100,
      limitedCount: 50,
      removedCount: 50,
      compressionRatio: 0.5,
      preservedFirstCount: 5,
      preservedRecentCount: 45,
    }, 'chat', 25);

    const report = generateContextReport();

    expect(report).toContain('Total Operations: 1');
    expect(report).toContain('Messages Processed: 100');
    expect(report).toContain('Messages Removed: 50');
    expect(report).toContain('Average Compression: 50.0%');
    expect(report).toContain('Average Processing Time: 25ms');
  });

  it('should include insights in report', () => {
    contextAnalytics.recordOperation('s1', 'op1', {
      originalCount: 100,
      limitedCount: 90,
      removedCount: 10,
      compressionRatio: 0.9,
      preservedFirstCount: 5,
      preservedRecentCount: 85,
    }, 'chat', 5);

    const report = generateContextReport();

    expect(report).toContain('Insights:');
    expect(report).toContain('High compression ratio');
  });
});
