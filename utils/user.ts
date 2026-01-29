
import { UserProfile, LifeStage } from '../types';

// Helper function to determine life stage from user profile
export function getLifeStageFromUser(user: UserProfile): LifeStage | null {
  if (!user.children || user.children.length === 0) return null;

  const primaryChild = user.children[0]; // Use first child for life stage
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // JavaScript months are 0-indexed

  if (primaryChild.type === 'expecting') {
    return LifeStage.EXPECTING;
  }

  // Calculate age in months
  const birthYear = primaryChild.birth_year;
  const birthMonth = primaryChild.birth_month ?? 6; // Default to mid-year if month not provided
  const ageInMonths = (currentYear - birthYear) * 12 + (currentMonth - birthMonth);

  if (ageInMonths <= 6) {
    return LifeStage.NEWBORN;
  } else if (ageInMonths <= 18) {
    return LifeStage.INFANT;
  } else if (ageInMonths <= 36) {
    return LifeStage.TODDLER;
  }

  return null; // Child is too old for our current matching system
}
