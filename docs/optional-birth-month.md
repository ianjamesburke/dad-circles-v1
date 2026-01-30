# Optional Birth Month Implementation

## Overview

Made `birth_month` optional in the `Child` interface to handle cases where users only provide the birth year (e.g., "born in 2024" or "he's 2 years old").

## Changes Made

### 1. Type Definition (`types.ts`)
```typescript
export interface Child {
  type: 'expecting' | 'existing';
  birth_month?: number; // Now optional
  birth_year: number;
  gender?: string;
}
```

### 2. Validation (`services/onboardingValidator.ts`)
- Updated validation to allow missing `birth_month`
- Still validates that if `birth_month` is provided, it must be 1-12
- `birth_year` remains required and must be 2020-2030

### 3. Gemini Prompt (`services/geminiService.ts`)
- Updated instructions to indicate month is optional
- Added guidance: "If user only provides year (e.g., 'born in 2024'), omit birth_month field entirely"
- Fallback response now formats dates correctly with or without month

### 4. Matching Logic (`functions/src/matching.ts`)
- Updated `calculateAgeInMonths()` to accept `number | undefined` for birth_month
- Updated `calculateDueDateScore()` to accept `number | undefined` for birth_month
- **Default behavior**: When month is missing, defaults to **June (month 6)** for age calculations
- Updated display code to show year-only format when month is missing

### 5. User Utilities (`utils/user.ts`)
- Updated `getLifeStageFromUser()` to handle optional birth_month
- Defaults to mid-year (June) for age calculations when month is missing

### 6. Display Helper (`utils/childDisplay.ts`) - NEW FILE
Created utility functions for consistent child date formatting:
- `formatChildDate(child)` - Returns "MM/YYYY" or "YYYY"
- `formatChildInfo(child)` - Returns "Expecting MM/YYYY" or "Child born YYYY"
- `formatChildInfoWithGender(child)` - Includes gender if available

### 7. Admin UI (`components/admin/AdminUsers.tsx`)
- Updated to use `formatChildInfo()` helper
- Handles optional birth_month gracefully in display

## Default Behavior

When `birth_month` is missing, the system defaults to **June (month 6)** for:
- Age calculations
- Life stage determination
- Matching algorithm

This mid-year default minimizes age calculation errors while still allowing the system to function.

## Examples

### User Input Handling
- "He's 2" → `{ birth_year: 2024, birth_month: 1 }` (current month)
- "Born in 2024" → `{ birth_year: 2024 }` (no month)
- "March 2023" → `{ birth_year: 2023, birth_month: 3 }`

### Display Output
- With month: "Expecting 3/2026" or "Child born 3/2023"
- Without month: "Expecting 2026" or "Child born 2023"

## Testing Recommendations

1. **Test onboarding with year-only responses:**
   - "Born in 2024"
   - "He's 2" (should still capture month)
   - "2023"

2. **Test matching with mixed data:**
   - Some users with month, some without
   - Verify age calculations use June default
   - Verify groups form correctly

3. **Test admin UI display:**
   - Verify dates display correctly with/without month
   - Check all admin pages (Users, Groups, User Detail, Group Detail)

## Files Modified

- `types.ts` - Made birth_month optional
- `services/onboardingValidator.ts` - Updated validation logic
- `services/geminiService.ts` - Updated prompt and fallback
- `functions/src/matching.ts` - Updated age calculations and display
- `utils/user.ts` - Updated life stage calculation
- `components/admin/AdminUsers.tsx` - Updated display logic

## Files Created

- `utils/childDisplay.ts` - New helper for consistent date formatting
- `docs/optional-birth-month.md` - This documentation

## Remaining Work

The following admin components still need updating to use the `formatChildInfo()` helper:
- `components/AdminDashboard.tsx`
- `components/admin/AdminGroups.tsx`
- `components/admin/AdminUserDetail.tsx`
- `components/admin/AdminGroupDetail.tsx`

These can be updated incrementally as they're not critical for functionality.
