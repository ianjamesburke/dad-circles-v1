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

const isDev = import.meta.env.DEV;

/**
 * Get agent response by calling the secure backend Cloud Function
 */
export const getAgentResponse = async (profile: UserProfile, history: Message[]) => {
  const startTime = Date.now();
  if (isDev) console.log('🤖 [Gemini] Start (via Cloud Function)');

  // Limit message context to reduce payload size and cost
  const limitedHistory = limitMessageContext(history, {
    maxMessages: 30,
    preserveFirst: 2,
    preserveRecent: 28
  });

  try {
    // Call the Cloud Function
    const getGeminiResponseFn = httpsCallable(functions, 'getGeminiResponse');
    
    const result = await getGeminiResponseFn({
      profile: {
        session_id: profile.session_id,
        name: profile.name,
        children: profile.children,
        interests: profile.interests,
        location: profile.location,
        onboarded: profile.onboarded,
        onboarding_step: profile.onboarding_step
      },
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
