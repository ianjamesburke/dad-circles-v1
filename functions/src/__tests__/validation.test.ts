/**
 * Validation Tests
 * 
 * Tests for profile validation logic
 */

import { validateAndApplyUpdates, isProfileComplete } from '../gemini/validation';

jest.mock('../logger', () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  },
}));

describe('validateAndApplyUpdates', () => {
  const mockProfile = {
    name: 'John',
    children: [{ birth_year: 2020, birth_month: 6 }],
    interests: ['hiking'],
    location: { city: 'Austin', state_code: 'TX' },
  };

  describe('Name validation', () => {
    it('should accept valid name', () => {
      const { updates, errors } = validateAndApplyUpdates(
        { name: 'Mike' },
        mockProfile
      );

      expect(updates.name).toBe('Mike');
      expect(errors).toHaveLength(0);
    });

    it('should trim whitespace from name', () => {
      const { updates, errors } = validateAndApplyUpdates(
        { name: '  Mike  ' },
        mockProfile
      );

      expect(updates.name).toBe('Mike');
      expect(errors).toHaveLength(0);
    });

    it('should reject empty name', () => {
      const { updates, errors } = validateAndApplyUpdates(
        { name: '' },
        mockProfile
      );

      expect(updates.name).toBeUndefined();
      expect(errors).toContain('Invalid name');
    });

    it('should reject non-string name', () => {
      const { updates, errors } = validateAndApplyUpdates(
        { name: 123 as any },
        mockProfile
      );

      expect(updates.name).toBeUndefined();
      expect(errors).toContain('Invalid name');
    });
  });

  describe('Children validation', () => {
    it('should accept valid children', () => {
      const { updates, errors } = validateAndApplyUpdates(
        { 
          children: [
            { birth_year: 2020, birth_month: 3, gender: 'Boy' },
            { birth_year: 2025 } // Expecting
          ] 
        },
        mockProfile
      );

      expect(updates.children).toHaveLength(2);
      expect(updates.children[0]).toEqual({
        birth_year: 2020,
        birth_month: 3,
        gender: 'Boy'
      });
      expect(updates.children[1]).toEqual({
        birth_year: 2025
      });
      expect(errors).toHaveLength(0);
    });

    it('should reject invalid birth year (too old)', () => {
      const { errors } = validateAndApplyUpdates(
        { children: [{ birth_year: 2005 }] },
        mockProfile
      );

      // Config says minBirthYear: 2010, so 2005 should be rejected
      expect(errors).toContain('Invalid birth year: 2005');
    });

    it('should reject invalid birth year (too far future)', () => {
      const { errors } = validateAndApplyUpdates(
        { children: [{ birth_year: 2100 }] },
        mockProfile
      );

      // Config says maxBirthYear: 2099, so 2100 should be rejected
      expect(errors).toContain('Invalid birth year: 2100');
    });

    it('should reject invalid birth month', () => {
      const { updates, errors } = validateAndApplyUpdates(
        { children: [{ birth_year: 2020, birth_month: 13 }] },
        mockProfile
      );

      expect(updates.children).toBeUndefined();
      expect(errors).toContain('Invalid birth month: 13');
    });

    it('should accept children without birth month', () => {
      const { updates, errors } = validateAndApplyUpdates(
        { children: [{ birth_year: 2020 }] },
        mockProfile
      );

      expect(updates.children).toHaveLength(1);
      expect(updates.children[0]).toEqual({ birth_year: 2020 });
      expect(errors).toHaveLength(0);
    });

    it('should reject non-array children', () => {
      const { updates, errors } = validateAndApplyUpdates(
        { children: 'not an array' as any },
        mockProfile
      );

      expect(updates.children).toBeUndefined();
      expect(errors).toContain('Children must be an array');
    });
  });

  describe('Interests validation', () => {
    it('should accept valid interests', () => {
      const { updates, errors } = validateAndApplyUpdates(
        { interests: ['hiking', 'gaming', 'cooking'] },
        mockProfile
      );

      expect(updates.interests).toEqual(['hiking', 'gaming', 'cooking']);
      expect(errors).toHaveLength(0);
    });

    it('should trim whitespace from interests', () => {
      const { updates, errors } = validateAndApplyUpdates(
        { interests: ['  hiking  ', 'gaming'] },
        mockProfile
      );

      expect(updates.interests).toEqual(['hiking', 'gaming']);
      expect(errors).toHaveLength(0);
    });

    it('should filter out empty strings', () => {
      const { updates, errors } = validateAndApplyUpdates(
        { interests: ['hiking', '', '  ', 'gaming'] },
        mockProfile
      );

      expect(updates.interests).toEqual(['hiking', 'gaming']);
      expect(errors).toHaveLength(0);
    });

    it('should reject non-array interests', () => {
      const { updates, errors } = validateAndApplyUpdates(
        { interests: 'hiking' as any },
        mockProfile
      );

      expect(updates.interests).toBeUndefined();
      expect(errors).toContain('Interests must be an array');
    });
  });

  describe('Location validation', () => {
    it('should accept valid city and state', () => {
      const { updates, errors } = validateAndApplyUpdates(
        { city: 'Austin', state_code: 'TX' },
        mockProfile
      );

      expect(updates.location).toEqual({
        city: 'Austin',
        state_code: 'TX'
      });
      expect(errors).toHaveLength(0);
    });

    it('should normalize state code to uppercase', () => {
      const { updates, errors } = validateAndApplyUpdates(
        { city: 'Austin', state_code: 'tx' },
        mockProfile
      );

      expect(updates.location).toEqual({
        city: 'Austin',
        state_code: 'TX'
      });
      expect(errors).toHaveLength(0);
    });

    it('should reject invalid state code format', () => {
      const { updates, errors } = validateAndApplyUpdates(
        { city: 'Austin', state_code: 'Texas' },
        mockProfile
      );

      expect(updates.location).toBeUndefined();
      expect(errors).toContain('Location needs both city and 2-letter state code');
    });

    it('should reject city without state', () => {
      const { updates, errors } = validateAndApplyUpdates(
        { city: 'Austin' },
        mockProfile
      );

      expect(updates.location).toBeUndefined();
      expect(errors).toContain('Location needs both city and 2-letter state code');
    });

    it('should reject state without city', () => {
      const { updates, errors } = validateAndApplyUpdates(
        { state_code: 'TX' },
        mockProfile
      );

      expect(updates.location).toBeUndefined();
      expect(errors).toContain('Location needs both city and 2-letter state code');
    });
  });

  describe('Onboarded flag validation', () => {
    it('should allow onboarding completion when profile is complete', () => {
      const completeProfile = {
        children: [{ birth_year: 2020 }],
        location: { city: 'Austin', state_code: 'TX' },
      };

      const { updates, errors } = validateAndApplyUpdates(
        { onboarded: true },
        completeProfile
      );

      expect(updates.onboarded).toBe(true);
      expect(errors).toHaveLength(0);
    });

    it('should allow onboarding when name is missing but required fields exist', () => {
      const incompleteProfile = {
        children: [{ birth_year: 2020 }],
        location: { city: 'Austin', state_code: 'TX' },
      };

      const { updates, errors } = validateAndApplyUpdates(
        { onboarded: true },
        incompleteProfile
      );

      expect(updates.onboarded).toBe(true);
      expect(errors).toHaveLength(0);
    });

    it('should reject onboarding when missing children', () => {
      const incompleteProfile = {
        name: 'John',
        location: { city: 'Austin', state_code: 'TX' },
      };

      const { updates, errors } = validateAndApplyUpdates(
        { onboarded: true },
        incompleteProfile
      );

      expect(updates.onboarded).toBeUndefined();
      expect(errors).toContain('Cannot complete: missing required fields');
    });

    it('should reject onboarding when missing location', () => {
      const incompleteProfile = {
        name: 'John',
        children: [{ birth_year: 2020 }],
      };

      const { updates, errors } = validateAndApplyUpdates(
        { onboarded: true },
        incompleteProfile
      );

      expect(updates.onboarded).toBeUndefined();
      expect(errors).toContain('Cannot complete: missing required fields');
    });
  });

  describe('Multiple fields', () => {
    it('should validate and apply multiple fields', () => {
      const { updates, errors } = validateAndApplyUpdates(
        {
          name: 'Mike',
          children: [{ birth_year: 2020 }],
          interests: ['hiking'],
          city: 'Austin',
          state_code: 'TX'
        },
        {}
      );

      expect(updates.name).toBe('Mike');
      expect(updates.children).toHaveLength(1);
      expect(updates.interests).toEqual(['hiking']);
      expect(updates.location).toEqual({ city: 'Austin', state_code: 'TX' });
      expect(errors).toHaveLength(0);
    });

    it('should collect all errors', () => {
      const { errors } = validateAndApplyUpdates(
        {
          name: '',
          children: [{ birth_year: 2005 }], // Below minBirthYear (2010)
          interests: 'not-array' as any,
          city: 'Austin',
        },
        {}
      );

      expect(errors.length).toBeGreaterThan(0);
      expect(errors).toContain('Invalid name');
      expect(errors).toContain('Invalid birth year: 2005');
      expect(errors).toContain('Interests must be an array');
      expect(errors).toContain('Location needs both city and 2-letter state code');
    });
  });
});

describe('isProfileComplete', () => {
  it('should return true for complete profile', () => {
    const profile = {
      children: [{ birth_year: 2020 }],
      location: { city: 'Austin', state_code: 'TX' },
    };

    expect(isProfileComplete(profile)).toBe(true);
  });

  it('should return true when name is missing but other required fields exist', () => {
    const profile = {
      children: [{ birth_year: 2020 }],
      location: { city: 'Austin', state_code: 'TX' },
    };

    expect(isProfileComplete(profile)).toBe(true);
  });

  it('should return false when missing children', () => {
    const profile = {
      name: 'John',
      children: [],
      location: { city: 'Austin', state_code: 'TX' },
    };

    expect(isProfileComplete(profile)).toBe(false);
  });

  it('should return false when missing location', () => {
    const profile = {
      children: [{ birth_year: 2020 }],
    };

    expect(isProfileComplete(profile)).toBe(false);
  });

  it('should return false when location is incomplete', () => {
    const profile = {
      name: 'John',
      children: [{ birth_year: 2020 }],
      location: { city: 'Austin' },
    };

    expect(isProfileComplete(profile as any)).toBe(false);
  });
});
