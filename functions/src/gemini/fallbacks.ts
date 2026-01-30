/**
 * Fallback Message Generation
 * 
 * Generates contextual fallback messages when Gemini doesn't provide text.
 * Ensures users always get a helpful response based on their profile state.
 */

interface UserProfile {
  name?: string;
  children?: Array<{ birth_year: number; birth_month?: number; gender?: string }>;
  interests?: string[];
  location?: { city: string; state_code: string };
  onboarded?: boolean;
}

/**
 * Generate contextual fallback message based on profile state
 * 
 * @param profile - Current user profile
 * @param updates - Pending updates to apply
 * @returns Contextual fallback message
 */
export const generateFallback = (profile: UserProfile, updates: any): string => {
  const merged = { ...profile, ...updates };
  
  // Already onboarded - FAQ mode
  if (merged.onboarded) {
    return "You're all set! We'll match you with a Dad Circle and send you an email soon. Feel free to ask me anything about how it works!";
  }
  
  // Missing name
  if (!merged.name) {
    return "Hey! What's your name?";
  }
  
  // Missing children
  if (!merged.children?.length) {
    return `Nice to meet you, ${merged.name}! Are you an expecting dad or do you already have kids?`;
  }
  
  // Missing interests
  if (!merged.interests?.length) {
    return "What are some of your hobbies or interests? Things like hiking, gaming, cooking, sports - whatever you're into!";
  }
  
  // Missing location
  if (!merged.location) {
    return "What city and state are you in?";
  }
  
  // Have everything - show confirmation summary
  const now = new Date();
  const kids = merged.children.map((c: any) => {
    const date = c.birth_month ? `${c.birth_month}/${c.birth_year}` : `${c.birth_year}`;
    const isExp = c.birth_year > now.getFullYear() || 
      (c.birth_year === now.getFullYear() && c.birth_month && c.birth_month > now.getMonth() + 1);
    return `${isExp ? 'Expecting ' : ''}${date}${c.gender ? ` (${c.gender})` : ''}`;
  }).join(', ');
  
  return `Here's what I have:\n\nName: ${merged.name}\nKids: ${kids}\nInterests: ${merged.interests?.join(', ') || 'None'}\nLocation: ${merged.location.city}, ${merged.location.state_code}\n\nLook good?`;
};
