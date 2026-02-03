/**
 * Callable Gemini Service - Client-Side
 * 
 * Secure client implementation that calls the backend Cloud Function
 * instead of directly accessing the Gemini API.
 * 
 * This prevents API key exposure in the client bundle.
 */

import { UserProfile, Message, OnboardingStep } from "../types";
import { limitMessageContext } from "./contextManager";
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';
import { MAX_MESSAGE_LENGTH, getContextConfig } from '../config/contextConfig';

const isDev = import.meta.env.DEV;

/**
 * Get agent response by calling the secure backend Cloud Function
 */
export const getAgentResponse = async (profile: UserProfile, history: Message[]) => {
  const startTime = Date.now();
  if (isDev) console.log('🤖 [Gemini] Start (via Cloud Function)');

  // Validate message length before sending (client-side check)
  const lastMessage = history[history.length - 1];
  if (lastMessage && lastMessage.content.length > MAX_MESSAGE_LENGTH) {
    return {
      message: `Your message is too long. Please keep it under ${MAX_MESSAGE_LENGTH} characters.`,
      next_step: profile.onboarding_step,
      profile_updates: {}
    };
  }

  // Limit message context to reduce payload size and cost
  const contextConfig = getContextConfig('gemini-call');
  const limitedHistory = limitMessageContext(history, {
    maxMessages: contextConfig.maxMessages,
    preserveFirst: contextConfig.preserveFirstCount,
    preserveRecent: contextConfig.preserveRecentCount
  });

  try {
    // Call the Cloud Function
    const getGeminiResponseFn = httpsCallable(functions, 'getGeminiResponse');
    
    const result = await getGeminiResponseFn({
      history: limitedHistory.map(msg => ({
        role: msg.role,
        content: msg.content
      }))
    });

    const data = result.data as {
      message: string;
      profile_updates: Partial<UserProfile>;
    };

    const isComplete = data.profile_updates.onboarded === true;
    
    if (isDev) {
      console.log(`✅ [Gemini] Done in ${Date.now() - startTime}ms`, { 
        updates: data.profile_updates 
      });
    }

    return {
      message: data.message,
      next_step: isComplete ? OnboardingStep.COMPLETE : profile.onboarding_step,
      profile_updates: data.profile_updates
    };

  } catch (error: any) {
    console.error('🚨 [Gemini] Error:', error);
    
    // Provide user-friendly error messages
    let errorMessage = "I'm having a brief hiccup. Could you repeat that?";
    
    if (error.code === 'functions/unauthenticated') {
      errorMessage = "Authentication error. Please refresh the page.";
    } else if (error.code === 'functions/deadline-exceeded') {
      errorMessage = "Request timed out. Please try again.";
    }
    
    return {
      message: errorMessage,
      next_step: profile.onboarding_step,
      profile_updates: {}
    };
  }
};

export default getAgentResponse;
