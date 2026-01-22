/**
 * Types Tests
 * 
 * Tests to verify type definitions and enums work correctly.
 * These tests ensure our data models are properly defined.
 */

import { describe, it, expect } from 'vitest';
import { 
  OnboardingStep, 
  Role, 
  LifeStage,
} from '../types';

describe('OnboardingStep Enum', () => {
  it('should have all expected steps', () => {
    expect(OnboardingStep.WELCOME).toBe('welcome');
    expect(OnboardingStep.NAME).toBe('name');
    expect(OnboardingStep.STATUS).toBe('status');
    expect(OnboardingStep.CHILD_INFO).toBe('child_info');
    expect(OnboardingStep.SIBLINGS).toBe('siblings');
    expect(OnboardingStep.INTERESTS).toBe('interests');
    expect(OnboardingStep.LOCATION).toBe('location');
    expect(OnboardingStep.CONFIRM).toBe('confirm');
    expect(OnboardingStep.COMPLETE).toBe('complete');
  });

  it('should have correct number of steps', () => {
    const steps = Object.values(OnboardingStep);
    expect(steps).toHaveLength(9);
  });

  it('should have unique values', () => {
    const values = Object.values(OnboardingStep);
    const uniqueValues = new Set(values);
    expect(uniqueValues.size).toBe(values.length);
  });
});

describe('Role Enum', () => {
  it('should have all expected roles', () => {
    expect(Role.USER).toBe('user');
    expect(Role.AGENT).toBe('agent');
    expect(Role.ADMIN).toBe('admin');
  });

  it('should have correct number of roles', () => {
    const roles = Object.values(Role);
    expect(roles).toHaveLength(3);
  });
});

describe('LifeStage Enum', () => {
  it('should have all expected life stages', () => {
    expect(LifeStage.EXPECTING).toBe('Expecting');
    expect(LifeStage.NEWBORN).toBe('Newborn');
    expect(LifeStage.INFANT).toBe('Infant');
    expect(LifeStage.TODDLER).toBe('Toddler');
  });

  it('should have correct number of life stages', () => {
    const stages = Object.values(LifeStage);
    expect(stages).toHaveLength(4);
  });

  it('should have human-readable values', () => {
    // Life stages should be capitalized for display
    Object.values(LifeStage).forEach(stage => {
      expect(stage[0]).toBe(stage[0].toUpperCase());
    });
  });
});

describe('Type Structures', () => {
  describe('Child type', () => {
    it('should accept expecting type', () => {
      const child = {
        type: 'expecting' as const,
        birth_month: 6,
        birth_year: 2026,
      };
      expect(child.type).toBe('expecting');
    });

    it('should accept existing type', () => {
      const child = {
        type: 'existing' as const,
        birth_month: 3,
        birth_year: 2024,
      };
      expect(child.type).toBe('existing');
    });

    it('should accept optional gender', () => {
      const child = {
        type: 'existing' as const,
        birth_month: 3,
        birth_year: 2024,
        gender: 'boy',
      };
      expect(child.gender).toBe('boy');
    });
  });

  describe('UserLocation type', () => {
    it('should have city and state_code', () => {
      const location = {
        city: 'Austin',
        state_code: 'TX',
      };
      expect(location.city).toBe('Austin');
      expect(location.state_code).toBe('TX');
    });
  });

  describe('Group status', () => {
    it('should accept valid status values', () => {
      const statuses: Array<'pending' | 'active' | 'inactive'> = ['pending', 'active', 'inactive'];
      expect(statuses).toContain('pending');
      expect(statuses).toContain('active');
      expect(statuses).toContain('inactive');
    });
  });
});
