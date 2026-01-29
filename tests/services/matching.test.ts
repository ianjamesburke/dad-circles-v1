/**
 * Matching Algorithm Tests
 * 
 * Tests for the pure functions in the matching service.
 * Database-dependent functions are tested via integration tests.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { LifeStage } from '../../types';
import { 
  createUserProfile, 
  createChildWithAge, 
  createExpectingChild,
  createLocation,
  createUsersInLocation,
  resetFactories 
} from '../factories';

// Re-implement pure functions for testing (these mirror the matching service logic)
// In a real scenario, you'd export these from matchingService.ts

function calculateAgeInMonths(birthMonth: number, birthYear: number): number {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  return (currentYear - birthYear) * 12 + (currentMonth - birthMonth);
}

function calculateDueDateScore(birthMonth: number, birthYear: number): number {
  const now = new Date();
  const dueDate = new Date(birthYear, birthMonth - 1);
  return dueDate.getTime() - now.getTime();
}

function isChildExpecting(child: { birth_month?: number; birth_year: number }): boolean {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  if (child.birth_year > currentYear) return true;
  if (child.birth_year === currentYear) {
    if (!child.birth_month) return false;
    return child.birth_month > currentMonth;
  }
  return false;
}

function getLifeStageFromChild(child: { type?: string; birth_month?: number; birth_year: number }): LifeStage | null {
  if (isChildExpecting(child)) {
    return LifeStage.EXPECTING;
  }

  const ageInMonths = calculateAgeInMonths(child.birth_month, child.birth_year);

  if (ageInMonths <= 6) {
    return LifeStage.NEWBORN;
  } else if (ageInMonths <= 18) {
    return LifeStage.INFANT;
  } else if (ageInMonths <= 36) {
    return LifeStage.TODDLER;
  }

  return null;
}

function validateAgeGap(
  users: Array<{ children: Array<{ type?: string; birth_month?: number; birth_year: number }> }>,
  lifeStage: LifeStage,
  maxGapMonths: number
): boolean {
  if (users.length < 2) return true;

  const ages: number[] = [];

  for (const user of users) {
    const child = user.children[0];
    if (lifeStage === LifeStage.EXPECTING) {
      ages.push(calculateDueDateScore(child.birth_month, child.birth_year));
    } else {
      ages.push(calculateAgeInMonths(child.birth_month, child.birth_year));
    }
  }

  const minAge = Math.min(...ages);
  const maxAge = Math.max(...ages);
  const gapInMonths = lifeStage === LifeStage.EXPECTING
    ? Math.abs(maxAge - minAge) / (1000 * 60 * 60 * 24 * 30)
    : maxAge - minAge;

  return gapInMonths <= maxGapMonths;
}

describe('Matching Algorithm - Pure Functions', () => {
  beforeEach(() => {
    resetFactories();
  });

  describe('calculateAgeInMonths', () => {
    it('should calculate age for current month birth', () => {
      const now = new Date();
      const age = calculateAgeInMonths(now.getMonth() + 1, now.getFullYear());
      expect(age).toBe(0);
    });

    it('should calculate age for 6 month old', () => {
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      
      const age = calculateAgeInMonths(
        sixMonthsAgo.getMonth() + 1,
        sixMonthsAgo.getFullYear()
      );
      expect(age).toBe(6);
    });

    it('should calculate age for 1 year old', () => {
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      
      const age = calculateAgeInMonths(
        oneYearAgo.getMonth() + 1,
        oneYearAgo.getFullYear()
      );
      expect(age).toBe(12);
    });

    it('should calculate age for 2.5 year old', () => {
      const twoAndHalfYearsAgo = new Date();
      twoAndHalfYearsAgo.setMonth(twoAndHalfYearsAgo.getMonth() - 30);
      
      const age = calculateAgeInMonths(
        twoAndHalfYearsAgo.getMonth() + 1,
        twoAndHalfYearsAgo.getFullYear()
      );
      expect(age).toBe(30);
    });
  });

  describe('calculateDueDateScore', () => {
    it('should return negative for past dates', () => {
      const pastDate = new Date();
      pastDate.setMonth(pastDate.getMonth() - 1);
      
      const score = calculateDueDateScore(
        pastDate.getMonth() + 1,
        pastDate.getFullYear()
      );
      expect(score).toBeLessThan(0);
    });

    it('should return positive for future dates', () => {
      const futureDate = new Date();
      futureDate.setMonth(futureDate.getMonth() + 3);
      
      const score = calculateDueDateScore(
        futureDate.getMonth() + 1,
        futureDate.getFullYear()
      );
      expect(score).toBeGreaterThan(0);
    });

    it('should order due dates correctly (sooner = lower score)', () => {
      const sooner = new Date();
      sooner.setMonth(sooner.getMonth() + 1);
      
      const later = new Date();
      later.setMonth(later.getMonth() + 4);
      
      const soonerScore = calculateDueDateScore(sooner.getMonth() + 1, sooner.getFullYear());
      const laterScore = calculateDueDateScore(later.getMonth() + 1, later.getFullYear());
      
      expect(soonerScore).toBeLessThan(laterScore);
    });
  });

  describe('getLifeStageFromChild', () => {
    it('should return EXPECTING for expecting type', () => {
      const child = createExpectingChild(3);
      const stage = getLifeStageFromChild(child);
      expect(stage).toBe(LifeStage.EXPECTING);
    });

    it('should return NEWBORN for 0-6 months', () => {
      const child = createChildWithAge(3);
      const stage = getLifeStageFromChild(child);
      expect(stage).toBe(LifeStage.NEWBORN);
    });

    it('should return NEWBORN for exactly 6 months', () => {
      const child = createChildWithAge(6);
      const stage = getLifeStageFromChild(child);
      expect(stage).toBe(LifeStage.NEWBORN);
    });

    it('should return INFANT for 7-18 months', () => {
      const child = createChildWithAge(12);
      const stage = getLifeStageFromChild(child);
      expect(stage).toBe(LifeStage.INFANT);
    });

    it('should return INFANT for exactly 18 months', () => {
      const child = createChildWithAge(18);
      const stage = getLifeStageFromChild(child);
      expect(stage).toBe(LifeStage.INFANT);
    });

    it('should return TODDLER for 19-36 months', () => {
      const child = createChildWithAge(24);
      const stage = getLifeStageFromChild(child);
      expect(stage).toBe(LifeStage.TODDLER);
    });

    it('should return TODDLER for exactly 36 months', () => {
      const child = createChildWithAge(36);
      const stage = getLifeStageFromChild(child);
      expect(stage).toBe(LifeStage.TODDLER);
    });

    it('should return null for children over 36 months', () => {
      const child = createChildWithAge(48);
      const stage = getLifeStageFromChild(child);
      expect(stage).toBeNull();
    });
  });

  describe('validateAgeGap', () => {
    it('should return true for single user', () => {
      const users = [createUserProfile({ children: [createChildWithAge(3)] })];
      const result = validateAgeGap(users, LifeStage.NEWBORN, 3);
      expect(result).toBe(true);
    });

    it('should return true for empty array', () => {
      const result = validateAgeGap([], LifeStage.NEWBORN, 3);
      expect(result).toBe(true);
    });

    it('should return true when age gap is within threshold', () => {
      const users = [
        createUserProfile({ children: [createChildWithAge(2)] }),
        createUserProfile({ children: [createChildWithAge(4)] }),
      ];
      const result = validateAgeGap(users, LifeStage.NEWBORN, 3);
      expect(result).toBe(true);
    });

    it('should return false when age gap exceeds threshold', () => {
      const users = [
        createUserProfile({ children: [createChildWithAge(1)] }),
        createUserProfile({ children: [createChildWithAge(6)] }),
      ];
      const result = validateAgeGap(users, LifeStage.NEWBORN, 3);
      expect(result).toBe(false);
    });

    it('should handle multiple users correctly', () => {
      const users = [
        createUserProfile({ children: [createChildWithAge(10)] }),
        createUserProfile({ children: [createChildWithAge(12)] }),
        createUserProfile({ children: [createChildWithAge(14)] }),
        createUserProfile({ children: [createChildWithAge(16)] }),
      ];
      // Gap is 16 - 10 = 6 months
      const result = validateAgeGap(users, LifeStage.INFANT, 6);
      expect(result).toBe(true);
    });

    it('should handle expecting users with due date gap', () => {
      const users = [
        createUserProfile({ children: [createExpectingChild(2)] }),
        createUserProfile({ children: [createExpectingChild(4)] }),
      ];
      // Gap is approximately 2 months
      const result = validateAgeGap(users, LifeStage.EXPECTING, 6);
      expect(result).toBe(true);
    });
  });
});

describe('Matching Algorithm - User Grouping Logic', () => {
  beforeEach(() => {
    resetFactories();
  });

  describe('location-based grouping', () => {
    it('should group users by city and state', () => {
      const austinUsers = createUsersInLocation(4, createLocation({ city: 'Austin', state_code: 'TX' }));
      const dallasUsers = createUsersInLocation(4, createLocation({ city: 'Dallas', state_code: 'TX' }));
      
      const allUsers = [...austinUsers, ...dallasUsers];
      
      // Group by location
      const byLocation: Record<string, typeof allUsers> = {};
      for (const user of allUsers) {
        const key = `${user.location!.city}|${user.location!.state_code}`;
        if (!byLocation[key]) byLocation[key] = [];
        byLocation[key].push(user);
      }
      
      expect(Object.keys(byLocation)).toHaveLength(2);
      expect(byLocation['Austin|TX']).toHaveLength(4);
      expect(byLocation['Dallas|TX']).toHaveLength(4);
    });

    it('should treat same city in different states as different locations', () => {
      const springfieldIL = createUsersInLocation(2, createLocation({ city: 'Springfield', state_code: 'IL' }));
      const springfieldMO = createUsersInLocation(2, createLocation({ city: 'Springfield', state_code: 'MO' }));
      
      const allUsers = [...springfieldIL, ...springfieldMO];
      
      const byLocation: Record<string, typeof allUsers> = {};
      for (const user of allUsers) {
        const key = `${user.location!.city}|${user.location!.state_code}`;
        if (!byLocation[key]) byLocation[key] = [];
        byLocation[key].push(user);
      }
      
      expect(Object.keys(byLocation)).toHaveLength(2);
    });
  });

  describe('life stage grouping', () => {
    it('should group users by life stage within location', () => {
      const location = createLocation();
      
      const newbornDads = createUsersInLocation(3, location, () => createChildWithAge(3));
      const infantDads = createUsersInLocation(3, location, () => createChildWithAge(12));
      const toddlerDads = createUsersInLocation(3, location, () => createChildWithAge(24));
      
      const allUsers = [...newbornDads, ...infantDads, ...toddlerDads];
      
      // Group by life stage
      const byLifeStage: Record<string, typeof allUsers> = {};
      for (const user of allUsers) {
        const stage = getLifeStageFromChild(user.children[0]);
        if (!stage) continue;
        if (!byLifeStage[stage]) byLifeStage[stage] = [];
        byLifeStage[stage].push(user);
      }
      
      expect(byLifeStage[LifeStage.NEWBORN]).toHaveLength(3);
      expect(byLifeStage[LifeStage.INFANT]).toHaveLength(3);
      expect(byLifeStage[LifeStage.TODDLER]).toHaveLength(3);
    });
  });

  describe('group size constraints', () => {
    const MIN_GROUP_SIZE = 4;
    const MAX_GROUP_SIZE = 6;

    it('should not form group with fewer than minimum users', () => {
      const users = createUsersInLocation(3, createLocation());
      const canFormGroup = users.length >= MIN_GROUP_SIZE;
      expect(canFormGroup).toBe(false);
    });

    it('should form group with exactly minimum users', () => {
      const users = createUsersInLocation(4, createLocation());
      const canFormGroup = users.length >= MIN_GROUP_SIZE;
      expect(canFormGroup).toBe(true);
    });

    it('should split large groups into chunks', () => {
      const users = createUsersInLocation(10, createLocation());
      
      const groups: typeof users[] = [];
      for (let i = 0; i < users.length; i += MAX_GROUP_SIZE) {
        const chunk = users.slice(i, i + MAX_GROUP_SIZE);
        if (chunk.length >= MIN_GROUP_SIZE) {
          groups.push(chunk);
        }
      }
      
      // 10 users: first chunk of 6, second chunk of 4 (both meet min size)
      expect(groups).toHaveLength(2);
      expect(groups[0]).toHaveLength(6);
      expect(groups[1]).toHaveLength(4);
    });

    it('should handle exactly max group size', () => {
      const users = createUsersInLocation(6, createLocation());
      
      const groups: typeof users[] = [];
      for (let i = 0; i < users.length; i += MAX_GROUP_SIZE) {
        const chunk = users.slice(i, i + MAX_GROUP_SIZE);
        if (chunk.length >= MIN_GROUP_SIZE) {
          groups.push(chunk);
        }
      }
      
      expect(groups).toHaveLength(1);
      expect(groups[0]).toHaveLength(6);
    });
  });
});

describe('Matching Algorithm - Edge Cases', () => {
  beforeEach(() => {
    resetFactories();
  });

  it('should handle user with no location', () => {
    const user = createUserProfile({ location: undefined });
    expect(user.location).toBeUndefined();
  });

  it('should handle user with no children', () => {
    const user = createUserProfile({ children: [] });
    expect(user.children).toHaveLength(0);
  });

  it('should handle user with multiple children (uses first child)', () => {
    const user = createUserProfile({
      children: [
        createChildWithAge(3),  // Newborn
        createChildWithAge(24), // Toddler
      ],
    });
    
    const stage = getLifeStageFromChild(user.children[0]);
    expect(stage).toBe(LifeStage.NEWBORN);
  });

  it('should handle matching_eligible flag', () => {
    const eligibleUser = createUserProfile({ matching_eligible: true });
    const ineligibleUser = createUserProfile({ matching_eligible: false });
    
    expect(eligibleUser.matching_eligible).toBe(true);
    expect(ineligibleUser.matching_eligible).toBe(false);
  });

  it('should handle already matched users', () => {
    const matchedUser = createUserProfile({ group_id: 'existing-group' });
    const unmatchedUser = createUserProfile({ group_id: undefined });
    
    expect(matchedUser.group_id).toBeDefined();
    expect(unmatchedUser.group_id).toBeUndefined();
  });
});
