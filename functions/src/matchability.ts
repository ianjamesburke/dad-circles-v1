/**
 * Matchability Scoring System
 * 
 * Calculates compatibility scores between users based on:
 * - Location proximity (40% weight)
 * - Child age proximity (35% weight)
 * - Interest overlap (25% weight)
 */

interface UserProfile {
  session_id: string;
  email?: string;
  name?: string;
  location?: {
    city: string;
    state_code: string;
    country_code?: string;
  };
  children: Array<{
    birth_month?: number;
    birth_year: number;
    gender?: string;
  }>;
  interests?: string[];
}

export enum LifeStage {
  EXPECTING = 'Expecting',
  NEWBORN = 'Newborn',
  INFANT = 'Infant',
  TODDLER = 'Toddler'
}

/**
 * Helper to determine if a child is expecting (not yet born)
 */
export function isChildExpecting(child: { birth_month?: number; birth_year: number }): boolean {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  if (child.birth_year > currentYear) return true;
  if (child.birth_year === currentYear) {
    if (!child.birth_month) return false;
    return child.birth_month > currentMonth;
  }
  return false;
}

/**
 * Get life stage from user profile
 */
export function getLifeStageFromUser(user: UserProfile): LifeStage | null {
  if (!user.children || user.children.length === 0) return null;

  const primaryChild = user.children[0];
  
  if (isChildExpecting(primaryChild)) {
    return LifeStage.EXPECTING;
  }

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const birthYear = primaryChild.birth_year;
  const birthMonth = primaryChild.birth_month ?? 6;
  const ageInMonths = (currentYear - birthYear) * 12 + (currentMonth - birthMonth);

  if (ageInMonths <= 6) return LifeStage.NEWBORN;
  if (ageInMonths <= 18) return LifeStage.INFANT;
  if (ageInMonths <= 36) return LifeStage.TODDLER;

  return null;
}

/**
 * Calculate child age in months
 */
export function calculateAgeInMonths(birthMonth: number | undefined, birthYear: number): number {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const month = birthMonth ?? 6;
  return (currentYear - birthYear) * 12 + (currentMonth - month);
}

/**
 * Format child age for display
 */
export function formatChildAge(child: { birth_month?: number; birth_year: number }): string {
  if (isChildExpecting(child)) {
    const dateStr = child.birth_month 
      ? `${child.birth_month}/${child.birth_year}` 
      : `${child.birth_year}`;
    return `Due ${dateStr}`;
  }

  const ageInMonths = calculateAgeInMonths(child.birth_month, child.birth_year);
  
  if (ageInMonths <= 6) return `${ageInMonths}mo`;
  if (ageInMonths <= 36) {
    const years = Math.floor(ageInMonths / 12);
    const months = ageInMonths % 12;
    return months > 0 ? `${years}y ${months}mo` : `${years}y`;
  }
  return `${Math.floor(ageInMonths / 12)}y`;
}

/**
 * Calculate location proximity score (0-100)
 * Same city = 100, same state = 60, different state = 0
 */
function calculateLocationScore(user1: UserProfile, user2: UserProfile): number {
  if (!user1.location || !user2.location) return 0;

  const loc1 = user1.location;
  const loc2 = user2.location;

  // Same city and state
  if (loc1.city === loc2.city && loc1.state_code === loc2.state_code) {
    return 100;
  }

  // Same state, different city
  if (loc1.state_code === loc2.state_code) {
    return 60;
  }

  // Different state
  return 0;
}

/**
 * Calculate child age proximity score (0-100)
 * Based on life stage and age gap within that stage
 */
function calculateAgeScore(user1: UserProfile, user2: UserProfile): number {
  if (!user1.children?.[0] || !user2.children?.[0]) return 0;

  const child1 = user1.children[0];
  const child2 = user2.children[0];

  const lifeStage1 = getLifeStageFromUser(user1);
  const lifeStage2 = getLifeStageFromUser(user2);

  // Different life stages = poor match
  if (lifeStage1 !== lifeStage2) return 20;

  // Same life stage - calculate age gap
  const maxGaps: Record<LifeStage, number> = {
    [LifeStage.EXPECTING]: 6,
    [LifeStage.NEWBORN]: 3,
    [LifeStage.INFANT]: 6,
    [LifeStage.TODDLER]: 12,
  };

  const maxGap = maxGaps[lifeStage1!];
  
  let ageGap: number;
  if (lifeStage1 === LifeStage.EXPECTING) {
    // For expecting, compare due dates
    const due1 = new Date(child1.birth_year, (child1.birth_month ?? 6) - 1);
    const due2 = new Date(child2.birth_year, (child2.birth_month ?? 6) - 1);
    ageGap = Math.abs(due1.getTime() - due2.getTime()) / (1000 * 60 * 60 * 24 * 30);
  } else {
    // For existing children, compare ages in months
    const age1 = calculateAgeInMonths(child1.birth_month, child1.birth_year);
    const age2 = calculateAgeInMonths(child2.birth_month, child2.birth_year);
    ageGap = Math.abs(age1 - age2);
  }

  // Score inversely proportional to gap
  if (ageGap === 0) return 100;
  if (ageGap >= maxGap) return 30;
  
  return Math.round(100 - (ageGap / maxGap) * 70);
}

/**
 * Calculate interest overlap score (0-100)
 */
function calculateInterestScore(user1: UserProfile, user2: UserProfile): number {
  const interests1 = user1.interests || [];
  const interests2 = user2.interests || [];

  if (interests1.length === 0 || interests2.length === 0) return 50; // Neutral if no data

  const set1 = new Set(interests1.map(i => i.toLowerCase()));
  const set2 = new Set(interests2.map(i => i.toLowerCase()));

  const intersection = [...set1].filter(i => set2.has(i)).length;
  const union = new Set([...set1, ...set2]).size;

  if (union === 0) return 50;

  // Jaccard similarity * 100
  return Math.round((intersection / union) * 100);
}

/**
 * Calculate overall matchability score between two users (0-100)
 * Weights: Location 40%, Age 35%, Interests 25%
 */
export function calculateMatchability(user1: UserProfile, user2: UserProfile): number {
  const locationScore = calculateLocationScore(user1, user2);
  const ageScore = calculateAgeScore(user1, user2);
  const interestScore = calculateInterestScore(user1, user2);

  const weighted = (locationScore * 0.4) + (ageScore * 0.35) + (interestScore * 0.25);
  
  return Math.round(weighted);
}

/**
 * Calculate group cohesion score (average pairwise matchability)
 */
export function calculateGroupScore(users: UserProfile[]): number {
  if (users.length < 2) return 100;

  let totalScore = 0;
  let pairCount = 0;

  for (let i = 0; i < users.length; i++) {
    for (let j = i + 1; j < users.length; j++) {
      totalScore += calculateMatchability(users[i], users[j]);
      pairCount++;
    }
  }

  return pairCount > 0 ? Math.round(totalScore / pairCount) : 0;
}

/**
 * Get matchability scores for a user against a list of candidates
 */
export function getUserMatchabilityScores(
  referenceUser: UserProfile,
  candidates: UserProfile[]
): Array<{ user: UserProfile; score: number }> {
  return candidates
    .map(candidate => ({
      user: candidate,
      score: calculateMatchability(referenceUser, candidate)
    }))
    .sort((a, b) => b.score - a.score);
}

/**
 * Get all users with their average matchability against a pool
 */
export function getAllUsersWithScores(
  users: UserProfile[]
): Array<{ user: UserProfile; avgScore: number }> {
  return users.map(user => {
    const others = users.filter(u => u.session_id !== user.session_id);
    const scores = others.map(other => calculateMatchability(user, other));
    const avgScore = scores.length > 0 
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : 0;
    
    return { user, avgScore };
  }).sort((a, b) => b.avgScore - a.avgScore);
}
