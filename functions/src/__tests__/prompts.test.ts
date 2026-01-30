/**
 * System Prompt Tests
 * 
 * Tests for dynamic system prompt generation
 */

import { buildSystemPrompt } from '../gemini/prompts';

describe('buildSystemPrompt', () => {
  it('should include current date', () => {
    const profile = { name: 'John' };
    const prompt = buildSystemPrompt(profile);

    const now = new Date();
    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const expectedDate = `${monthNames[now.getMonth()]} ${now.getFullYear()}`;

    expect(prompt).toContain(`Today: ${expectedDate}`);
  });

  it('should show NAME step when profile is empty', () => {
    const profile = {};
    const prompt = buildSystemPrompt(profile);

    expect(prompt).toContain('CURRENT STEP: NAME');
    expect(prompt).toContain('Ask for their name');
    expect(prompt).toContain('STRICT FLOW');
  });

  it('should show CHILDREN step when only name is present', () => {
    const profile = { name: 'John' };
    const prompt = buildSystemPrompt(profile);

    expect(prompt).toContain('CURRENT STEP: CHILDREN');
    expect(prompt).toContain('Ask if expecting or already have kids');
  });

  it('should show INTERESTS step when name and children are present', () => {
    const profile = {
      name: 'John',
      children: [{ birth_year: 2020 }],
    };
    const prompt = buildSystemPrompt(profile);

    expect(prompt).toContain('CURRENT STEP: INTERESTS');
    expect(prompt).toContain('Ask about hobbies');
  });

  it('should show LOCATION step when name, children, and interests are present', () => {
    const profile = {
      name: 'John',
      children: [{ birth_year: 2020 }],
      interests: ['hiking'],
    };
    const prompt = buildSystemPrompt(profile);

    expect(prompt).toContain('CURRENT STEP: LOCATION');
    expect(prompt).toContain('city and state');
  });

  it('should show CONFIRM step when all fields are present', () => {
    const profile = {
      name: 'John',
      children: [{ birth_year: 2020 }],
      interests: ['hiking'],
      location: { city: 'Austin', state_code: 'TX' },
    };
    const prompt = buildSystemPrompt(profile);

    expect(prompt).toContain('CURRENT STEP: CONFIRM');
    expect(prompt).toContain('Show summary and ask user to confirm');
  });

  it('should show COMPLETE step when onboarded', () => {
    const profile = {
      name: 'John',
      children: [{ birth_year: 2020 }],
      interests: ['hiking'],
      location: { city: 'Austin', state_code: 'TX' },
      onboarded: true,
    };
    const prompt = buildSystemPrompt(profile);

    expect(prompt).toContain('CURRENT STEP: COMPLETE');
    expect(prompt).toContain('USER IS DONE - FAQ MODE');
    expect(prompt).not.toContain('STRICT FLOW');
  });

  it('should format children correctly with month', () => {
    const profile = {
      name: 'John',
      children: [
        { birth_year: 2020, birth_month: 6, gender: 'Boy' },
      ],
    };
    const prompt = buildSystemPrompt(profile);

    expect(prompt).toContain('Children: 6/2020 (Boy)');
  });

  it('should format children correctly without month', () => {
    const profile = {
      name: 'John',
      children: [
        { birth_year: 2020 },
      ],
    };
    const prompt = buildSystemPrompt(profile);

    expect(prompt).toContain('Children: 2020');
  });

  it('should identify expecting children', () => {
    const futureYear = new Date().getFullYear() + 1;
    const profile = {
      name: 'John',
      children: [
        { birth_year: futureYear, birth_month: 6 },
      ],
    };
    const prompt = buildSystemPrompt(profile);

    expect(prompt).toContain(`Children: expecting 6/${futureYear}`);
  });

  it('should handle multiple children', () => {
    const profile = {
      name: 'John',
      children: [
        { birth_year: 2020, birth_month: 6, gender: 'Boy' },
        { birth_year: 2022, birth_month: 3, gender: 'Girl' },
      ],
    };
    const prompt = buildSystemPrompt(profile);

    expect(prompt).toContain('Children: 6/2020 (Boy), 3/2022 (Girl)');
  });

  it('should show ❌ none for missing fields', () => {
    const profile = {};
    const prompt = buildSystemPrompt(profile);

    expect(prompt).toContain('Name: ❌ none');
    expect(prompt).toContain('Children: ❌ none');
    expect(prompt).toContain('Interests: ❌ none');
    expect(prompt).toContain('Location: ❌ none');
    expect(prompt).toContain('Complete: ❌');
  });

  it('should show ✅ for completed profile', () => {
    const profile = {
      name: 'John',
      children: [{ birth_year: 2020 }],
      interests: ['hiking'],
      location: { city: 'Austin', state_code: 'TX' },
      onboarded: true,
    };
    const prompt = buildSystemPrompt(profile);

    expect(prompt).toContain('Complete: ✅');
  });

  it('should format location correctly', () => {
    const profile = {
      name: 'John',
      location: { city: 'Austin', state_code: 'TX' },
    };
    const prompt = buildSystemPrompt(profile);

    expect(prompt).toContain('Location: Austin, TX');
  });

  it('should format interests correctly', () => {
    const profile = {
      name: 'John',
      interests: ['hiking', 'gaming', 'cooking'],
    };
    const prompt = buildSystemPrompt(profile);

    expect(prompt).toContain('Interests: hiking, gaming, cooking');
  });

  it('should include critical rules in non-onboarded state', () => {
    const profile = { name: 'John' };
    const prompt = buildSystemPrompt(profile);

    expect(prompt).toContain('ONE question at a time');
    expect(prompt).toContain('Do NOT skip steps');
    expect(prompt).toContain('ALWAYS ask "Do you have any other kids?"');
    expect(prompt).toContain('update_profile');
  });

  it('should include FAQ info in onboarded state', () => {
    const profile = {
      name: 'John',
      children: [{ birth_year: 2020 }],
      interests: ['hiking'],
      location: { city: 'Austin', state_code: 'TX' },
      onboarded: true,
    };
    const prompt = buildSystemPrompt(profile);

    expect(prompt).toContain('4-6 local dads');
    expect(prompt).toContain('matched by location');
    expect(prompt).toContain('playdates, sports, coffee');
  });

  it('should disable markdown formatting', () => {
    const profile = {};
    const prompt = buildSystemPrompt(profile);

    expect(prompt).toContain('Do NOT use Markdown formatting');
    expect(prompt).toContain('no **, *, #');
    expect(prompt).toContain('plain text only');
  });
});
