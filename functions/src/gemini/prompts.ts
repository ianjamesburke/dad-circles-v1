/**
 * Gemini System Prompt Generation
 * 
 * Builds dynamic system prompts based on current profile state.
 * Guides the conversation flow through onboarding steps.
 */

interface UserProfile {
  name?: string;
  children?: Array<{ birth_year: number; birth_month?: number; gender?: string }>;
  interests?: string[];
  location?: { city: string; state_code: string };
  onboarded?: boolean;
}

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

/**
 * Format current date as "MMM YYYY"
 */
const formatCurrentDate = (): string => {
  const now = new Date();
  return `${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`;
};

/**
 * Format children display for prompt
 */
const formatChildren = (children: UserProfile['children']): string => {
  if (!children?.length) return '❌ none';
  
  const now = new Date();
  return children.map(c => {
    const date = c.birth_month ? `${c.birth_month}/${c.birth_year}` : `${c.birth_year}`;
    const isExpecting = c.birth_year > now.getFullYear() || 
      (c.birth_year === now.getFullYear() && c.birth_month && c.birth_month > now.getMonth() + 1);
    return `${isExpecting ? 'expecting ' : ''}${date}${c.gender ? ` (${c.gender})` : ''}`;
  }).join(', ');
};

/**
 * Determine current onboarding step and next action
 */
const determineNextStep = (profile: UserProfile): { step: string; action: string } => {
  if (profile.onboarded) {
    return { 
      step: 'COMPLETE', 
      action: 'Answer questions about Dad Circles' 
    };
  }
  
  const hasName = !!profile.name;
  const hasChildren = profile.children && profile.children.length > 0;
  const hasInterests = profile.interests && profile.interests.length > 0;
  const hasLocation = profile.location?.city && profile.location?.state_code;
  
  if (hasName && hasChildren && hasInterests && hasLocation) {
    return { 
      step: 'CONFIRM', 
      action: 'Show summary and ask user to confirm' 
    };
  }
  if (hasName && hasChildren && hasInterests) {
    return { 
      step: 'LOCATION', 
      action: hasLocation 
        ? `Confirm location is correct: "${profile.location!.city}, ${profile.location!.state_code}"`
        : 'Ask what city and state they are in'
    };
  }
  if (hasName && hasChildren) {
    return { 
      step: 'INTERESTS', 
      action: 'Ask about hobbies/interests (hiking, gaming, sports, cooking, etc.)' 
    };
  }
  if (hasName) {
    return { 
      step: 'CHILDREN', 
      action: 'Ask if expecting or already have kids, get birth/due dates' 
    };
  }
  
  return { 
    step: 'NAME', 
    action: 'Ask for their name' 
  };
};

/**
 * Build system prompt for Gemini based on current profile state
 * 
 * @param profile - Current user profile
 * @returns System prompt string
 */
export const buildSystemPrompt = (profile: UserProfile): string => {
  const currentDate = formatCurrentDate();
  const childrenDisplay = formatChildren(profile.children);
  const locationDisplay = profile.location?.city 
    ? `${profile.location.city}, ${profile.location.state_code}` 
    : '❌ none';
  const { step, action } = determineNextStep(profile);

  return `You are the Dad Circles onboarding assistant. Be warm, friendly, concise.

FORMATTING: Do NOT use Markdown formatting (no **, *, #, etc.). Use plain text only.

Today: ${currentDate}

CURRENT PROFILE:
• Name: ${profile.name || '❌ none'}
• Children: ${childrenDisplay}
• Interests: ${profile.interests?.length ? profile.interests.join(', ') : '❌ none'}
• Location: ${locationDisplay}
• Complete: ${profile.onboarded ? '✅' : '❌'}

CURRENT STEP: ${step}
YOUR NEXT ACTION: ${action}

${profile.onboarded ? `
USER IS DONE - FAQ MODE
Answer questions about Dad Circles:
- Groups of 4-6 local dads matched by location and kids' ages
- They'll get an email with their group soon
- Activities: playdates, sports, coffee, outdoor stuff
` : `
STRICT FLOW - FOLLOW THIS ORDER:
1. NAME → Get their first name
2. CHILDREN → Ask if expecting or have kids. Get birth/due year. Ask for month if they give age like "she's 3".
   IMPORTANT: After first child, ALWAYS ask "Do you have any other kids?" before moving on.
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

Call update_profile whenever you learn new info. Include ALL children in the array (don't lose existing ones).
`}`;
};
