import { describe, it, expect } from 'vitest';
import {
  validateProfileCompleteness,
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

    it('should pass validation when name is missing but required fields exist', () => {
      const profile = createUserProfile({
        name: '',
        children: [createChildWithAge(6)],
        location: createLocation()
      });

      const result = validateProfileCompleteness(profile);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
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

    it('should fail validation for invalid child birth month', () => {
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

    it('should fail validation for invalid child birth year', () => {
      const profile = createUserProfile({
        name: 'John',
        children: [
          {
            birth_year: 2010 // Too old
          }
        ],
        location: createLocation()
      });

      const result = validateProfileCompleteness(profile);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('Invalid birth year'))).toBe(true);
    });

    it('should pass validation when birth_month is undefined (optional)', () => {
      const profile = createUserProfile({
        name: 'John',
        children: [
          {
            birth_year: 2023
            // birth_month intentionally omitted
          }
        ],
        location: createLocation()
      });

      const result = validateProfileCompleteness(profile);

      expect(result.isValid).toBe(true);
    });

    it('should pass validation for child without type (inferred from date)', () => {
      const profile = createUserProfile({
        name: 'John',
        children: [
          {
            birth_year: 2023,
            birth_month: 6
            // type intentionally omitted - inferred from date
          }
        ],
        location: createLocation()
      });

      const result = validateProfileCompleteness(profile);

      expect(result.isValid).toBe(true);
    });
  });

  describe('validateLLMResponse', () => {
    it('should allow any transition except COMPLETE when profile is incomplete', () => {
      const profile = createUserProfile({
        name: 'John',
        children: [],
        onboarding_step: OnboardingStep.NAME
      });

      // Non-COMPLETE transitions should always be allowed
      const result = validateLLMResponse(
        profile,
        OnboardingStep.CHILD_INFO,
        {}
      );

      expect(result.isValid).toBe(true);
    });

    it('should block COMPLETE transition when profile is incomplete', () => {
      const profile = createUserProfile({
        name: 'John',
        children: [],
        onboarding_step: OnboardingStep.NAME
      });

      const result = validateLLMResponse(
        profile,
        OnboardingStep.COMPLETE,
        {}
      );

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('At least one child is required');
    });

    it('should allow COMPLETE transition with valid profile', () => {
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

    it('should validate profile updates are applied before checking', () => {
      const profile = createUserProfile({
        name: 'John',
        children: [],
        location: createLocation(),
        onboarding_step: OnboardingStep.CHILD_INFO
      });

      // LLM provides child in profile_updates
      const result = validateLLMResponse(
        profile,
        OnboardingStep.COMPLETE,
        { children: [createChildWithAge(6)] }
      );

      expect(result.isValid).toBe(true);
    });

    it('should block COMPLETE when location is missing', () => {
      const profile = createUserProfile({
        name: 'John',
        children: [createChildWithAge(6)],
        location: undefined
      });

      const result = validateLLMResponse(
        profile,
        OnboardingStep.COMPLETE,
        {}
      );

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Location (city and state) is required');
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

    it('should block completion even with partial data', () => {
      const profile = createUserProfile({
        name: 'Attacker',
        children: [createChildWithAge(6)],
        location: undefined // Missing location
      });

      const result = validateLLMResponse(
        profile,
        OnboardingStep.COMPLETE,
        {}
      );

      expect(result.isValid).toBe(false);
    });

    it('should allow completion when all required data is present', () => {
      const profile = createUserProfile({
        name: 'John',
        children: [createChildWithAge(6)],
        location: createLocation()
      });

      const result = validateLLMResponse(
        profile,
        OnboardingStep.COMPLETE,
        {}
      );

      expect(result.isValid).toBe(true);
    });
  });
});
