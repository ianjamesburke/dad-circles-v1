import { describe, it, expect } from 'vitest';
import {
  validateProfileCompleteness,
  validateStateTransition,
  validateLLMResponse
} from '../../services/onboardingValidator';
import { OnboardingStep } from '../../types';
import { createUserProfile, createChildWithAge, createLocation } from '../factories';

describe('onboardingValidator', () => {
  describe('validateProfileCompleteness', () => {
    it('should pass validation for a complete profile', () => {
      const profile = createUserProfile({
        name: 'John',
        children: [createChildWithAge(6)],
        location: createLocation(),
        interests: ['hiking', 'gaming']
      });

      const result = validateProfileCompleteness(profile);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.canTransition).toBe(true);
    });

    it('should fail validation when name is missing', () => {
      const profile = createUserProfile({
        name: '',
        children: [createChildWithAge(6)],
        location: createLocation()
      });

      const result = validateProfileCompleteness(profile);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Name is required');
    });

    it('should fail validation when children are missing', () => {
      const profile = createUserProfile({
        name: 'John',
        children: [],
        location: createLocation()
      });

      const result = validateProfileCompleteness(profile);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('At least one child is required');
    });

    it('should fail validation when location is missing', () => {
      const profile = createUserProfile({
        name: 'John',
        children: [createChildWithAge(6)],
        location: undefined
      });

      const result = validateProfileCompleteness(profile);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Location (city and state) is required');
    });

    it('should fail validation for invalid child data', () => {
      const profile = createUserProfile({
        name: 'John',
        children: [
          {
            type: 'existing',
            birth_month: 13, // Invalid month
            birth_year: 2023
          }
        ],
        location: createLocation()
      });

      const result = validateProfileCompleteness(profile);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('Invalid birth month'))).toBe(true);
    });
  });

  describe('validateStateTransition', () => {
    it('should allow valid transition from WELCOME to NAME', () => {
      const profile = createUserProfile({
        onboarding_step: OnboardingStep.WELCOME
      });

      const result = validateStateTransition(
        profile,
        OnboardingStep.WELCOME,
        OnboardingStep.NAME
      );

      expect(result.isValid).toBe(true);
      expect(result.canTransition).toBe(true);
    });

    it('should block invalid transition from WELCOME to COMPLETE', () => {
      const profile = createUserProfile({
        onboarding_step: OnboardingStep.WELCOME
      });

      const result = validateStateTransition(
        profile,
        OnboardingStep.WELCOME,
        OnboardingStep.COMPLETE
      );

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('Invalid transition'))).toBe(true);
    });

    it('should block transition to COMPLETE from non-CONFIRM step', () => {
      const profile = createUserProfile({
        name: 'John',
        children: [createChildWithAge(6)],
        location: createLocation(),
        onboarding_step: OnboardingStep.LOCATION
      });

      const result = validateStateTransition(
        profile,
        OnboardingStep.LOCATION,
        OnboardingStep.COMPLETE
      );

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('Can only transition to COMPLETE from CONFIRM'))).toBe(true);
    });

    it('should block transition to COMPLETE with incomplete profile', () => {
      const profile = createUserProfile({
        name: 'John',
        children: [], // Missing children
        location: createLocation(),
        onboarding_step: OnboardingStep.CONFIRM
      });

      const result = validateStateTransition(
        profile,
        OnboardingStep.CONFIRM,
        OnboardingStep.COMPLETE
      );

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('Profile is incomplete'))).toBe(true);
    });

    it('should allow transition to COMPLETE from CONFIRM with complete profile', () => {
      const profile = createUserProfile({
        name: 'John',
        children: [createChildWithAge(6)],
        location: createLocation(),
        interests: ['hiking'],
        onboarding_step: OnboardingStep.CONFIRM
      });

      const result = validateStateTransition(
        profile,
        OnboardingStep.CONFIRM,
        OnboardingStep.COMPLETE
      );

      expect(result.isValid).toBe(true);
      expect(result.canTransition).toBe(true);
    });

    it('should require name before moving to STATUS', () => {
      const profile = createUserProfile({
        name: '',
        onboarding_step: OnboardingStep.NAME
      });

      const result = validateStateTransition(
        profile,
        OnboardingStep.NAME,
        OnboardingStep.STATUS
      );

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('Name must be collected'))).toBe(true);
    });

    it('should require children before moving to LOCATION', () => {
      const profile = createUserProfile({
        name: 'John',
        children: [],
        onboarding_step: OnboardingStep.INTERESTS
      });

      const result = validateStateTransition(
        profile,
        OnboardingStep.INTERESTS,
        OnboardingStep.LOCATION
      );

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('At least one child must be collected'))).toBe(true);
    });

    it('should require location before moving to CONFIRM', () => {
      const profile = createUserProfile({
        name: 'John',
        children: [createChildWithAge(6)],
        location: undefined,
        onboarding_step: OnboardingStep.LOCATION
      });

      const result = validateStateTransition(
        profile,
        OnboardingStep.LOCATION,
        OnboardingStep.CONFIRM
      );

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('Location must be collected'))).toBe(true);
    });
  });

  describe('validateLLMResponse', () => {
    it('should validate LLM response with profile updates', () => {
      const profile = createUserProfile({
        name: 'John',
        onboarding_step: OnboardingStep.NAME
      });

      const result = validateLLMResponse(
        profile,
        OnboardingStep.STATUS,
        { name: 'John' }
      );

      expect(result.isValid).toBe(true);
    });

    it('should block malicious LLM response trying to skip to COMPLETE', () => {
      const profile = createUserProfile({
        name: 'John',
        children: [],
        onboarding_step: OnboardingStep.NAME
      });

      // Simulate prompt injection attack: LLM tries to skip to COMPLETE
      const result = validateLLMResponse(
        profile,
        OnboardingStep.COMPLETE,
        {}
      );

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should allow COMPLETE transition with valid profile updates', () => {
      const profile = createUserProfile({
        name: 'John',
        children: [createChildWithAge(6)],
        location: createLocation(),
        onboarding_step: OnboardingStep.CONFIRM
      });

      const result = validateLLMResponse(
        profile,
        OnboardingStep.COMPLETE,
        {}
      );

      expect(result.isValid).toBe(true);
    });

    it('should validate profile updates are applied before checking transition', () => {
      const profile = createUserProfile({
        name: '',
        onboarding_step: OnboardingStep.NAME
      });

      // LLM provides name in profile_updates
      const result = validateLLMResponse(
        profile,
        OnboardingStep.STATUS,
        { name: 'John' }
      );

      expect(result.isValid).toBe(true);
    });
  });

  describe('Prompt Injection Attack Scenarios', () => {
    it('should block attempt to complete onboarding without required data', () => {
      const profile = createUserProfile({
        name: 'Attacker',
        children: [],
        location: undefined,
        onboarding_step: OnboardingStep.WELCOME
      });

      // Attacker tries to inject prompt to skip to complete
      const result = validateLLMResponse(
        profile,
        OnboardingStep.COMPLETE,
        {}
      );

      expect(result.isValid).toBe(false);
      expect(result.canTransition).toBe(false);
    });

    it('should block attempt to skip from NAME directly to COMPLETE', () => {
      const profile = createUserProfile({
        name: 'Attacker',
        onboarding_step: OnboardingStep.NAME
      });

      const result = validateStateTransition(
        profile,
        OnboardingStep.NAME,
        OnboardingStep.COMPLETE
      );

      expect(result.isValid).toBe(false);
    });

    it('should block attempt to complete from LOCATION without going through CONFIRM', () => {
      const profile = createUserProfile({
        name: 'John',
        children: [createChildWithAge(6)],
        location: createLocation(),
        onboarding_step: OnboardingStep.LOCATION
      });

      const result = validateStateTransition(
        profile,
        OnboardingStep.LOCATION,
        OnboardingStep.COMPLETE
      );

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('Can only transition to COMPLETE from CONFIRM'))).toBe(true);
    });
  });
});
