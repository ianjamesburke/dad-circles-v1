# Validation Loop Fix - January 29, 2026

## Problem

A user (Andrew) got stuck in a validation loop where the agent kept repeating:
> "I need to make sure I have all your information correct. Let me ask you a few more questions to complete your profile."

### Conversation Flow
```
agent: Hey there! So glad you're here. First things first, what's your name?
user: Andrew
agent: Awesome, Andrew! Are you an expecting dad or a current dad?
user: Current
agent: Fantastic, Andrew! So glad to have you here as a current dad. When was your child born?
user: He's 2
agent: I need to make sure I have all your information correct... [STUCK IN LOOP]
user: Ok
agent: I need to make sure I have all your information correct... [REPEATS]
user: Go ahead
agent: I need to make sure I have all your information correct... [REPEATS]
```

## Root Cause Analysis

### Issue 1: Age-Based Input Parsing
When the user said "He's 2", the LLM attempted to calculate the birth date but either:
- Failed to properly calculate birth_month/birth_year from age
- Created invalid child data (e.g., birth_year outside 2020-2030 range)
- Tried to transition to the wrong step

### Issue 2: Generic Fallback Message
When validation failed in `UserChatInterface.tsx`, the system:
1. Showed a generic fallback message (same for all steps)
2. Stayed at the same onboarding step
3. Didn't provide context about WHY validation failed
4. The LLM kept making the same mistake repeatedly

### Issue 3: No Age Calculation Guidance
The Gemini prompt asked for "birth month and year" but didn't provide clear instructions on how to handle age-based responses like "he's 2 years old" or "she's 6 months old".

## The Fix

### Change 1: Contextual Fallback Messages (`UserChatInterface.tsx`)

**Before:**
```typescript
const fallbackMessage = {
  content: "I need to make sure I have all your information correct. Let me ask you a few more questions to complete your profile."
};
```

**After:**
```typescript
let fallbackContent = "I need to make sure I have all your information correct. ";

switch (profile.onboarding_step) {
  case OnboardingStep.CHILD_INFO:
    fallbackContent = "I need the birth month and year for your child. For example, 'March 2023' or 'June 2024'. When was your child born?";
    break;
  case OnboardingStep.SIBLINGS:
    fallbackContent = "Do you have any other children besides the one you just told me about?";
    break;
  case OnboardingStep.INTERESTS:
    fallbackContent = "What are some of your hobbies or interests? Things like hiking, gaming, cooking, sports, etc.";
    break;
  case OnboardingStep.LOCATION:
    fallbackContent = "What city and state are you located in? For example, 'Austin, TX' or 'Portland, OR'.";
    break;
  case OnboardingStep.CONFIRM:
    fallbackContent = "Does the information I showed you look correct? Please say 'yes' to confirm or tell me what needs to be changed.";
    break;
  default:
    fallbackContent = "I need to make sure I have all your information correct. Let me ask you a few more questions to complete your profile.";
}
```

**Impact:** When validation fails, users now get a specific, helpful prompt for their current step instead of a generic message.

### Change 2: Age Calculation Instructions (`geminiService.ts`)

Added explicit instructions in the `child_info` step:

```typescript
- AGE-BASED RESPONSES: If user says "he's 2" or "she's 5 months old", calculate birth date:
  * "He's 2" or "2 years old" = Subtract 2 years from current date, use current month
  * "She's 6 months" = Subtract 6 months from current date
  * Example: User says "he's 2" in January 2026 = birth_month: 1, birth_year: 2024
  * ALWAYS validate: birth_year must be between 2020-2030, birth_month must be 1-12
```

And in the CRITICAL section:

```typescript
- AGE CALCULATION: When user says "he's X years old" or "she's Y months old":
  * Calculate birth date by subtracting from current date
  * "He's 2" in January 2026 = birth_month: 1, birth_year: 2024
  * "She's 6 months" in January 2026 = birth_month: 7, birth_year: 2025
  * ALWAYS ensure birth_year is 2020-2030 and birth_month is 1-12
```

**Impact:** The LLM now has clear instructions on how to handle age-based responses and will produce valid child data that passes validation.

## Testing Recommendations

1. **Test age-based inputs:**
   - "He's 2"
   - "She's 6 months old"
   - "My son is 3 years old"
   - "Born 2 years ago"

2. **Test validation fallbacks:**
   - Trigger validation failures at each step
   - Verify contextual messages appear
   - Ensure users can recover from validation errors

3. **Test edge cases:**
   - Very young children (< 1 year)
   - Multiple children with ages
   - Mixed age and date formats

## Monitoring

Watch for these patterns in logs:
- `🚨 [SECURITY] Invalid state transition blocked` - Validation failures
- Check if validation errors decrease after deployment
- Monitor if users successfully complete onboarding after validation failures

## Related Files

- `components/UserChatInterface.tsx` - Fallback message logic
- `services/geminiService.ts` - LLM prompt and age calculation instructions
- `services/onboardingValidator.ts` - Validation rules (unchanged)
- `types.ts` - Child data structure (unchanged)
