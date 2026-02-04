/**
 * Dialog Manager
 *
 * Deterministic onboarding flow that decides the next question
 * based on the validated profile state. The LLM only extracts data.
 */

import { isProfileComplete, DialogSignals } from './validation';

interface UserProfile {
  name?: string;
  children?: Array<{ birth_year: number; birth_month?: number; gender?: string }>;
  interests?: string[];
  location?: { city: string; state_code: string; country_code?: string };
  onboarded?: boolean;
  children_complete?: boolean;
}

export interface DialogResult {
  message: string;
  nextStep: string;
  shouldComplete: boolean;
}

const completionMessage =
  "You're all set! We'll match you with a Dad Circle and send you an email soon. Feel free to ask me anything about how it works.";

const formatChildrenSummary = (children: UserProfile['children']): string => {
  if (!children?.length) return 'None';
  const now = new Date();
  return children.map((c) => {
    const date = c.birth_month ? `${c.birth_month}/${c.birth_year}` : `${c.birth_year}`;
    const isExpecting = c.birth_year > now.getFullYear() ||
      (c.birth_year === now.getFullYear() && c.birth_month && c.birth_month > now.getMonth() + 1);
    return `${isExpecting ? 'Expecting ' : ''}${date}${c.gender ? ` (${c.gender})` : ''}`;
  }).join(', ');
};

const buildSummary = (profile: UserProfile): string => {
  const lines: string[] = [];
  if (profile.name) lines.push(`Name: ${profile.name}`);
  lines.push(`Kids: ${formatChildrenSummary(profile.children)}`);
  lines.push(`Interests: ${profile.interests?.length ? profile.interests.join(', ') : 'None'}`);
  if (profile.location?.city && profile.location?.state_code) {
    const countrySuffix = profile.location.country_code && profile.location.country_code !== 'US'
      ? `, ${profile.location.country_code}`
      : '';
    lines.push(`Location: ${profile.location.city}, ${profile.location.state_code}${countrySuffix}`);
  }
  return `Here's what I have:\n\n${lines.join('\n')}\n\nLook good?`;
};

const determineNextStep = (profile: UserProfile, signals: DialogSignals): string => {
  if (profile.onboarded) return 'complete';

  const hasName = !!profile.name;
  const hasChildren = Array.isArray(profile.children) && profile.children.length > 0;
  const childrenConfirmed = profile.children_complete === true;
  const hasInterests = profile.interests !== undefined;
  const hasLocation = !!(profile.location?.city && profile.location?.state_code);

  if (!hasName && !hasChildren && !hasInterests && !hasLocation) return 'name';
  if (!hasChildren || signals.needsChildBirthdate) return 'child_info';
  if (signals.hasMoreChildren) return 'child_info';
  if (!childrenConfirmed) return 'siblings';
  if (!hasInterests) return 'interests';
  if (!hasLocation) return 'location';
  return 'confirm';
};

const promptForStep = (step: string, profile: UserProfile, signals: DialogSignals): string => {
  switch (step) {
    case 'name':
      return "First things first, what's your name?";
    case 'child_info':
      if (signals.needsChildBirthdate) {
        return "Got it. What month and year were they born? (For example: March 2022)";
      }
      if (signals.hasMoreChildren) {
        return "Tell me about your other kid(s): what month and year were they born or due?";
      }
      return profile.name
        ? `Nice to meet you, ${profile.name}! Are you expecting or do you already have kids? If yes, what month and year?`
        : "Are you expecting or do you already have kids? If yes, what month and year?";
    case 'siblings':
      return 'Do you have any other kids?';
    case 'interests':
      return 'What are some of your hobbies or interests? (Hiking, gaming, cooking, sports, etc.)';
    case 'location':
      return 'What city and state/region are you in? If you’re outside the US, include the country. (Example: Austin, TX or Sydney, NSW, AU)';
    case 'confirm':
      return buildSummary(profile);
    case 'complete':
      return completionMessage;
    default:
      return "I want to make sure I have your info right. Let's keep going.";
  }
};

export const buildDialogResponse = (
  profile: UserProfile,
  updates: Partial<UserProfile>,
  signals: DialogSignals
): DialogResult => {
  const merged = { ...profile, ...updates };

  if (merged.onboarded) {
    return { message: completionMessage, nextStep: 'complete', shouldComplete: true };
  }

  if (signals.confirmProfile && isProfileComplete(merged)) {
    return { message: completionMessage, nextStep: 'complete', shouldComplete: true };
  }

  const nextStep = determineNextStep(merged, signals);
  return {
    message: promptForStep(nextStep, merged, signals),
    nextStep,
    shouldComplete: nextStep === 'complete'
  };
};
