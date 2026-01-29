import { UserProfile, LifeStage } from '../types';
import { isExpecting } from './childDisplay';

/**
 * Determine life stage from user profile based on their primary child
 */
export function getLifeStageFromUser(user: UserProfile): LifeStage | null {
  if (!user.children || user.children.length === 0) return null;

  const primaryChild = user.children[0];
  
  // Use the isExpecting helper to determine if child is not yet born
  if (isExpecting(primaryChild)) {
    return LifeStage.EXPECTING;
  }

  // Calculate age in months for existing children
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  
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
