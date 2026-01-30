/**
 * Gemini Service - Main Callable Function
 * 
 * Secure server-side Gemini API integration with orchestration.
 * API key stored in Firebase Secrets, never exposed to client.
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { logger } from "../logger";
import { RateLimiter } from "../rateLimiter";
import { CONFIG } from "../config";
import { GoogleGenAI, FunctionCallingConfigMode, ThinkingLevel } from '@google/genai';
import type { Content } from '@google/genai';

import { GEMINI_CONFIG } from './config';
import { toolDeclarations } from './tools';
import { buildSystemPrompt } from './prompts';
import { validateAndApplyUpdates } from './validation';
import { generateFallback } from './fallbacks';

// Define secret for Gemini API key
const geminiApiKey = defineSecret("GEMINI_API_KEY");

/**
 * Callable function for getting Gemini responses
 * 
 * Handles the full flow:
 * 1. Input validation
 * 2. Rate limiting
 * 3. Gemini API call
 * 4. Response processing
 * 5. Profile updates validation
 */
export const getGeminiResponse = onCall(
  {
    cors: true,
    secrets: [geminiApiKey],
    timeoutSeconds: GEMINI_CONFIG.timeout,
  },
  async (request) => {
    const startTime = Date.now();
    
    const { profile, history } = request.data;

    // ========================================================================
    // INPUT VALIDATION
    // ========================================================================
    
    if (!profile || !history) {
      throw new HttpsError('invalid-argument', 'profile and history are required');
    }

    // Validate session_id exists for rate limiting
    if (!profile.session_id) {
      throw new HttpsError('invalid-argument', 'session_id is required');
    }

    // Validate input size to prevent abuse and resource exhaustion
    if (!Array.isArray(history)) {
      throw new HttpsError('invalid-argument', 'history must be an array');
    }
    
    if (history.length > CONFIG.validation.maxHistoryLength) {
      throw new HttpsError(
        'invalid-argument', 
        `history too long (max ${CONFIG.validation.maxHistoryLength} messages)`
      );
    }
    
    // Validate each message in history
    for (const msg of history) {
      if (!msg.role || !msg.content) {
        throw new HttpsError('invalid-argument', 'invalid message format in history');
      }
      if (typeof msg.content !== 'string' || msg.content.length > CONFIG.validation.maxMessageLength) {
        throw new HttpsError(
          'invalid-argument', 
          `Message too long. Please keep your message under ${CONFIG.validation.maxMessageLength} characters.`
        );
      }
    }

    // ========================================================================
    // RATE LIMITING
    // ========================================================================
    
    const rateLimitCheck = await RateLimiter.checkGeminiRequest(profile.session_id);
    if (!rateLimitCheck.allowed) {
      logger.warn('Gemini request rate limited', { 
        sessionId: profile.session_id,
        reason: rateLimitCheck.reason 
      });
      throw new HttpsError('resource-exhausted', rateLimitCheck.reason || 'Rate limit exceeded');
    }

    logger.info('Gemini request received', { 
      sessionId: profile.session_id,
      messageCount: history.length 
    });

    // ========================================================================
    // GEMINI API CALL
    // ========================================================================
    
    try {
      // Initialize Gemini client
      const apiKey = geminiApiKey.value();
      if (!apiKey) {
        throw new HttpsError('failed-precondition', 'GEMINI_API_KEY not configured');
      }

      const ai = new GoogleGenAI({ apiKey });

      // Convert history to Gemini format
      const contents: Content[] = history.map((msg: any) => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      }));

      // Build system prompt based on current profile state
      const systemPrompt = buildSystemPrompt(profile);

      // Call Gemini API with tools
      const response = await ai.models.generateContent({
        model: GEMINI_CONFIG.model,
        contents,
        config: {
          systemInstruction: systemPrompt,
          tools: [{ functionDeclarations: toolDeclarations }],
          toolConfig: {
            functionCallingConfig: { mode: FunctionCallingConfigMode.AUTO }
          },
          thinkingConfig: {
            thinkingLevel: ThinkingLevel[GEMINI_CONFIG.thinkingLevel]
          },
          temperature: GEMINI_CONFIG.temperature,
          maxOutputTokens: GEMINI_CONFIG.maxOutputTokens
        }
      });

      logger.info('Gemini response received', { 
        sessionId: profile.session_id,
        duration: Date.now() - startTime 
      });

      // ========================================================================
      // RESPONSE PROCESSING
      // ========================================================================
      
      // Process function calls and validate updates
      let allUpdates: any = {};
      
      if (response.functionCalls?.length) {
        for (const call of response.functionCalls) {
          if (call.name === 'update_profile' && call.args) {
            const { updates } = validateAndApplyUpdates(
              call.args,
              { ...profile, ...allUpdates }
            );
            allUpdates = { ...allUpdates, ...updates };
          }
        }
      }

      // Get text response
      let textResponse = response.text || '';
      if (!textResponse && response.candidates?.[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
          if ('text' in part && part.text) {
            textResponse += part.text;
          }
        }
      }

      // Fallback text if none provided
      if (!textResponse) {
        textResponse = generateFallback(profile, allUpdates);
      }

      return {
        message: textResponse,
        profile_updates: allUpdates
      };

    } catch (error: any) {
      logger.error('Gemini API error:', { 
        error: error.message,
        sessionId: profile.session_id 
      });
      throw new HttpsError('internal', 'Failed to get AI response', error.message);
    }
  }
);
