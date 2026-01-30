/**
 * Fallback Generation Tests
 * 
 * Tests for contextual fallback message generation
 */

import { generateFallback } from '../gemini/fallbacks';

describe('generateFallback', () => {
  it('should return FAQ message when onboarded', () => {
    const profile = {
      name: 'John',
      children: [{ birth_year: 2020 }],
      location: { city: 'Austin', state_code: 'TX' },
      onboarded: true,
    };

    const message = generateFallback(profile, {});

    expect(message).toContain("You're all set");
    expect(message).toContain('email');
  });

  it('should ask for name when missing', () => {
    const profile = {};

    const message = generateFallback(profile, {});

    expect(message).toContain("What's your name");
  });

  it('should ask about children when missing', () => {
    const profile = {
      name: 'John',
    };

    const message = generateFallback(profile, {});

    expect(message).toContain('Nice to meet you, John');
    expect(message).toContain('expecting');
    expect(message).toContain('kids');
  });

  it('should ask about interests when missing', () => {
    const profile = {
      name: 'John',
      children: [{ birth_year: 2020 }],
    };

    const message = generateFallback(profile, {});

    expect(message).toContain('hobbies');
    expect(message).toContain('interests');
  });

  it('should ask about location when missing', () => {
    const profile = {
      name: 'John',
      children: [{ birth_year: 2020 }],
      interests: ['hiking'],
    };

    const message = generateFallback(profile, {});

    expect(message).toContain('city');
    expect(message).toContain('state');
  });

  it('should show confirmation summary when all fields present', () => {
    const now = new Date();
    const futureYear = now.getFullYear() + 1;
    
    const profile = {
      name: 'John',
      children: [
        { birth_year: 2020, birth_month: 6, gender: 'Boy' },
        { birth_year: futureYear, birth_month: 3 } // Expecting
      ],
      interests: ['hiking', 'gaming'],
      location: { city: 'Austin', state_code: 'TX' },
    };

    const message = generateFallback(profile, {});

    expect(message).toContain('Name: John');
    expect(message).toContain('Kids:');
    expect(message).toContain('6/2020 (Boy)');
    expect(message).toContain(`Expecting 3/${futureYear}`);
    expect(message).toContain('Interests: hiking, gaming');
    expect(message).toContain('Location: Austin, TX');
    expect(message).toContain('Look good');
  });

  it('should handle children without birth month', () => {
    const profile = {
      name: 'John',
      children: [{ birth_year: 2020 }],
      interests: ['hiking'],
      location: { city: 'Austin', state_code: 'TX' },
    };

    const message = generateFallback(profile, {});

    expect(message).toContain('Kids: 2020');
    expect(message).not.toContain('undefined');
  });

  it('should correctly identify expecting vs existing children', () => {
    const now = new Date();
    const futureYear = now.getFullYear() + 1;
    const pastYear = now.getFullYear() - 2;

    const profile = {
      name: 'John',
      children: [
        { birth_year: futureYear, birth_month: 6 },
        { birth_year: pastYear, birth_month: 3 },
      ],
      interests: ['hiking'],
      location: { city: 'Austin', state_code: 'TX' },
    };

    const message = generateFallback(profile, {});

    expect(message).toContain(`Expecting 6/${futureYear}`);
    expect(message).toContain(`3/${pastYear}`);
    expect(message).not.toContain(`Expecting 3/${pastYear}`);
  });

  it('should include pending updates in profile state', () => {
    const profile = {
      name: 'John',
    };

    const updates = {
      children: [{ birth_year: 2020 }],
      interests: ['hiking'],
      location: { city: 'Austin', state_code: 'TX' },
    };

    const message = generateFallback(profile, updates);

    // Should show summary because merged profile is complete
    expect(message).toContain('Name: John');
    expect(message).toContain('Kids: 2020');
    expect(message).toContain('Interests: hiking');
    expect(message).toContain('Location: Austin, TX');
  });

  it('should ask for interests when empty array provided', () => {
    // When interests is an empty array, it's treated as "missing"
    const profile = {
      name: 'John',
      children: [{ birth_year: 2020 }],
      interests: [],
      location: { city: 'Austin', state_code: 'TX' },
    };

    const message = generateFallback(profile, {});

    // Should ask for interests, not show summary
    expect(message).toContain('hobbies');
    expect(message).toContain('interests');
  });
});
