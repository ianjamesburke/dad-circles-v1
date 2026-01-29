/**
 * Matching Cloud Functions
 * 
 * Provides cloud functions for the matching system:
 * - Core matching algorithm
 * - Daily scheduled matching
 * - Manual matching triggers
 * - Group email sending
 */

import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { logger } from "./logger";
import { EmailService } from "./emailService";

// Types
interface UserProfile {
  session_id: string;
  email?: string;
  onboarded: boolean;
  location?: {
    city: string;
    state_code: string;
  };
  children: Array<{
    type: 'expecting' | 'existing';
    birth_month: number;
    birth_year: number;
    gender?: string;
  }>;
  matching_eligible: boolean;
  group_id?: string;
  matched_at?: any; // Firestore Timestamp
  last_updated: any; // Firestore Timestamp
}

interface Group {
  group_id: string;
  name: string;
  created_at: any; // Firestore Timestamp
  location: {
    city: string;
    state_code: string;
  };
  member_ids: string[];
  member_emails: string[];
  status: 'pending' | 'active' | 'inactive';
  emailed_member_ids: string[];
  introduction_email_sent_at?: any; // Firestore Timestamp
  test_mode: boolean;
  life_stage: string;
}

enum LifeStage {
  EXPECTING = 'Expecting',
  NEWBORN = 'Newborn',
  INFANT = 'Infant',
  TODDLER = 'Toddler'
}

interface MatchingResult {
  groups_created: Group[];
  users_matched: number;
  users_unmatched: number;
  summary: string;
}

interface MatchingConfig {
  minGroupSize: number;
  maxGroupSize: number;
  maxAgeGapMonths: Record<LifeStage, number>;
}

const DEFAULT_CONFIG: MatchingConfig = {
  minGroupSize: 4,
  maxGroupSize: 6,
  maxAgeGapMonths: {
    [LifeStage.EXPECTING]: 6,
    [LifeStage.NEWBORN]: 3,
    [LifeStage.INFANT]: 6,
    [LifeStage.TODDLER]: 12,
  }
};

/**
 * Helper function to determine life stage from user profile
 */
function getLifeStageFromUser(user: UserProfile): LifeStage | null {
  if (!user.children || user.children.length === 0) return null;

  const primaryChild = user.children[0];
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  if (primaryChild.type === 'expecting') {
    return LifeStage.EXPECTING;
  }

  const birthYear = primaryChild.birth_year;
  const birthMonth = primaryChild.birth_month;
  const ageInMonths = (currentYear - birthYear) * 12 + (currentMonth - birthMonth);

  if (ageInMonths <= 6) {
    return LifeStage.NEWBORN;
  } else if (ageInMonths <= 18) {
    return LifeStage.INFANT;
  } else if (ageInMonths <= 36) {
    return LifeStage.TODDLER;
  }

  return null;
}

/**
 * Calculate child age in months from birth date
 */
function calculateAgeInMonths(birthMonth: number, birthYear: number): number {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  return (currentYear - birthYear) * 12 + (currentMonth - birthMonth);
}

/**
 * Calculate due date score for expecting fathers (lower is sooner)
 */
function calculateDueDateScore(birthMonth: number, birthYear: number): number {
  const now = new Date();
  const dueDate = new Date(birthYear, birthMonth - 1);
  return dueDate.getTime() - now.getTime();
}

/**
 * Sort users within a life stage by age proximity
 */
function sortUsersByAge(users: UserProfile[], lifeStage: LifeStage): UserProfile[] {
  return users.sort((a, b) => {
    const childA = a.children[0];
    const childB = b.children[0];

    if (lifeStage === LifeStage.EXPECTING) {
      const scoreA = calculateDueDateScore(childA.birth_month, childA.birth_year);
      const scoreB = calculateDueDateScore(childB.birth_month, childB.birth_year);
      return scoreA - scoreB;
    } else {
      const ageA = calculateAgeInMonths(childA.birth_month, childA.birth_year);
      const ageB = calculateAgeInMonths(childB.birth_month, childB.birth_year);
      return ageA - ageB;
    }
  });
}

/**
 * Check if a group of users meets the age gap threshold
 */
function validateAgeGap(users: UserProfile[], lifeStage: LifeStage, config: MatchingConfig): boolean {
  if (users.length < 2) return true;

  const maxGap = config.maxAgeGapMonths[lifeStage];
  const ages: number[] = [];

  for (const user of users) {
    const child = user.children[0];
    if (lifeStage === LifeStage.EXPECTING) {
      ages.push(calculateDueDateScore(child.birth_month, child.birth_year));
    } else {
      ages.push(calculateAgeInMonths(child.birth_month, child.birth_year));
    }
  }

  const minAge = Math.min(...ages);
  const maxAge = Math.max(...ages);
  const gapInMonths = lifeStage === LifeStage.EXPECTING
    ? Math.abs(maxAge - minAge) / (1000 * 60 * 60 * 24 * 30) // Convert milliseconds to months
    : maxAge - minAge;

  return gapInMonths <= maxGap;
}



/**
 * Form groups from a list of users
 */
async function formGroupsFromUsers(
  users: UserProfile[],
  location: { city: string; state_code: string },
  lifeStage: LifeStage,
  testMode: boolean,
  config: MatchingConfig
): Promise<Group[]> {
  if (users.length < config.minGroupSize) {
    return [];
  }

  const sortedUsers = sortUsersByAge(users, lifeStage);
  const groups: Group[] = [];
  let groupSequence = 1;

  for (let i = 0; i < sortedUsers.length; i += config.maxGroupSize) {
    const chunk = sortedUsers.slice(i, i + config.maxGroupSize);

    if (chunk.length < config.minGroupSize) break;
    if (!validateAgeGap(chunk, lifeStage, config)) continue;

    const groupId = crypto.randomUUID();
    const groupName = `${location.city} ${lifeStage} Dads - Group ${groupSequence}`;

    const group: Group = {
      group_id: groupId,
      name: groupName,
      created_at: FieldValue.serverTimestamp(),
      location: location,
      member_ids: chunk.map(u => u.session_id),
      member_emails: chunk.map(u => u.email || '').filter(e => e),
      status: 'pending',
      emailed_member_ids: [],
      test_mode: false, // Always false per V1 spec (no test mode distinction)
      life_stage: lifeStage,
    };

    // Save group to Firestore
    await admin.firestore().collection('groups').doc(groupId).set(group);
    groups.push(group);
    groupSequence++;
  }

  return groups;
}

/**
 * Assign users to groups in Firestore
 */
async function assignUsersToGroups(groups: Group[]): Promise<void> {
  const batch = admin.firestore().batch();

  for (const group of groups) {
    for (const sessionId of group.member_ids) {
      const userRef = admin.firestore().collection('profiles').doc(sessionId);
      batch.update(userRef, {
        group_id: group.group_id,
        matched_at: FieldValue.serverTimestamp(),
        last_updated: FieldValue.serverTimestamp()
      });
    }
  }

  await batch.commit();
}

/**
 * Send group introduction emails
 */
export async function sendGroupIntroductionEmails(
  group: Group,
  testMode: boolean = false
): Promise<{ success: boolean; emailedMembers: string[] }> {
  try {
    logger.info("📧 Sending group introduction emails", {
      groupId: group.group_id,
      groupName: group.name,
      testMode
    });

    const db = admin.firestore();
    const memberDetails: Array<{ email: string; name: string; childInfo: string }> = [];

    for (const sessionId of group.member_ids) {
      const userDoc = await db.collection('profiles').doc(sessionId).get();
      if (userDoc.exists) {
        const userData = userDoc.data() as UserProfile;
        if (userData.email) {
          let childInfo = 'Dad';
          if (userData.children && userData.children.length > 0) {
            const child = userData.children[0];
            if (child.type === 'expecting') {
              childInfo = `Expecting ${child.birth_month}/${child.birth_year}`;
            } else {
              const now = new Date();
              const ageInMonths = (now.getFullYear() - child.birth_year) * 12 +
                (now.getMonth() + 1 - child.birth_month);
              if (ageInMonths <= 6) childInfo = `${ageInMonths}mo old`;
              else if (ageInMonths <= 36) childInfo = `${Math.floor(ageInMonths / 12)}y ${ageInMonths % 12}mo old`;
              else childInfo = `${Math.floor(ageInMonths / 12)}y old`;
            }
          }

          memberDetails.push({
            email: userData.email,
            name: userData.email.split('@')[0],
            childInfo
          });
        }
      }
    }

    if (memberDetails.length === 0) return { success: false, emailedMembers: [] };

    const result = await EmailService.sendGroupIntroductionEmail(
      group.name,
      memberDetails,
      testMode
    );

    if (result.success && result.emailedMembers.length > 0) {
      await db.collection('groups').doc(group.group_id).update({
        emailed_member_ids: result.emailedMembers,
        introduction_email_sent_at: FieldValue.serverTimestamp(),
        status: 'active'
      });
    }

    return result;

  } catch (error) {
    logger.error("❌ Error sending emails", { error });
    return { success: false, emailedMembers: [] };
  }
}

/**
 * Get unmatched users from Firestore
 */
async function getUnmatchedUsers(city?: string, stateCode?: string): Promise<UserProfile[]> {
  const db = admin.firestore();
  let query: admin.firestore.Query = db.collection('profiles')
    .where('matching_eligible', '==', true)
    .where('group_id', '==', null);

  if (city && stateCode) {
    query = query
      .where('location.city', '==', city)
      .where('location.state_code', '==', stateCode);
  }

  const snapshot = await query.get();
  return snapshot.docs.map(doc => doc.data() as UserProfile);
}

/**
 * Core Matching Algorithm
 */
export async function runMatchingAlgorithm(
  city?: string,
  stateCode?: string,
  testMode: boolean = false,
  config: MatchingConfig = DEFAULT_CONFIG
): Promise<MatchingResult> {
  logger.info("🔄 Running matching algorithm", { city, stateCode, testMode });

  try {
    // 1. Get unmatched users
    const unmatchedUsers = await getUnmatchedUsers(city, stateCode);
    if (unmatchedUsers.length === 0) {
      return {
        groups_created: [],
        users_matched: 0,
        users_unmatched: 0,
        summary: 'No unmatched users found'
      };
    }

    // 2. Bucket users by location & life stage
    const buckets: Record<string, Record<LifeStage, UserProfile[]>> = {};

    for (const user of unmatchedUsers) {
      if (!user.location) continue;

      const locKey = `${user.location.city}|${user.location.state_code}`;
      const lifeStage = getLifeStageFromUser(user);

      if (!lifeStage) continue;

      if (!buckets[locKey]) {
        buckets[locKey] = {
          [LifeStage.EXPECTING]: [],
          [LifeStage.NEWBORN]: [],
          [LifeStage.INFANT]: [],
          [LifeStage.TODDLER]: []
        };
      }
      buckets[locKey][lifeStage].push(user);
    }

    // 3. Form groups
    const allGroups: Group[] = [];

    for (const [locKey, lifeStageBuckets] of Object.entries(buckets)) {
      const [cityName, stateCodeName] = locKey.split('|');
      const location = { city: cityName, state_code: stateCodeName };

      for (const [lifeStageStr, users] of Object.entries(lifeStageBuckets)) {
        const lifeStage = lifeStageStr as LifeStage;
        if (users.length === 0) continue;

        const groups = await formGroupsFromUsers(users, location, lifeStage, testMode, config);
        allGroups.push(...groups);
      }
    }

    // 4. Assign users (if groups formed)
    if (allGroups.length > 0) {
      await assignUsersToGroups(allGroups);

      // 5. Emails are NOT sent automatically in V1 spec
      // Groups remain in 'pending' status until manually approved
      /*
      for (const group of allGroups) {
        await sendGroupIntroductionEmails(group, testMode);
      }
      */
    }

    const totalMatched = allGroups.reduce((acc, g) => acc + g.member_ids.length, 0);
    const totalUnmatched = unmatchedUsers.length - totalMatched;

    return {
      groups_created: allGroups,
      users_matched: totalMatched,
      users_unmatched: totalUnmatched,
      summary: `Created ${allGroups.length} groups, matched ${totalMatched} users`
    };

  } catch (error) {
    logger.error("❌ Matching failed", { error });
    throw error;
  }
}

/**
 * Run daily matching for all cities
 */
export async function runDailyMatching(): Promise<void> {
  try {
    // Note: Daily matching creates pending groups but does not send emails
    await runMatchingAlgorithm(undefined, undefined, false);
    logger.info("🎉 Daily matching job completed");
  } catch (error) {
    logger.error("❌ Daily matching job failed:", error);
  }
}

/**
 * Approve a group and send introduction emails
 */
export async function approveAndEmailGroup(groupId: string): Promise<{ success: boolean; message: string }> {
  const db = admin.firestore();

  try {
    const groupDoc = await db.collection('groups').doc(groupId).get();
    if (!groupDoc.exists) {
      throw new Error(`Group ${groupId} not found`);
    }

    const group = groupDoc.data() as Group;

    // Validate status
    if (group.status !== 'pending') {
      throw new Error(`Group is already ${group.status}, cannot approve again`);
    }

    // Send emails (using existing service which handles test/prod modes internally via API key)
    // we pass false for testMode because the concept is removed in V1
    const emailResult = await sendGroupIntroductionEmails(group, false);

    if (emailResult.success && emailResult.emailedMembers.length > 0) {
      return { success: true, message: `Emails sent to ${emailResult.emailedMembers.length} members` };
    } else {
      // No emails were sent - this could be because:
      // 1. No members have email addresses
      // 2. Email service failed
      // We should still approve the group but warn about the email issue
      logger.warn("⚠️ Group approved but no emails sent", { 
        groupId, 
        memberCount: group.member_ids.length,
        emailedCount: emailResult.emailedMembers.length 
      });
      
      // Manually update group status to active since sendGroupIntroductionEmails didn't
      await db.collection('groups').doc(groupId).update({
        status: 'active',
        introduction_email_sent_at: FieldValue.serverTimestamp(),
      });
      
      return { 
        success: true, 
        message: `Group approved but no emails sent (${group.member_ids.length} members have no email addresses)` 
      };
    }
  } catch (error) {
    logger.error("❌ Error approving group", { groupId, error });
    throw error;
  }
}

/**
 * Delete a pending group and unmatch its members
 */
export async function deleteGroup(groupId: string): Promise<{ success: boolean; message: string }> {
  const db = admin.firestore();

  try {
    const groupRef = db.collection('groups').doc(groupId);
    const groupDoc = await groupRef.get();

    if (!groupDoc.exists) {
      throw new Error(`Group ${groupId} not found`);
    }

    const group = groupDoc.data() as Group;

    // Safety check: Only delete pending groups
    if (group.status === 'active') {
      throw new Error("Cannot delete an active group that has already received emails");
    }

    // Unmatch all members using batch instead of transaction
    const batch = db.batch();
    let updatedCount = 0;
    let missingProfiles: string[] = [];

    for (const memberId of group.member_ids) {
      const userRef = db.collection('profiles').doc(memberId);

      // Check if the profile exists before updating
      const userDoc = await userRef.get();
      if (userDoc.exists) {
        batch.update(userRef, {
          group_id: null,
          matched_at: null,
          last_updated: FieldValue.serverTimestamp()
        });
        updatedCount++;
      } else {
        logger.warn(`⚠️ Profile ${memberId} not found, skipping update`);
        missingProfiles.push(memberId);
      }
    }

    // Delete the group
    batch.delete(groupRef);

    // Commit the batch
    await batch.commit();

    logger.info("✅ Group deleted successfully", {
      groupId,
      totalMembers: group.member_ids.length,
      updatedProfiles: updatedCount,
      missingProfiles: missingProfiles.length
    });

    return {
      success: true,
      message: `Group deleted and ${updatedCount} members returned to pool${missingProfiles.length > 0 ? ` (${missingProfiles.length} profiles not found)` : ''}`
    };
  } catch (error) {
    logger.error("❌ Error deleting group", { groupId, error });
    throw error;
  }
}


/**
 * Seed Test Data
 */
export async function seedTestData(): Promise<void> {
  const db = admin.firestore();

  // Helper to generate realistic test data
  const generateTestUsers = () => {
    // Ann Arbor, MI - 15 users
    const annArborUsers = [
      // Expecting dads (8)
      { sessionId: 'test-session-aa-001', email: 'test-dad-aa-001@example.com', location: { city: 'Ann Arbor', state_code: 'MI' }, childType: 'expecting' as const, birthMonth: 4, birthYear: 2025, gender: 'boy', interests: ['hiking', 'cooking', 'reading'] },
      { sessionId: 'test-session-aa-002', email: 'test-dad-aa-002@example.com', location: { city: 'Ann Arbor', state_code: 'MI' }, childType: 'expecting' as const, birthMonth: 5, birthYear: 2025, gender: 'girl', interests: ['sports', 'music', 'technology'] },
      { sessionId: 'test-session-aa-003', email: 'test-dad-aa-003@example.com', location: { city: 'Ann Arbor', state_code: 'MI' }, childType: 'expecting' as const, birthMonth: 6, birthYear: 2025, interests: ['fitness', 'photography', 'travel'] },
      { sessionId: 'test-session-aa-004', email: 'test-dad-aa-004@example.com', location: { city: 'Ann Arbor', state_code: 'MI' }, childType: 'expecting' as const, birthMonth: 7, birthYear: 2025, gender: 'boy', interests: ['gaming', 'woodworking', 'cycling'] },
      { sessionId: 'test-session-aa-005', email: 'test-dad-aa-005@example.com', location: { city: 'Ann Arbor', state_code: 'MI' }, childType: 'expecting' as const, birthMonth: 8, birthYear: 2025, interests: ['art', 'gardening', 'movies'] },
      { sessionId: 'test-session-aa-006', email: 'test-dad-aa-006@example.com', location: { city: 'Ann Arbor', state_code: 'MI' }, childType: 'expecting' as const, birthMonth: 3, birthYear: 2025, gender: 'girl', interests: ['running', 'cooking', 'books'] },
      { sessionId: 'test-session-aa-007', email: 'test-dad-aa-007@example.com', location: { city: 'Ann Arbor', state_code: 'MI' }, childType: 'expecting' as const, birthMonth: 9, birthYear: 2025, interests: ['music', 'hiking', 'technology'] },
      { sessionId: 'test-session-aa-008', email: 'test-dad-aa-008@example.com', location: { city: 'Ann Arbor', state_code: 'MI' }, childType: 'expecting' as const, birthMonth: 4, birthYear: 2025, gender: 'boy', interests: ['sports', 'travel', 'fitness'] },

      // Newborn dads (3)
      { sessionId: 'test-session-aa-009', email: 'test-dad-aa-009@example.com', location: { city: 'Ann Arbor', state_code: 'MI' }, childType: 'existing' as const, birthMonth: 12, birthYear: 2024, gender: 'girl', interests: ['photography', 'cooking', 'reading'] },
      { sessionId: 'test-session-aa-010', email: 'test-dad-aa-010@example.com', location: { city: 'Ann Arbor', state_code: 'MI' }, childType: 'existing' as const, birthMonth: 11, birthYear: 2024, gender: 'boy', interests: ['gaming', 'music', 'cycling'] },
      { sessionId: 'test-session-aa-011', email: 'test-dad-aa-011@example.com', location: { city: 'Ann Arbor', state_code: 'MI' }, childType: 'existing' as const, birthMonth: 10, birthYear: 2024, interests: ['hiking', 'technology', 'movies'] },

      // Infant dads (3)
      { sessionId: 'test-session-aa-012', email: 'test-dad-aa-012@example.com', location: { city: 'Ann Arbor', state_code: 'MI' }, childType: 'existing' as const, birthMonth: 8, birthYear: 2024, gender: 'girl', interests: ['woodworking', 'travel', 'fitness'] },
      { sessionId: 'test-session-aa-013', email: 'test-dad-aa-013@example.com', location: { city: 'Ann Arbor', state_code: 'MI' }, childType: 'existing' as const, birthMonth: 6, birthYear: 2024, gender: 'boy', interests: ['art', 'running', 'books'] },
      { sessionId: 'test-session-aa-014', email: 'test-dad-aa-014@example.com', location: { city: 'Ann Arbor', state_code: 'MI' }, childType: 'existing' as const, birthMonth: 4, birthYear: 2024, interests: ['gardening', 'sports', 'cooking'] },

      // Toddler dad (1)
      { sessionId: 'test-session-aa-015', email: 'test-dad-aa-015@example.com', location: { city: 'Ann Arbor', state_code: 'MI' }, childType: 'existing' as const, birthMonth: 6, birthYear: 2023, gender: 'boy', interests: ['music', 'hiking', 'photography'] },
    ];

    // Austin, TX - 12 users
    const austinUsers = [
      // Expecting dads (6)
      { sessionId: 'test-session-au-001', email: 'test-dad-au-001@example.com', location: { city: 'Austin', state_code: 'TX' }, childType: 'expecting' as const, birthMonth: 5, birthYear: 2025, gender: 'girl', interests: ['music', 'food', 'cycling'] },
      { sessionId: 'test-session-au-002', email: 'test-dad-au-002@example.com', location: { city: 'Austin', state_code: 'TX' }, childType: 'expecting' as const, birthMonth: 6, birthYear: 2025, gender: 'boy', interests: ['technology', 'hiking', 'gaming'] },
      { sessionId: 'test-session-au-003', email: 'test-dad-au-003@example.com', location: { city: 'Austin', state_code: 'TX' }, childType: 'expecting' as const, birthMonth: 7, birthYear: 2025, interests: ['sports', 'cooking', 'travel'] },
      { sessionId: 'test-session-au-004', email: 'test-dad-au-004@example.com', location: { city: 'Austin', state_code: 'TX' }, childType: 'expecting' as const, birthMonth: 8, birthYear: 2025, gender: 'girl', interests: ['fitness', 'photography', 'movies'] },
      { sessionId: 'test-session-au-005', email: 'test-dad-au-005@example.com', location: { city: 'Austin', state_code: 'TX' }, childType: 'expecting' as const, birthMonth: 4, birthYear: 2025, interests: ['art', 'running', 'books'] },
      { sessionId: 'test-session-au-006', email: 'test-dad-au-006@example.com', location: { city: 'Austin', state_code: 'TX' }, childType: 'expecting' as const, birthMonth: 9, birthYear: 2025, gender: 'boy', interests: ['woodworking', 'music', 'gardening'] },

      // Newborn dads (3)
      { sessionId: 'test-session-au-007', email: 'test-dad-au-007@example.com', location: { city: 'Austin', state_code: 'TX' }, childType: 'existing' as const, birthMonth: 1, birthYear: 2025, gender: 'girl', interests: ['technology', 'cycling', 'cooking'] },
      { sessionId: 'test-session-au-008', email: 'test-dad-au-008@example.com', location: { city: 'Austin', state_code: 'TX' }, childType: 'existing' as const, birthMonth: 12, birthYear: 2024, gender: 'boy', interests: ['sports', 'hiking', 'photography'] },
      { sessionId: 'test-session-au-009', email: 'test-dad-au-009@example.com', location: { city: 'Austin', state_code: 'TX' }, childType: 'existing' as const, birthMonth: 11, birthYear: 2024, interests: ['gaming', 'travel', 'fitness'] },

      // Infant dads (2)
      { sessionId: 'test-session-au-010', email: 'test-dad-au-010@example.com', location: { city: 'Austin', state_code: 'TX' }, childType: 'existing' as const, birthMonth: 9, birthYear: 2024, gender: 'girl', interests: ['music', 'art', 'movies'] },
      { sessionId: 'test-session-au-011', email: 'test-dad-au-011@example.com', location: { city: 'Austin', state_code: 'TX' }, childType: 'existing' as const, birthMonth: 7, birthYear: 2024, gender: 'boy', interests: ['running', 'books', 'gardening'] },

      // Toddler dad (1)
      { sessionId: 'test-session-au-012', email: 'test-dad-au-012@example.com', location: { city: 'Austin', state_code: 'TX' }, childType: 'existing' as const, birthMonth: 8, birthYear: 2023, gender: 'girl', interests: ['woodworking', 'cycling', 'cooking'] },
    ];

    // Boulder, CO - 10 users
    const boulderUsers = [
      // Expecting dads (5)
      { sessionId: 'test-session-bo-001', email: 'test-dad-bo-001@example.com', location: { city: 'Boulder', state_code: 'CO' }, childType: 'expecting' as const, birthMonth: 6, birthYear: 2025, gender: 'boy', interests: ['hiking', 'climbing', 'photography'] },
      { sessionId: 'test-session-bo-002', email: 'test-dad-bo-002@example.com', location: { city: 'Boulder', state_code: 'CO' }, childType: 'expecting' as const, birthMonth: 7, birthYear: 2025, interests: ['cycling', 'skiing', 'technology'] },
      { sessionId: 'test-session-bo-003', email: 'test-dad-bo-003@example.com', location: { city: 'Boulder', state_code: 'CO' }, childType: 'expecting' as const, birthMonth: 5, birthYear: 2025, gender: 'girl', interests: ['running', 'yoga', 'cooking'] },
      { sessionId: 'test-session-bo-004', email: 'test-dad-bo-004@example.com', location: { city: 'Boulder', state_code: 'CO' }, childType: 'expecting' as const, birthMonth: 8, birthYear: 2025, interests: ['music', 'travel', 'fitness'] },
      { sessionId: 'test-session-bo-005', email: 'test-dad-bo-005@example.com', location: { city: 'Boulder', state_code: 'CO' }, childType: 'expecting' as const, birthMonth: 4, birthYear: 2025, gender: 'boy', interests: ['art', 'gardening', 'books'] },

      // Newborn dads (2)
      { sessionId: 'test-session-bo-006', email: 'test-dad-bo-006@example.com', location: { city: 'Boulder', state_code: 'CO' }, childType: 'existing' as const, birthMonth: 12, birthYear: 2024, gender: 'girl', interests: ['hiking', 'photography', 'movies'] },
      { sessionId: 'test-session-bo-007', email: 'test-dad-bo-007@example.com', location: { city: 'Boulder', state_code: 'CO' }, childType: 'existing' as const, birthMonth: 1, birthYear: 2025, interests: ['cycling', 'technology', 'cooking'] },

      // Infant dads (2)
      { sessionId: 'test-session-bo-008', email: 'test-dad-bo-008@example.com', location: { city: 'Boulder', state_code: 'CO' }, childType: 'existing' as const, birthMonth: 8, birthYear: 2024, gender: 'boy', interests: ['climbing', 'music', 'travel'] },
      { sessionId: 'test-session-bo-009', email: 'test-dad-bo-009@example.com', location: { city: 'Boulder', state_code: 'CO' }, childType: 'existing' as const, birthMonth: 6, birthYear: 2024, gender: 'girl', interests: ['skiing', 'fitness', 'art'] },

      // Toddler dad (1)
      { sessionId: 'test-session-bo-010', email: 'test-dad-bo-010@example.com', location: { city: 'Boulder', state_code: 'CO' }, childType: 'existing' as const, birthMonth: 9, birthYear: 2023, interests: ['running', 'gardening', 'books'] },
    ];

    // Portland, OR - 8 users
    const portlandUsers = [
      // Expecting dads (4)
      { sessionId: 'test-session-po-001', email: 'test-dad-po-001@example.com', location: { city: 'Portland', state_code: 'OR' }, childType: 'expecting' as const, birthMonth: 5, birthYear: 2025, gender: 'girl', interests: ['coffee', 'biking', 'music'] },
      { sessionId: 'test-session-po-002', email: 'test-dad-po-002@example.com', location: { city: 'Portland', state_code: 'OR' }, childType: 'expecting' as const, birthMonth: 6, birthYear: 2025, interests: ['food', 'hiking', 'technology'] },
      { sessionId: 'test-session-po-003', email: 'test-dad-po-003@example.com', location: { city: 'Portland', state_code: 'OR' }, childType: 'expecting' as const, birthMonth: 7, birthYear: 2025, gender: 'boy', interests: ['brewing', 'photography', 'gaming'] },
      { sessionId: 'test-session-po-004', email: 'test-dad-po-004@example.com', location: { city: 'Portland', state_code: 'OR' }, childType: 'expecting' as const, birthMonth: 8, birthYear: 2025, interests: ['art', 'running', 'movies'] },

      // Newborn dads (2)
      { sessionId: 'test-session-po-005', email: 'test-dad-po-005@example.com', location: { city: 'Portland', state_code: 'OR' }, childType: 'existing' as const, birthMonth: 11, birthYear: 2024, gender: 'girl', interests: ['coffee', 'books', 'travel'] },
      { sessionId: 'test-session-po-006', email: 'test-dad-po-006@example.com', location: { city: 'Portland', state_code: 'OR' }, childType: 'existing' as const, birthMonth: 12, birthYear: 2024, interests: ['biking', 'cooking', 'fitness'] },

      // Infant dads (1)
      { sessionId: 'test-session-po-007', email: 'test-dad-po-007@example.com', location: { city: 'Portland', state_code: 'OR' }, childType: 'existing' as const, birthMonth: 9, birthYear: 2024, gender: 'boy', interests: ['food', 'music', 'gardening'] },

      // Toddler dad (1)
      { sessionId: 'test-session-po-008', email: 'test-dad-po-008@example.com', location: { city: 'Portland', state_code: 'OR' }, childType: 'existing' as const, birthMonth: 7, birthYear: 2023, gender: 'girl', interests: ['brewing', 'hiking', 'art'] },
    ];

    // Scattered cities - 5 users (unmatchable controls)
    const scatteredUsers = [
      { sessionId: 'test-session-sc-001', email: 'test-dad-sc-001@example.com', location: { city: 'Seattle', state_code: 'WA' }, childType: 'expecting' as const, birthMonth: 6, birthYear: 2025, interests: ['technology', 'coffee', 'hiking'] },
      { sessionId: 'test-session-sc-002', email: 'test-dad-sc-002@example.com', location: { city: 'Denver', state_code: 'CO' }, childType: 'expecting' as const, birthMonth: 7, birthYear: 2025, gender: 'boy', interests: ['skiing', 'music', 'travel'] },
      { sessionId: 'test-session-sc-003', email: 'test-dad-sc-003@example.com', location: { city: 'Nashville', state_code: 'TN' }, childType: 'existing' as const, birthMonth: 10, birthYear: 2024, interests: ['music', 'food', 'sports'] },
      { sessionId: 'test-session-sc-004', email: 'test-dad-sc-004@example.com', location: { city: 'Phoenix', state_code: 'AZ' }, childType: 'existing' as const, birthMonth: 8, birthYear: 2024, gender: 'girl', interests: ['hiking', 'photography', 'fitness'] },
      { sessionId: 'test-session-sc-005', email: 'test-dad-sc-005@example.com', location: { city: 'Miami', state_code: 'FL' }, childType: 'existing' as const, birthMonth: 5, birthYear: 2023, gender: 'boy', interests: ['swimming', 'cooking', 'art'] },
    ];

    return [...annArborUsers, ...austinUsers, ...boulderUsers, ...portlandUsers, ...scatteredUsers];
  };

  const testUsers = generateTestUsers();
  logger.info(`📊 Generating ${testUsers.length} test users`);

  const batch = db.batch();

  for (const user of testUsers) {
    const child: any = {
      type: user.childType,
      birth_month: user.birthMonth,
      birth_year: user.birthYear,
    };

    // Only add gender if it exists
    if (user.gender) {
      child.gender = user.gender;
    }

    const profile: UserProfile = {
      session_id: user.sessionId,
      email: user.email,
      onboarded: true,
      // onboarding_step is missing in UserProfile in this file but present in script, 
      // but 'onboarded: true' implies complete.
      location: user.location,
      // UserProfile interface in this file doesn't have 'interests' or 'siblings' explicitly defined
      // but Firestore allows extra fields. We can add optional to interface or just cast.
      // Let's rely on the interface defined at top of this file.
      // We might need to add interests to the interface if we want it typed, 
      // but for seeding it's fine to just save it.
      children: [child],
      matching_eligible: true,
      last_updated: FieldValue.serverTimestamp()
    };

    // We can't strictly type-check 'interests' vs UserProfile 
    // if UserProfile doesn't have it, but we can save it to Firestore anyway.
    const dataToSave = {
      ...profile,
      interests: user.interests || [],
      siblings: []
    };

    batch.set(db.collection('profiles').doc(user.sessionId), dataToSave);
  }

  await batch.commit();
  logger.info(`🌱 Successfully seeded ${testUsers.length} test users`);
}