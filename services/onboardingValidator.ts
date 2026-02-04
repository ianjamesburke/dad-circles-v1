/**
 * Onboarding Validation Service - Simplified
 * 
 * Only validates that we have required data before marking complete.
 * No more step-by-step state machine nonsense.
 */

import { UserProfile, OnboardingStep } from '../types';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  canTransition: boolean;
}

/**
 * Validates if a profile has all required data to complete onboarding
 */
export const validateProfileCompleteness = (profile: UserProfile): ValidationResult => {
  const errors: string[] = [];

  if (!profile.children || profile.children.length === 0) {
    errors.push('At least one child is required');
  } else {
    profile.children.forEach((child, index) => {
      if (child.birth_month !== undefined && (child.birth_month < 1 || child.birth_month > 12)) {
        errors.push(`Child ${index + 1}: Invalid birth month`);
      }
      if (!child.birth_year || child.birth_year < 2010 || child.birth_year > 2099) {
        errors.push(`Child ${index + 1}: Invalid birth year`);
      }
    });
  }

  if (
    !profile.location ||
    !profile.location.city ||
    !profile.location.state_code ||
    profile.location_confirmed !== true
  ) {
    errors.push('Location (city and state/region) is required');
  }
  if (profile.location?.country_code && !/^[A-Z]{2}$/.test(profile.location.country_code.toUpperCase())) {
    errors.push('Location country code must be a 2-letter code');
  }

  if (profile.interests === undefined) {
    errors.push('Interests are required (can be empty)');
  }

  if (profile.children_complete !== true) {
    errors.push('Children list not confirmed complete');
  }

  return {
    isValid: errors.length === 0,
    errors,
    canTransition: errors.length === 0
  };
};

/**
 * Validates LLM response before applying it
 * 
 * Simplified: Only block completion if profile is incomplete.
 * All other transitions are allowed.
 */
export const validateLLMResponse = (
  profile: UserProfile,
  suggestedNextStep: OnboardingStep,
  profileUpdates: Partial<UserProfile>
): ValidationResult => {
  // Merge updates to check the resulting profile
  const updatedProfile = { ...profile, ...profileUpdates };

  // Only validate when trying to complete
  if (suggestedNextStep === OnboardingStep.COMPLETE) {
    return validateProfileCompleteness(updatedProfile);
  }

  // All other transitions are fine
  return { isValid: true, errors: [], canTransition: true };
};

/**
 * Logs validation failures for security monitoring
 */
export const logValidationFailure = (
  sessionId: string,
  currentStep: OnboardingStep,
  suggestedNextStep: OnboardingStep,
  errors: string[]
): void => {
  console.warn('🚨 [Validation] Failed', {
    sessionId,
    currentStep,
    suggestedNextStep,
    errors,
    timestamp: new Date().toISOString()
  });
};
