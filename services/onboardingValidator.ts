/**
 * Onboarding Validation Service
 * 
 * Validates onboarding state transitions to prevent prompt injection attacks
 * and ensure data integrity before triggering sensitive actions like email sending.
 * 
 * SECURITY: This validator acts as a safeguard against LLM output manipulation.
 * Even if an attacker uses prompt injection to make the LLM return 'complete' status,
 * this validator will reject the transition unless all required data is present.
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

  // Required fields for completion
  if (!profile.name || profile.name.trim() === '') {
    errors.push('Name is required');
  }

  if (!profile.children || profile.children.length === 0) {
    errors.push('At least one child is required');
  } else {
    // Validate each child has required fields
    profile.children.forEach((child, index) => {
      if (!child.type || (child.type !== 'expecting' && child.type !== 'existing')) {
        errors.push(`Child ${index + 1}: Invalid type`);
      }
      // birth_month is optional, but if provided must be valid
      if (child.birth_month !== undefined && (child.birth_month < 1 || child.birth_month > 12)) {
        errors.push(`Child ${index + 1}: Invalid birth month`);
      }
      if (!child.birth_year || child.birth_year < 2020 || child.birth_year > 2030) {
        errors.push(`Child ${index + 1}: Invalid birth year`);
      }
    });
  }

  if (!profile.location || !profile.location.city || !profile.location.state_code) {
    errors.push('Location (city and state) is required');
  }

  // Interests are optional but should be an array if present
  if (profile.interests && !Array.isArray(profile.interests)) {
    errors.push('Interests must be an array');
  }

  return {
    isValid: errors.length === 0,
    errors,
    canTransition: errors.length === 0
  };
};

/**
 * Validates if a state transition is allowed based on current profile data
 * 
 * SECURITY: This is the main defense against prompt injection attacks.
 * It ensures that the LLM cannot skip steps or complete onboarding prematurely.
 */
export const validateStateTransition = (
  profile: UserProfile,
  currentStep: OnboardingStep,
  nextStep: OnboardingStep
): ValidationResult => {
  const errors: string[] = [];

  // Define valid state transitions
  const validTransitions: Record<OnboardingStep, OnboardingStep[]> = {
    [OnboardingStep.WELCOME]: [OnboardingStep.NAME],
    [OnboardingStep.NAME]: [OnboardingStep.STATUS, OnboardingStep.CHILD_INFO],
    [OnboardingStep.STATUS]: [OnboardingStep.CHILD_INFO],
    [OnboardingStep.CHILD_INFO]: [OnboardingStep.SIBLINGS, OnboardingStep.INTERESTS],
    [OnboardingStep.SIBLINGS]: [OnboardingStep.INTERESTS],
    [OnboardingStep.INTERESTS]: [OnboardingStep.LOCATION],
    [OnboardingStep.LOCATION]: [OnboardingStep.CONFIRM],
    [OnboardingStep.CONFIRM]: [OnboardingStep.COMPLETE, OnboardingStep.CONFIRM], // Can stay in confirm or move to complete
    [OnboardingStep.COMPLETE]: [OnboardingStep.COMPLETE] // Can only stay in complete
  };

  // Check if transition is in the valid list
  const allowedNextSteps = validTransitions[currentStep] || [];
  if (!allowedNextSteps.includes(nextStep)) {
    errors.push(`Invalid transition from ${currentStep} to ${nextStep}`);
  }

  // Special validation for COMPLETE transition
  if (nextStep === OnboardingStep.COMPLETE) {
    // Must be coming from CONFIRM step
    if (currentStep !== OnboardingStep.CONFIRM) {
      errors.push('Can only transition to COMPLETE from CONFIRM step');
    }

    // Validate profile completeness
    const completenessValidation = validateProfileCompleteness(profile);
    if (!completenessValidation.isValid) {
      errors.push('Profile is incomplete for completion');
      errors.push(...completenessValidation.errors);
    }
  }

  // Validate required data for each step
  switch (nextStep) {
    case OnboardingStep.STATUS:
    case OnboardingStep.CHILD_INFO:
      if (!profile.name || profile.name.trim() === '') {
        errors.push('Name must be collected before moving to status/child_info');
      }
      break;

    case OnboardingStep.SIBLINGS:
    case OnboardingStep.INTERESTS:
      if (!profile.children || profile.children.length === 0) {
        errors.push('At least one child must be collected before moving to siblings/interests');
      }
      break;

    case OnboardingStep.LOCATION:
      if (!profile.children || profile.children.length === 0) {
        errors.push('At least one child must be collected before moving to location');
      }
      break;

    case OnboardingStep.CONFIRM:
      if (!profile.name || !profile.children || profile.children.length === 0) {
        errors.push('Name and children must be collected before confirmation');
      }
      if (!profile.location || !profile.location.city || !profile.location.state_code) {
        errors.push('Location must be collected before confirmation');
      }
      break;
  }

  return {
    isValid: errors.length === 0,
    errors,
    canTransition: errors.length === 0
  };
};

/**
 * Validates LLM response before applying it to the profile
 * 
 * This is the main entry point for validation in the chat interface.
 */
export const validateLLMResponse = (
  profile: UserProfile,
  suggestedNextStep: OnboardingStep,
  profileUpdates: Partial<UserProfile>
): ValidationResult => {
  // Create a simulated profile with the updates applied
  const updatedProfile = {
    ...profile,
    ...profileUpdates
  };

  // Validate the state transition
  return validateStateTransition(
    updatedProfile,
    profile.onboarding_step,
    suggestedNextStep
  );
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
  console.warn('🚨 [SECURITY] Onboarding validation failed', {
    sessionId,
    currentStep,
    suggestedNextStep,
    errors,
    timestamp: new Date().toISOString()
  });

  // In production, you might want to send this to a security monitoring service
  // or log aggregation system for analysis
};
