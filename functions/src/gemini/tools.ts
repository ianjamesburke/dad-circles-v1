/**
 * Gemini Tool Declarations
 *
 * Function declarations for Gemini's function calling feature.
 * We keep this tool narrow and deterministic: extraction only.
 */

import { Type } from '@google/genai';
import type { FunctionDeclaration } from '@google/genai';

/**
 * Tool declarations for Gemini function calling
 */
export const toolDeclarations: FunctionDeclaration[] = [
  {
    name: 'extract_profile',
    description: `Extract only the user-provided facts from the latest turn.

IMPORTANT RULES:
- Do NOT guess or infer missing data
- If the user gives age only (e.g., "she's 3"), use children_age_years instead of birth_year
- Only include fields that are explicitly stated or clearly confirmed
- For location, include city + state/region code and country code (US, AU, etc.)
- For "no other kids"/"only one"/"that's it", set no_more_children=true
- For "yes, more kids" without details, set has_more_children=true`,
    parameters: {
      type: Type.OBJECT,
      properties: {
        name: {
          type: Type.STRING,
          description: 'User\'s first name'
        },
        children_add: {
          type: Type.ARRAY,
          description: 'Children to add. birth_year required. Optional birth_month (1-12), gender ("Boy"|"Girl").',
          items: {
            type: Type.OBJECT,
            properties: {
              birth_year: {
                type: Type.NUMBER,
                description: 'Birth year or due year (e.g., 2023, 2026)'
              },
              birth_month: {
                type: Type.NUMBER,
                description: 'Month 1-12. Only include if user explicitly said it.'
              },
              gender: {
                type: Type.STRING,
                enum: ['Boy', 'Girl']
              }
            },
            required: ['birth_year']
          }
        },
        children_replace: {
          type: Type.ARRAY,
          description: 'Replace the full children list ONLY if the user explicitly corrects existing child info.',
          items: {
            type: Type.OBJECT,
            properties: {
              birth_year: {
                type: Type.NUMBER,
                description: 'Birth year or due year (e.g., 2023, 2026)'
              },
              birth_month: {
                type: Type.NUMBER,
                description: 'Month 1-12. Only include if user explicitly said it.'
              },
              gender: {
                type: Type.STRING,
                enum: ['Boy', 'Girl']
              }
            },
            required: ['birth_year']
          }
        },
        children_age_years: {
          type: Type.ARRAY,
          description: 'If user only provides ages (e.g., "3 years old"), list the ages here instead of birth_year.',
          items: { type: Type.NUMBER }
        },
        interests: {
          type: Type.ARRAY,
          description: 'List of hobbies/interests',
          items: { type: Type.STRING }
        },
        interests_clear: {
          type: Type.BOOLEAN,
          description: 'Set to true if user explicitly says they have no interests/hobbies'
        },
        location: {
          type: Type.OBJECT,
          description: 'Location with city, state/region code, and country code',
          properties: {
            city: { type: Type.STRING },
            state_code: { type: Type.STRING },
            country_code: { type: Type.STRING }
          },
          required: ['city', 'state_code']
        },
        confirm_profile: {
          type: Type.BOOLEAN,
          description: 'Set true only if user explicitly confirms the summary is correct'
        },
        no_more_children: {
          type: Type.BOOLEAN,
          description: 'True if user says they have no other kids'
        },
        has_more_children: {
          type: Type.BOOLEAN,
          description: 'True if user says they have more kids but gives no details'
        }
      }
    }
  }
];
