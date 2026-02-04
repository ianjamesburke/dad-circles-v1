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
import * as admin from 'firebase-admin';
import { GoogleGenAI, FunctionCallingConfigMode, ThinkingLevel } from '@google/genai';
import type { Content } from '@google/genai';

import { GEMINI_CONFIG } from './config';
import { toolDeclarations } from './tools';
import { buildSystemPrompt } from './prompts';
import { validateAndApplyExtraction, DialogSignals } from './validation';
import { buildDialogResponse } from './dialog';

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
    
    const { history } = request.data || {};

    // ========================================================================
    // INPUT VALIDATION
    // ========================================================================
    
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Authentication required');
    }

    if (!history) {
      throw new HttpsError('invalid-argument', 'history is required');
    }

    const sessionId = request.auth.uid;

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
    
    const rateLimitCheck = await RateLimiter.checkGeminiRequest(sessionId);
    if (!rateLimitCheck.allowed) {
      logger.warn('Gemini request rate limited', { 
        sessionId,
        reason: rateLimitCheck.reason 
      });
      throw new HttpsError('resource-exhausted', rateLimitCheck.reason || 'Rate limit exceeded');
    }

    logger.info('Gemini request received', { 
      sessionId,
      messageCount: history.length 
    });

    const profileSnap = await admin.firestore().collection('profiles').doc(sessionId).get();
    if (!profileSnap.exists) {
      throw new HttpsError('not-found', 'Profile not found');
    }
    const profile = profileSnap.data();
    if (!profile) {
      throw new HttpsError('data-loss', 'Profile data missing');
    }

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

      // Use only the most recent turns for extraction context
      const recentHistory = history.slice(-4);
      const contents: Content[] = recentHistory.map((msg: any) => ({
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
            functionCallingConfig: { mode: FunctionCallingConfigMode.ANY }
          },
          thinkingConfig: {
            thinkingLevel: ThinkingLevel[GEMINI_CONFIG.thinkingLevel]
          },
          temperature: 0,
          maxOutputTokens: GEMINI_CONFIG.maxOutputTokens
        }
      });

      logger.info('Gemini response received', { 
        sessionId,
        duration: Date.now() - startTime 
      });

      // ========================================================================
      // RESPONSE PROCESSING
      // ========================================================================
      
      // Process function calls and validate updates
      let allUpdates: any = {};
      let signals: DialogSignals = {};
      const validationErrors: string[] = [];

      if (response.functionCalls?.length) {
        for (const call of response.functionCalls) {
          if (call.name === 'extract_profile' && call.args) {
            const { updates, signals: newSignals, errors } = validateAndApplyExtraction(
              call.args,
              { ...profile, ...allUpdates }
            );
            allUpdates = { ...allUpdates, ...updates };
            signals = { ...signals, ...newSignals };
            if (errors.length) validationErrors.push(...errors);
          }
        }
      }

      if (validationErrors.some(err => err.includes('birth'))) {
        signals.needsChildBirthdate = true;
      }

      const dialog = buildDialogResponse(profile, allUpdates, signals);

      return {
        message: dialog.message,
        profile_updates: allUpdates,
        next_step: dialog.nextStep
      };

    } catch (error: any) {
      logger.error('Gemini API error:', { 
        error: error.message,
        sessionId 
      });
      throw new HttpsError('internal', 'Failed to get AI response', error.message);
    }
  }
);
