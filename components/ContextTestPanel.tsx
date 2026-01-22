import React, { useState } from 'react';
import { createContextManager, limitMessageContext } from '../services/contextManager';
import { contextAnalytics } from '../utils/contextAnalytics';
import { getContextConfig } from '../config/contextConfig';
import { Message, Role } from '../types';

// Helper to create test messages
function createTestMessage(id: string, role: Role, content: string, timestamp?: number): Message {
  return {
    id,
    session_id: 'test-session',
    role,
    content,
    timestamp: timestamp || Date.now()
  };
}

// Create a realistic test conversation
function createTestConversation(size: number): Message[] {
  const messages: Message[] = [];
  let timestamp = Date.now() - (size * 2 * 60 * 1000); // Start size*2 minutes ago

  // First few messages (onboarding start)
  const startMessages = [
    ['agent', "Hey there! So glad you're here. To get started, are you an expecting dad or a current dad?"],
    ['user', "I'm an expecting dad"],
    ['agent', "That's so exciting! When is your baby due?"],
    ['user', "June 2025"],
    ['agent', "Wonderful! Do you know if it's a boy or girl?"]
  ];

  startMessages.forEach(([role, content], index) => {
    messages.push(createTestMessage(
      `start-${index}`,
      role as Role,
      content,
      timestamp + (index * 2 * 60 * 1000)
    ));
  });

  // Middle messages (filler conversation)
  for (let i = 5; i < size - 10; i++) {
    const role = i % 2 === 0 ? 'user' : 'agent';
    const content = role === 'user' 
      ? `User question ${i}: What about...?`
      : `Agent response ${i}: Here's what I think about that...`;
    
    messages.push(createTestMessage(
      `middle-${i}`,
      role as Role,
      content,
      timestamp + (i * 2 * 60 * 1000)
    ));
  }

  // Last few messages (recent conversation)
  const endMessages = [
    ['user', "I'm getting nervous about the delivery"],
    ['agent', "That's completely normal! Many expecting dads feel nervous. What specifically worries you?"],
    ['user', "What if something goes wrong? What if I don't know how to help?"],
    ['agent', "Those are valid concerns. Here's what you can do to prepare and feel more confident..."],
    ['user', "That helps a lot. What should I pack in the hospital bag?"],
    ['agent', "Great question! Here's a comprehensive list for both you and your partner..."],
    ['user', "Thanks, you've been incredibly helpful throughout this journey"],
    ['agent', "It's been my pleasure helping you prepare for this exciting time!"],
    ['user', "I feel much more confident now"],
    ['agent', "That's wonderful to hear! Remember, I'm always here if you need support."]
  ];

  endMessages.forEach(([role, content], index) => {
    messages.push(createTestMessage(
      `end-${index}`,
      role as Role,
      content,
      timestamp + ((size - 10 + index) * 2 * 60 * 1000)
    ));
  });

  return messages.slice(0, size); // Ensure exact size
}
export const ContextTestPanel: React.FC = () => {
  const [testResults, setTestResults] = useState<any>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [conversationSize, setConversationSize] = useState(150);

  const runContextTest = () => {
    setIsRunning(true);
    setTestResults(null);

    try {
      // Create test conversation
      const fullConversation = createTestConversation(conversationSize);
      
      // Test different configurations
      const scenarios = [
        { name: 'Chat Interface', config: getContextConfig('chat') },
        { name: 'AI Service', config: getContextConfig('ai-service') },
        { name: 'Admin Dashboard', config: getContextConfig('admin') }
      ];

      const results = scenarios.map(scenario => {
        const startTime = Date.now();
        const manager = createContextManager(scenario.config);
        const limitedMessages = manager.limitContext(fullConversation);
        const processingTime = Date.now() - startTime;
        const stats = manager.getStats(fullConversation, limitedMessages);

        // Record analytics
        contextAnalytics.recordOperation(
          'test-session',
          'limit',
          stats,
          scenario.name.toLowerCase().replace(' ', '-'),
          processingTime
        );

        return {
          scenario: scenario.name,
          original: stats.originalCount,
          limited: stats.limitedCount,
          removed: stats.removedCount,
          compression: `${(stats.compressionRatio * 100).toFixed(1)}%`,
          processingTime: `${processingTime}ms`,
          strategy: `First ${stats.preservedFirstCount} + Last ${stats.preservedRecentCount}`,
          firstMessages: limitedMessages.slice(0, 3).map(m => `[${m.role}] ${m.content.substring(0, 50)}...`),
          lastMessages: limitedMessages.slice(-3).map(m => `[${m.role}] ${m.content.substring(0, 50)}...`)
        };
      });

      // Get analytics summary
      const summary = contextAnalytics.getSummary();
      const insights = contextAnalytics.getInsights();

      setTestResults({
        conversationSize: fullConversation.length,
        scenarios: results,
        analytics: {
          totalOperations: summary.totalOperations,
          totalProcessed: summary.totalMessagesProcessed,
          totalRemoved: summary.totalMessagesRemoved,
          avgCompression: `${(summary.averageCompressionRatio * 100).toFixed(1)}%`,
          avgProcessingTime: `${summary.averageProcessingTime.toFixed(0)}ms`
        },
        insights
      });

    } catch (error) {
      console.error('Context test failed:', error);
      setTestResults({ error: error instanceof Error ? error.message : String(error) });
    } finally {
      setIsRunning(false);
    }
  };

  const testUtilityFunction = () => {
    const testMessages = createTestConversation(200);
    const limited = limitMessageContext(testMessages, { maxMessages: 50 });
    
    alert(`Utility function test:\nOriginal: ${testMessages.length} messages\nLimited: ${limited.length} messages\nCompression: ${((limited.length / testMessages.length) * 100).toFixed(1)}%`);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
          <i className="fas fa-flask text-blue-600"></i>
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-800">Context Management Test Panel</h2>
          <p className="text-sm text-slate-600">Test the "first 5 + last 95" context limiting system</p>
        </div>
      </div>

      {/* Test Configuration */}
      <div className="bg-slate-50 rounded-xl p-4 mb-6">
        <h3 className="font-semibold text-slate-700 mb-3">Test Configuration</h3>
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-slate-600">
            Conversation Size:
            <input
              type="number"
              value={conversationSize}
              onChange={(e) => setConversationSize(parseInt(e.target.value) || 150)}
              min="50"
              max="1000"
              step="50"
              className="ml-2 w-20 px-2 py-1 border border-slate-300 rounded text-center"
            />
          </label>
          <button
            onClick={runContextTest}
            disabled={isRunning}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white px-4 py-2 rounded-lg font-medium transition"
          >
            {isRunning ? 'Running Test...' : 'Run Context Test'}
          </button>
          <button
            onClick={testUtilityFunction}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition"
          >
            Test Utility Function
          </button>
        </div>
      </div>

      {/* Test Results */}
      {testResults && (
        <div className="space-y-6">
          {testResults.error ? (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <h3 className="font-semibold text-red-800 mb-2">Test Failed</h3>
              <p className="text-red-700">{testResults.error}</p>
            </div>
          ) : (
            <>
              {/* Overview */}
              <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                <h3 className="font-semibold text-green-800 mb-2">✅ Test Completed Successfully</h3>
                <p className="text-green-700">
                  Created {testResults.conversationSize} message conversation and tested context limiting across {testResults.scenarios.length} scenarios.
                </p>
              </div>

              {/* Scenario Results */}
              <div>
                <h3 className="font-semibold text-slate-700 mb-3">Scenario Results</h3>
                <div className="grid gap-4">
                  {testResults.scenarios.map((result: any, index: number) => (
                    <div key={index} className="border border-slate-200 rounded-xl p-4">
                      <div className="flex justify-between items-start mb-3">
                        <h4 className="font-medium text-slate-800">{result.scenario}</h4>
                        <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded-full">
                          {result.compression} compression
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 text-sm">
                        <div>
                          <span className="text-slate-500">Original:</span>
                          <div className="font-semibold">{result.original}</div>
                        </div>
                        <div>
                          <span className="text-slate-500">Limited:</span>
                          <div className="font-semibold text-blue-600">{result.limited}</div>
                        </div>
                        <div>
                          <span className="text-slate-500">Removed:</span>
                          <div className="font-semibold text-red-600">{result.removed}</div>
                        </div>
                        <div>
                          <span className="text-slate-500">Processing:</span>
                          <div className="font-semibold">{result.processingTime}</div>
                        </div>
                      </div>

                      <div className="text-xs text-slate-600 mb-3">
                        <strong>Strategy:</strong> {result.strategy}
                      </div>

                      <div className="grid md:grid-cols-2 gap-4 text-xs">
                        <div>
                          <div className="font-medium text-slate-700 mb-1">First 3 Preserved:</div>
                          {result.firstMessages.map((msg: string, i: number) => (
                            <div key={i} className="text-slate-600 truncate">{i + 1}. {msg}</div>
                          ))}
                        </div>
                        <div>
                          <div className="font-medium text-slate-700 mb-1">Last 3 Preserved:</div>
                          {result.lastMessages.map((msg: string, i: number) => (
                            <div key={i} className="text-slate-600 truncate">{result.limited - 2 + i}. {msg}</div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Analytics Summary */}
              <div className="bg-slate-50 rounded-xl p-4">
                <h3 className="font-semibold text-slate-700 mb-3">📊 Analytics Summary</h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                  <div>
                    <span className="text-slate-500">Operations:</span>
                    <div className="font-semibold">{testResults.analytics.totalOperations}</div>
                  </div>
                  <div>
                    <span className="text-slate-500">Processed:</span>
                    <div className="font-semibold">{testResults.analytics.totalProcessed}</div>
                  </div>
                  <div>
                    <span className="text-slate-500">Removed:</span>
                    <div className="font-semibold">{testResults.analytics.totalRemoved}</div>
                  </div>
                  <div>
                    <span className="text-slate-500">Avg Compression:</span>
                    <div className="font-semibold">{testResults.analytics.avgCompression}</div>
                  </div>
                  <div>
                    <span className="text-slate-500">Avg Processing:</span>
                    <div className="font-semibold">{testResults.analytics.avgProcessingTime}</div>
                  </div>
                </div>
              </div>

              {/* Insights */}
              {testResults.insights.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <h3 className="font-semibold text-amber-800 mb-3">💡 Insights</h3>
                  <ul className="space-y-1 text-sm text-amber-700">
                    {testResults.insights.map((insight: string, index: number) => (
                      <li key={index}>• {insight}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Instructions */}
      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-xl p-4">
        <h3 className="font-semibold text-blue-800 mb-2">🧪 How to Test</h3>
        <ol className="text-sm text-blue-700 space-y-1">
          <li>1. <strong>Adjust conversation size</strong> (50-1000 messages)</li>
          <li>2. <strong>Click "Run Context Test"</strong> to see how different scenarios handle limiting</li>
          <li>3. <strong>Review the results</strong> to see compression ratios and preserved messages</li>
          <li>4. <strong>Check analytics</strong> to see performance metrics</li>
          <li>5. <strong>Test utility function</strong> for quick limiting demo</li>
        </ol>
      </div>
    </div>
  );
};