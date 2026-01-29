/**
 * Gemini Service - Ultra Simplified
 * 
 * One tool: update_profile. That's it.
 * LLM collects info naturally, updates whatever fields it has.
 * When profile is complete and user confirms, set onboarded=true.
 */

import { GoogleGenAI, FunctionCallingConfigMode, Type, ThinkingLevel } from '@google/genai';
import type { FunctionDeclaration, Content } from '@google/genai';
import { UserProfile, Message, OnboardingStep, Child } from "../types";
import { limitMessageContext } from "./contextManager";

const isDev = import.meta.env.DEV;
const MODEL_NAME = 'gemini-3-flash-preview';

let aiClient: GoogleGenAI | null = null;
const getAIClient = (): GoogleGenAI => {
  if (!aiClient) {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) throw new Error('VITE_GEMINI_API_KEY not found');
    aiClient = new GoogleGenAI({ apiKey });
  }
  return aiClient;
};

// ============================================================================
// ONE TOOL TO RULE THEM ALL
// ============================================================================

const toolDeclarations: FunctionDeclaration[] = [
  {
    name: 'update_profile',
    description: `Update user profile fields. Call this whenever you learn new info about the user.
    
IMPORTANT RULES:
- Only include fields you have CONFIRMED data for
- If user says "she's 3" without a month, ASK for the month first - don't guess
- For children: birth_year required, birth_month optional (1-12). We infer expecting vs existing from the date.
- For location: need both city and state_code (2-letter like CA, TX, NY)
- Set onboarded=true ONLY when user explicitly confirms their info is correct`,
    parameters: {
      type: Type.OBJECT,
      properties: {
        name: { 
          type: Type.STRING, 
          description: 'User\'s first name' 
        },
        children: {
          type: Type.ARRAY,
          description: 'Array of children. Each needs: birth_year (number). Optional: birth_month (1-12), gender ("Boy"|"Girl"). Future dates = expecting, past dates = existing.',
          items: {
            type: Type.OBJECT,
            properties: {
              birth_year: { type: Type.NUMBER, description: 'Birth year or due year (e.g., 2023, 2025)' },
              birth_month: { type: Type.NUMBER, description: 'Month 1-12. Only include if user explicitly said it.' },
              gender: { type: Type.STRING, enum: ['Boy', 'Girl'] }
            },
            required: ['birth_year']
          }
        },
        interests: {
          type: Type.ARRAY,
          description: 'List of hobbies/interests',
          items: { type: Type.STRING }
        },
        city: { 
          type: Type.STRING, 
          description: 'City name' 
        },
        state_code: { 
          type: Type.STRING, 
          description: 'Two-letter state code (CA, TX, NY, etc.)' 
        },
        onboarded: {
          type: Type.BOOLEAN,
          description: 'Set to true ONLY when user explicitly confirms all info is correct'
        }
      }
    }
  }
];

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

const buildSystemPrompt = (profile: UserProfile): string => {
  const now = new Date();
  const currentDate = `${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][now.getMonth()]} ${now.getFullYear()}`;
  
  const childrenDisplay = profile.children?.length 
    ? profile.children.map(c => {
        const date = c.birth_month ? `${c.birth_month}/${c.birth_year}` : `${c.birth_year}`;
        const now = new Date();
        const isExp = c.birth_year > now.getFullYear() || 
          (c.birth_year === now.getFullYear() && c.birth_month && c.birth_month > now.getMonth() + 1);
        return `${isExp ? 'expecting ' : ''}${date}${c.gender ? ` (${c.gender})` : ''}`;
      }).join(', ')
    : '❌ none';

  const locationDisplay = profile.location?.city 
    ? `${profile.location.city}, ${profile.location.state_code}` 
    : '❌ none';

  // Determine current step based on what's collected
  let currentStep = 'NAME';
  let nextAction = 'Ask for their name';
  
  if (profile.onboarded) {
    currentStep = 'COMPLETE';
    nextAction = 'Answer questions about Dad Circles';
  } else if (profile.name && profile.children?.length && profile.interests?.length && profile.location?.city) {
    currentStep = 'CONFIRM';
    nextAction = 'Show summary and ask user to confirm';
  } else if (profile.name && profile.children?.length && profile.interests?.length) {
    currentStep = 'LOCATION';
    nextAction = profile.location?.city 
      ? `Confirm location is correct: "${profile.location.city}, ${profile.location.state_code}"`
      : 'Ask what city and state they are in';
  } else if (profile.name && profile.children?.length) {
    currentStep = 'INTERESTS';
    nextAction = 'Ask about hobbies/interests (hiking, gaming, sports, cooking, etc.)';
  } else if (profile.name) {
    currentStep = 'CHILDREN';
    nextAction = 'Ask if expecting or already have kids, get birth/due dates';
  } else {
    currentStep = 'NAME';
    nextAction = 'Ask for their name';
  }

  return `You are the Dad Circles onboarding assistant. Be warm, friendly, concise.

FORMATTING: Do NOT use Markdown formatting (no **, *, #, etc.). Use plain text only.

Today: ${currentDate}

CURRENT PROFILE:
• Name: ${profile.name || '❌ none'}
• Children: ${childrenDisplay}
• Interests: ${profile.interests?.length ? profile.interests.join(', ') : '❌ none'}
• Location: ${locationDisplay}
• Complete: ${profile.onboarded ? '✅' : '❌'}

CURRENT STEP: ${currentStep}
YOUR NEXT ACTION: ${nextAction}

${profile.onboarded ? `
USER IS DONE - FAQ MODE
Answer questions about Dad Circles:
- Groups of 4-6 local dads matched by location and kids' ages
- They'll get an email with their group soon
- Activities: playdates, sports, coffee, outdoor stuff
` : `
STRICT FLOW - FOLLOW THIS ORDER:
1. NAME → Get their first name
2. CHILDREN → Ask if expecting or have kids. Get birth/due year AND month naturally.
   EXAMPLES OF GOOD QUESTIONS:
   - "That is awesome. To help you find the right groups, what's the year/month of their birthdays? Also, do you have any other kids on the way?"
   - "Nice! When are they due? And do you have any other kids already?"
   - "Great! What are their birth months and years? Any other little ones on the way or already here?"
   
   IMPORTANT: 
   - Ask for BOTH year and month in the same question naturally
   - After getting info about kids, ALWAYS ask about other kids (on the way OR already here)
   - If user gives age like "she's 3", ask "What month was she born?"
   
3. INTERESTS → Ask about hobbies (hiking, gaming, sports, cooking, music, etc.)
4. LOCATION → If we have location from signup, confirm it's correct. Otherwise ask for city + state.
5. CONFIRM → Show summary, ask if it looks good
6. COMPLETE → Only after explicit "yes" / "looks good" / "correct"

CRITICAL RULES:
- ONE question at a time
- Do NOT skip steps - you MUST ask about interests before showing confirmation
- Do NOT skip siblings question - most dads have multiple kids
- When showing confirmation, format it clearly with line breaks
- Only set onboarded=true after user explicitly confirms
- Make questions feel natural and conversational, not robotic

Call update_profile whenever you learn new info. Include ALL children in the array (don't lose existing ones).
`}`;
};

// ============================================================================
// VALIDATION & EXECUTION
// ============================================================================

interface ProfileUpdate {
  name?: string;
  children?: Child[];
  interests?: string[];
  city?: string;
  state_code?: string;
  onboarded?: boolean;
}

const validateAndApply = (
  args: ProfileUpdate, 
  currentProfile: UserProfile
): { updates: Partial<UserProfile>; errors: string[] } => {
  const updates: Partial<UserProfile> = {};
  const errors: string[] = [];

  // Name - simple string
  if (args.name !== undefined) {
    if (typeof args.name === 'string' && args.name.trim()) {
      updates.name = args.name.trim();
    } else {
      errors.push('Invalid name');
    }
  }

  // Children - validate each child
  if (args.children !== undefined) {
    if (Array.isArray(args.children)) {
      const validChildren: Child[] = [];
      for (const child of args.children) {
        if (!child.birth_year || child.birth_year < 2015 || child.birth_year > 2035) {
          errors.push(`Invalid birth year: ${child.birth_year}`);
          continue;
        }
        if (child.birth_month !== undefined && (child.birth_month < 1 || child.birth_month > 12)) {
          errors.push(`Invalid birth month: ${child.birth_month}`);
          continue;
        }
        validChildren.push({
          birth_year: child.birth_year,
          ...(child.birth_month && { birth_month: child.birth_month }),
          ...(child.gender && { gender: child.gender })
        });
      }
      if (validChildren.length > 0) {
        updates.children = validChildren;
      }
    } else {
      errors.push('Children must be an array');
    }
  }

  // Interests - array of strings
  if (args.interests !== undefined) {
    if (Array.isArray(args.interests)) {
      updates.interests = args.interests.filter(i => typeof i === 'string' && i.trim()).map(i => i.trim());
    } else {
      errors.push('Interests must be an array');
    }
  }

  // Location - need both city and state_code
  if (args.city !== undefined || args.state_code !== undefined) {
    const city = args.city?.trim();
    const state = args.state_code?.trim().toUpperCase();
    
    if (city && state && /^[A-Z]{2}$/.test(state)) {
      updates.location = { city, state_code: state };
    } else if (city || state) {
      errors.push('Location needs both city and 2-letter state code');
    }
  }

  // Onboarded - only allow if profile will be complete
  if (args.onboarded === true) {
    const merged = { ...currentProfile, ...updates };
    const hasName = !!merged.name;
    const hasChildren = merged.children && merged.children.length > 0;
    const hasLocation = merged.location?.city && merged.location?.state_code;
    
    if (hasName && hasChildren && hasLocation) {
      updates.onboarded = true;
    } else {
      errors.push('Cannot complete: missing required fields');
    }
  }

  if (isDev && errors.length) console.warn('🚨 Validation errors:', errors);
  
  return { updates, errors };
};

// ============================================================================
// MAIN FUNCTION
// ============================================================================

export const getAgentResponse = async (profile: UserProfile, history: Message[]) => {
  const startTime = Date.now();
  if (isDev) console.log('🤖 [Gemini] Start');

  const limitedHistory = limitMessageContext(history, {
    maxMessages: 30,
    preserveFirst: 2,
    preserveRecent: 28
  });

  const contents: Content[] = limitedHistory.map(msg => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{ text: msg.content }]
  }));

  try {
    const ai = getAIClient();
    
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents,
      config: {
        systemInstruction: buildSystemPrompt(profile),
        tools: [{ functionDeclarations: toolDeclarations }],
        toolConfig: {
          functionCallingConfig: { mode: FunctionCallingConfigMode.AUTO }
        },
        thinkingConfig: {
          thinkingLevel: ThinkingLevel.MINIMAL
        },
        temperature: 0.4,
        maxOutputTokens: 512
      }
    });

    if (isDev) console.log('🤖 [Gemini] Response:', JSON.stringify(response, null, 2));

    // Process function calls
    let allUpdates: Partial<UserProfile> = {};
    
    if (response.functionCalls?.length) {
      for (const call of response.functionCalls) {
        if (call.name === 'update_profile' && call.args) {
          const { updates } = validateAndApply(
            call.args as ProfileUpdate,
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
        if ('text' in part && part.text) textResponse += part.text;
      }
    }

    // Fallback text if none provided
    if (!textResponse) {
      textResponse = generateFallback(profile, allUpdates);
    }

    const isComplete = allUpdates.onboarded === true;
    
    if (isDev) console.log(`✅ [Gemini] Done in ${Date.now() - startTime}ms`, { updates: allUpdates });

    return {
      message: textResponse,
      next_step: isComplete ? OnboardingStep.COMPLETE : profile.onboarding_step,
      profile_updates: allUpdates
    };

  } catch (error) {
    console.error('🚨 [Gemini] Error:', error);
    return {
      message: "I'm having a brief hiccup. Could you repeat that?",
      next_step: profile.onboarding_step,
      profile_updates: {}
    };
  }
};

const generateFallback = (profile: UserProfile, updates: Partial<UserProfile>): string => {
  const merged = { ...profile, ...updates };
  
  if (merged.onboarded) {
    return "You're all set! We'll match you with a Dad Circle and send you an email soon. Feel free to ask me anything about how it works!";
  }
  if (!merged.name) {
    return "Hey! What's your name?";
  }
  if (!merged.children?.length) {
    return `Nice to meet you, ${merged.name}! Are you an expecting dad or do you already have kids?`;
  }
  if (merged.children?.length === 1) {
    return "That is awesome. To help you find the right groups, what's the year/month of their birthday? Also, do you have any other kids on the way?";
  }
  if (!merged.interests?.length) {
    return "What are some of your hobbies or interests? Things like hiking, gaming, cooking, sports - whatever you're into!";
  }
  if (!merged.location) {
    return "What city and state are you in?";
  }
  
  // Have everything - show summary
  const now = new Date();
  const kids = merged.children.map(c => {
    const date = c.birth_month ? `${c.birth_month}/${c.birth_year}` : `${c.birth_year}`;
    const isExp = c.birth_year > now.getFullYear() || 
      (c.birth_year === now.getFullYear() && c.birth_month && c.birth_month > now.getMonth() + 1);
    return `${isExp ? 'Expecting ' : ''}${date}${c.gender ? ` (${c.gender})` : ''}`;
  }).join(', ');
  
  return `Here's what I have:\n\nName: ${merged.name}\nKids: ${kids}\nInterests: ${merged.interests?.join(', ') || 'None'}\nLocation: ${merged.location.city}, ${merged.location.state_code}\n\nLook good?`;
};

export default getAgentResponse;
