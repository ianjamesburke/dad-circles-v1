/**
 * Tool Declarations Tests
 * 
 * Tests for Gemini function calling tool declarations
 */

import { toolDeclarations } from '../gemini/tools';
import { Type } from '@google/genai';

describe('toolDeclarations', () => {
  it('should export an array of tool declarations', () => {
    expect(Array.isArray(toolDeclarations)).toBe(true);
    expect(toolDeclarations.length).toBeGreaterThan(0);
  });

  describe('update_profile tool', () => {
    let updateProfileTool: any;

    beforeAll(() => {
      updateProfileTool = toolDeclarations.find(t => t.name === 'update_profile');
    });

    it('should exist', () => {
      expect(updateProfileTool).toBeDefined();
    });

    it('should have a description', () => {
      expect(updateProfileTool.description).toBeDefined();
      expect(updateProfileTool.description.length).toBeGreaterThan(0);
    });

    it('should have OBJECT type parameters', () => {
      expect(updateProfileTool.parameters.type).toBe(Type.OBJECT);
    });

    it('should define name property', () => {
      const nameProperty = updateProfileTool.parameters.properties.name;
      expect(nameProperty).toBeDefined();
      expect(nameProperty.type).toBe(Type.STRING);
      expect(nameProperty.description).toContain('first name');
    });

    it('should define children array property', () => {
      const childrenProperty = updateProfileTool.parameters.properties.children;
      expect(childrenProperty).toBeDefined();
      expect(childrenProperty.type).toBe(Type.ARRAY);
      expect(childrenProperty.description).toContain('birth_year');
    });

    it('should require birth_year for each child', () => {
      const childrenProperty = updateProfileTool.parameters.properties.children;
      expect(childrenProperty.items.required).toContain('birth_year');
    });

    it('should define birth_month as optional', () => {
      const childrenProperty = updateProfileTool.parameters.properties.children;
      const birthMonthProperty = childrenProperty.items.properties.birth_month;
      
      expect(birthMonthProperty).toBeDefined();
      expect(childrenProperty.items.required).not.toContain('birth_month');
    });

    it('should define gender with enum', () => {
      const childrenProperty = updateProfileTool.parameters.properties.children;
      const genderProperty = childrenProperty.items.properties.gender;
      
      expect(genderProperty).toBeDefined();
      expect(genderProperty.enum).toEqual(['Boy', 'Girl']);
    });

    it('should define interests array property', () => {
      const interestsProperty = updateProfileTool.parameters.properties.interests;
      expect(interestsProperty).toBeDefined();
      expect(interestsProperty.type).toBe(Type.ARRAY);
      expect(interestsProperty.items.type).toBe(Type.STRING);
    });

    it('should define city and state_code properties', () => {
      const cityProperty = updateProfileTool.parameters.properties.city;
      const stateCodeProperty = updateProfileTool.parameters.properties.state_code;
      
      expect(cityProperty).toBeDefined();
      expect(cityProperty.type).toBe(Type.STRING);
      
      expect(stateCodeProperty).toBeDefined();
      expect(stateCodeProperty.type).toBe(Type.STRING);
      expect(stateCodeProperty.description).toContain('Two-letter');
    });

    it('should define onboarded boolean property', () => {
      const onboardedProperty = updateProfileTool.parameters.properties.onboarded;
      expect(onboardedProperty).toBeDefined();
      expect(onboardedProperty.type).toBe(Type.BOOLEAN);
      expect(onboardedProperty.description).toContain('explicitly confirms');
    });

    it('should include important rules in description', () => {
      expect(updateProfileTool.description).toContain('IMPORTANT RULES');
      expect(updateProfileTool.description).toContain('CONFIRMED data');
      expect(updateProfileTool.description).toContain('ASK for the month first');
    });
  });
});
