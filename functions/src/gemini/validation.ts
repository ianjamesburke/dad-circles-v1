/**
 * Profile Validation - Unified Source of Truth
 * 
 * Validates and applies profile updates from Gemini function calls.
 * This is the single source of truth for all profile validation logic.
 */

import { logger } from '../logger';
import { CONFIG } from '../config';

interface ProfileUpdate {
  name?: string;
  children?: Array<{ birth_year: number; birth_month?: number; gender?: string }>;
  interests?: string[];
  city?: string;
  state_code?: string;
  onboarded?: boolean;
}

interface UserProfile {
  name?: string;
  children?: any[];
  interests?: string[];
  location?: { city: string; state_code: string };
  onboarded?: boolean;
}

/**
 * Validate and apply profile updates
 * 
 * @param args - Profile update arguments from Gemini
 * @param currentProfile - Current user profile state
 * @returns Object containing validated updates and any validation errors
 */
export const validateAndApplyUpdates = (
  args: ProfileUpdate, 
  currentProfile: UserProfile
): { updates: any; errors: string[] } => {
  const updates: any = {};
  const errors: string[] = [];

  // Name validation - simple string
  if (args.name !== undefined) {
    if (typeof args.name === 'string' && args.name.trim()) {
      updates.name = args.name.trim();
    } else {
      errors.push('Invalid name');
    }
  }

  // Children validation - validate each child
  if (args.children !== undefined) {
    if (Array.isArray(args.children)) {
      const validChildren: any[] = [];
      for (const child of args.children) {
        // Validate birth year
        if (!child.birth_year || 
            child.birth_year < CONFIG.validation.minBirthYear || 
            child.birth_year > CONFIG.validation.maxBirthYear) {
          errors.push(`Invalid birth year: ${child.birth_year}`);
          continue;
        }
        // Validate birth month if provided
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

  // Interests validation - array of strings
  if (args.interests !== undefined) {
    if (Array.isArray(args.interests)) {
      const normalized = args.interests
        .filter(i => typeof i === 'string' && i.trim())
        .map(i => i.trim());
      const lower = normalized.map(i => i.toLowerCase());
      const noneTokens = new Set(['none', 'no', 'nope', 'nah', 'n/a', 'na', 'nothing', 'no interests', 'no hobbies']);
      if (normalized.length === 0 || (normalized.length === 1 && noneTokens.has(lower[0]))) {
        updates.interests = [];
      } else {
        updates.interests = normalized;
      }
    } else {
      errors.push('Interests must be an array');
    }
  }

  // Location validation - need both city and state_code
  if (args.city !== undefined || args.state_code !== undefined) {
    const city = args.city?.trim();
    const state = args.state_code?.trim().toUpperCase();
    
    if (city && state && CONFIG.validation.stateCodePattern.test(state)) {
      updates.location = { city, state_code: state };
    } else if (city || state) {
      errors.push('Location needs both city and 2-letter state code');
    }
  }

  // Onboarding completion - only allow if profile is complete
  if (args.onboarded === true) {
    const merged = { ...currentProfile, ...updates };
    
    if (isProfileComplete(merged)) {
      updates.onboarded = true;
    } else {
      errors.push('Cannot complete: missing required fields');
    }
  }

  if (errors.length) {
    logger.warn('Validation errors:', { errors });
  }
  
  return { updates, errors };
};

/**
 * Check if profile has all required fields for completion
 * 
 * @param profile - User profile to check
 * @returns True if profile is complete, false otherwise
 */
export const isProfileComplete = (profile: UserProfile): boolean => {
  return !!(
    profile.children && profile.children.length > 0 &&
    profile.location?.city && profile.location?.state_code
  );
};
