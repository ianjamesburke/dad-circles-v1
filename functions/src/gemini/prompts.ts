/**
 * Gemini System Prompt Generation
 *
 * Builds a strict extraction-only prompt. The dialog manager
 * handles all user-facing messaging.
 */

interface UserProfile {
  name?: string;
  children?: Array<{ birth_year: number; birth_month?: number; gender?: string }>;
  interests?: string[];
  location?: { city: string; state_code: string; country_code?: string };
  onboarded?: boolean;
  children_complete?: boolean;
}

const formatChildren = (children: UserProfile['children']): string => {
  if (!children?.length) return 'none';
  return children.map(c => {
    const date = c.birth_month ? `${c.birth_month}/${c.birth_year}` : `${c.birth_year}`;
    return `${date}${c.gender ? ` (${c.gender})` : ''}`;
  }).join(', ');
};

/**
 * Build system prompt for Gemini based on current profile state
 */
export const buildSystemPrompt = (profile: UserProfile): string => {
  const locationDisplay = profile.location?.city
    ? `${profile.location.city}, ${profile.location.state_code}${profile.location.country_code && profile.location.country_code !== 'US' ? `, ${profile.location.country_code}` : ''}`
    : 'none';

  return `You are an information extraction engine for Dad Circles onboarding.
Your ONLY job is to call the tool extract_profile with any new facts from the latest turn.

IMPORTANT RULES:
- Do not respond to the user. Only call extract_profile.
- Do NOT guess or infer missing data.
- Only include fields explicitly stated or clearly confirmed.
- If no new info, call extract_profile with an empty object.
- Use children_add for new children and children_replace only for explicit corrections.
- If user gives age only (e.g., "she's 3"), use children_age_years instead of birth_year.
- If user says they have no other kids / only one / that's it / just one, set no_more_children=true.
- If user says they have more kids but gives no details, set has_more_children=true.
- If user confirms the summary looks right, set confirm_profile=true.
- If user says they have no interests/hobbies, set interests_clear=true.
- For location, include country_code if the user says they are outside the US (e.g., AU).

CURRENT PROFILE:
Name: ${profile.name || 'none'}
Children: ${formatChildren(profile.children)}
Children complete: ${profile.children_complete === true ? 'yes' : 'no'}
Interests: ${profile.interests?.length ? profile.interests.join(', ') : profile.interests === undefined ? 'unknown' : 'none'}
Location: ${locationDisplay}
Complete: ${profile.onboarded ? 'yes' : 'no'}`;
};
