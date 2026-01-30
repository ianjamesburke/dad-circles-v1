/**
 * Gemini Tool Declarations
 * 
 * Function declarations for Gemini's function calling feature.
 * Defines the update_profile tool used during onboarding.
 */

import { Type } from '@google/genai';
import type { FunctionDeclaration } from '@google/genai';

/**
 * Tool declarations for Gemini function calling
 */
export const toolDeclarations: FunctionDeclaration[] = [
  {
    name: 'update_profile',
    description: `Update user profile fields. Call this whenever you learn new info about the user.
    
IMPORTANT RULES:
- Only include fields you have CONFIRMED data for
- If user says "she's 3" without a month, ASK for the month first - don't guess
- For children: birth_year required, birth_month optional (1-12). We infer expecting vs existing from the date.
- For location: need both city and state_code (2-letter like CA, TX, NY)
- Set onboarded=true ONLY when user explicitly confirms their info is correct`,
    parameters: {
      type: Type.OBJECT,
      properties: {
        name: { 
          type: Type.STRING, 
          description: 'User\'s first name' 
        },
        children: {
          type: Type.ARRAY,
          description: 'Array of children. Each needs: birth_year (number). Optional: birth_month (1-12), gender ("Boy"|"Girl"). Future dates = expecting, past dates = existing.',
          items: {
            type: Type.OBJECT,
            properties: {
              birth_year: { 
                type: Type.NUMBER, 
                description: 'Birth year or due year (e.g., 2023, 2025)' 
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
        interests: {
          type: Type.ARRAY,
          description: 'List of hobbies/interests',
          items: { type: Type.STRING }
        },
        city: { 
          type: Type.STRING, 
          description: 'City name' 
        },
        state_code: { 
          type: Type.STRING, 
          description: 'Two-letter state code (CA, TX, NY, etc.)' 
        },
        onboarded: {
          type: Type.BOOLEAN,
          description: 'Set to true ONLY when user explicitly confirms all info is correct'
        }
      }
    }
  }
];
