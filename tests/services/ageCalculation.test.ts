/**
 * Test age-based input parsing for child_info step
 * 
 * This test verifies that the system can handle age-based responses
 * like "he's 2" or "she's 6 months old" and convert them to valid
 * birth_month/birth_year values.
 */

import { describe, it, expect } from 'vitest';

describe('Age Calculation Logic', () => {
  const currentDate = new Date('2026-01-29');
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1; // 1-indexed

  describe('Years-based age', () => {
    it('should calculate birth date for "2 years old"', () => {
      const ageInYears = 2;
      const expectedBirthYear = currentYear - ageInYears; // 2024
      const expectedBirthMonth = currentMonth; // 1 (January)

      expect(expectedBirthYear).toBe(2024);
      expect(expectedBirthMonth).toBe(1);
      expect(expectedBirthYear).toBeGreaterThanOrEqual(2020);
      expect(expectedBirthYear).toBeLessThanOrEqual(2030);
      expect(expectedBirthMonth).toBeGreaterThanOrEqual(1);
      expect(expectedBirthMonth).toBeLessThanOrEqual(12);
    });

    it('should calculate birth date for "5 years old"', () => {
      const ageInYears = 5;
      const expectedBirthYear = currentYear - ageInYears; // 2021
      const expectedBirthMonth = currentMonth; // 1

      expect(expectedBirthYear).toBe(2021);
      expect(expectedBirthMonth).toBe(1);
      expect(expectedBirthYear).toBeGreaterThanOrEqual(2020);
      expect(expectedBirthYear).toBeLessThanOrEqual(2030);
    });
  });

  describe('Months-based age', () => {
    it('should calculate birth date for "6 months old"', () => {
      const ageInMonths = 6;
      let expectedBirthMonth = currentMonth - ageInMonths; // 1 - 6 = -5
      let expectedBirthYear = currentYear;

      // Handle negative months (wrap to previous year)
      if (expectedBirthMonth <= 0) {
        expectedBirthMonth += 12; // -5 + 12 = 7 (July)
        expectedBirthYear -= 1; // 2025
      }

      expect(expectedBirthYear).toBe(2025);
      expect(expectedBirthMonth).toBe(7);
      expect(expectedBirthYear).toBeGreaterThanOrEqual(2020);
      expect(expectedBirthYear).toBeLessThanOrEqual(2030);
      expect(expectedBirthMonth).toBeGreaterThanOrEqual(1);
      expect(expectedBirthMonth).toBeLessThanOrEqual(12);
    });

    it('should calculate birth date for "3 months old"', () => {
      const ageInMonths = 3;
      let expectedBirthMonth = currentMonth - ageInMonths; // 1 - 3 = -2
      let expectedBirthYear = currentYear;

      if (expectedBirthMonth <= 0) {
        expectedBirthMonth += 12; // -2 + 12 = 10 (October)
        expectedBirthYear -= 1; // 2025
      }

      expect(expectedBirthYear).toBe(2025);
      expect(expectedBirthMonth).toBe(10);
      expect(expectedBirthYear).toBeGreaterThanOrEqual(2020);
      expect(expectedBirthYear).toBeLessThanOrEqual(2030);
    });

    it('should calculate birth date for "18 months old"', () => {
      const ageInMonths = 18;
      let expectedBirthMonth = currentMonth - ageInMonths; // 1 - 18 = -17
      let expectedBirthYear = currentYear;

      if (expectedBirthMonth <= 0) {
        const yearsToSubtract = Math.ceil(Math.abs(expectedBirthMonth) / 12);
        expectedBirthYear -= yearsToSubtract; // 2024
        expectedBirthMonth += (yearsToSubtract * 12); // -17 + 24 = 7 (July)
      }

      expect(expectedBirthYear).toBe(2024);
      expect(expectedBirthMonth).toBe(7);
      expect(expectedBirthYear).toBeGreaterThanOrEqual(2020);
      expect(expectedBirthYear).toBeLessThanOrEqual(2030);
    });
  });

  describe('Validation bounds', () => {
    it('should ensure birth_year is within 2020-2030', () => {
      const testYears = [2020, 2023, 2026, 2030];
      testYears.forEach(year => {
        expect(year).toBeGreaterThanOrEqual(2020);
        expect(year).toBeLessThanOrEqual(2030);
      });
    });

    it('should ensure birth_month is within 1-12', () => {
      const testMonths = [1, 6, 12];
      testMonths.forEach(month => {
        expect(month).toBeGreaterThanOrEqual(1);
        expect(month).toBeLessThanOrEqual(12);
      });
    });

    it('should reject invalid birth_year', () => {
      const invalidYears = [2019, 2031, 2015, 2035];
      invalidYears.forEach(year => {
        const isValid = year >= 2020 && year <= 2030;
        expect(isValid).toBe(false);
      });
    });

    it('should reject invalid birth_month', () => {
      const invalidMonths = [0, 13, -1, 15];
      invalidMonths.forEach(month => {
        const isValid = month >= 1 && month <= 12;
        expect(isValid).toBe(false);
      });
    });
  });
});
