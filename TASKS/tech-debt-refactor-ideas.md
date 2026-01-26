# Tech Debt & Refactoring Ideas

This document outlines identified technical debt and potential refactoring tasks to improve codebase maintainability, scalability, and type safety.

## 1. Split `database.ts` (God Object Anti-Pattern)
**Severity**: High
**Description**: `database.ts` has grown into a "God Object" managing User Profiles, Messages, Leads, Groups, Matching, and Testing data. This makes it hard to maintain and test.
**Refactor Plan**:
- [ ] Create a `services/` or `repositories/` directory.
- [ ] Extract `UserProfileRepository` / `UserService` for profile operations.
- [ ] Extract `GroupRepository` / `GroupService` for group operations.
- [ ] Extract `MessageRepository` for chat.
- [ ] Keep `database.ts` only as a connection initialization point or facade if necessary, but prefer individual imports.

## 2. Eliminate Code Duplication specifically `getLifeStageFromUser`
**Severity**: Medium
**Description**: The logic to calculate a user's life stage is duplicated in:
- `database.ts` (lines 450-476)
- `functions/src/matching.ts` (lines 87-112)
**Refactor Plan**:
- [ ] Create a shared `utils` or `domain` library/folder that can be imported by both the frontend and functions.
- [ ] Extract `getLifeStageFromUser`, `calculateAgeInMonths` into this shared location.
- [ ] Ensure consistent type definitions for `UserProfile` across frontend and functions (currently defined in both `types.ts` and `functions/src/matching.ts` separately).

## 3. Improve Type Safety (Remove `any`)
**Severity**: Medium
**Description**: `any` is used in several critical places, bypassing TypeScript's safety.
- `functions/src/matching.ts`: `introduction_email_sent_at?: any` (should likely be `number` or `Date`).
- `database.ts`: Return types for callable functions often default to `any`.
**Refactor Plan**:
- [ ] helper functions like `runMatchingAlgorithm` should return typed responses (e.g., `Promise<MatchingResult>`).
- [ ] specific fields like `introduction_email_sent_at` should be strictly typed.

## 4. Separate Test/Seed Logic from Production Code
**Severity**: Low/Medium
**Description**: `database.ts` and `functions/src/matching.ts` contain significant chunks of code dedicated to seeding test data (`seedTestData`, `generateTestUsers`).
**Refactor Plan**:
- [ ] Move `seedTestData` and related data generation into a dedicated `scripts/` or `services/test-utils` file.
- [ ] Ensure this code is tree-shaken out of production builds or strictly isolated.

## 5. Standardize Data Models
**Severity**: Medium
**Description**: `UserProfile` and `Group` interfaces are defined in multiple places (`types.ts`, `functions/src/matching.ts`, `database.ts`).
**Refactor Plan**:
- [ ] Create a "packages/shared" or simply a root-level `shared/types` folder if using a monorepo structure is too heavy.
- [ ] Define the canonical interfaces once.
- [ ] Import these interfaces in both the frontend and Cloud Functions.
