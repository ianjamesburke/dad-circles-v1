/**
 * Matching Service
 * 
 * Implements the core matching algorithm that groups dads based on:
 * 1. Geographic location (City + State)
 * 2. Life stage (Expecting, Newborn, Infant, Toddler)
 * 3. Age proximity within life stage
 */

import { database, getLifeStageFromUser } from '../database';
import { UserProfile, Group, LifeStage, MatchingResult, UserLocation } from '../types';

interface MatchingConfig {
  minGroupSize: number;
  maxGroupSize: number;
  maxAgeGapMonths: Record<LifeStage, number>;
}

const DEFAULT_CONFIG: MatchingConfig = {
  minGroupSize: 4,
  maxGroupSize: 6,
  maxAgeGapMonths: {
    [LifeStage.EXPECTING]: 6, // 6 months between due dates
    [LifeStage.NEWBORN]: 3,   // 3 months for newborns (0-6 months)
    [LifeStage.INFANT]: 6,    // 6 months for infants (6-18 months)
    [LifeStage.TODDLER]: 12,  // 12 months for toddlers (18-36 months)
  }
};

/**
 * Calculate child age in months from birth date
 */
function calculateAgeInMonths(birthMonth: number, birthYear: number): number {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // JavaScript months are 0-indexed

  return (currentYear - birthYear) * 12 + (currentMonth - birthMonth);
}

/**
 * Calculate due date score for expecting fathers (lower is sooner)
 */
function calculateDueDateScore(birthMonth: number, birthYear: number): number {
  const now = new Date();
  const dueDate = new Date(birthYear, birthMonth - 1); // JavaScript months are 0-indexed
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
      // Sort by due date (sooner first)
      const scoreA = calculateDueDateScore(childA.birth_month, childA.birth_year);
      const scoreB = calculateDueDateScore(childB.birth_month, childB.birth_year);
      return scoreA - scoreB;
    } else {
      // Sort by child age (younger first)
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
 * Generate a group name based on location and life stage
 */
function generateGroupName(location: UserLocation, lifeStage: LifeStage, sequence: number): string {
  return `${location.city} ${lifeStage} Dads - Group ${sequence}`;
}

/**
 * Form groups from a list of users in the same life stage and location
 */
async function formGroupsFromUsers(
  users: UserProfile[],
  location: UserLocation,
  lifeStage: LifeStage,
  testMode: boolean,
  config: MatchingConfig
): Promise<Group[]> {
  if (users.length < config.minGroupSize) {
    console.log(`⏳ ${location.city}, ${location.state_code} ${lifeStage}: Only ${users.length} users (need ${config.minGroupSize}+ for group)`);
    return []; // Not enough users to form a group
  }

  const sortedUsers = sortUsersByAge(users, lifeStage);
  const groups: Group[] = [];
  let groupSequence = 1;

  // Greedy chunking approach
  for (let i = 0; i < sortedUsers.length; i += config.maxGroupSize) {
    const chunk = sortedUsers.slice(i, i + config.maxGroupSize);

    // Validate minimum size
    if (chunk.length < config.minGroupSize) {
      console.log(`⏳ ${location.city}, ${location.state_code} ${lifeStage}: Remaining ${chunk.length} users insufficient for group`);
      break;
    }

    // Validate age gap
    if (!validateAgeGap(chunk, lifeStage, config)) {
      console.log(`⚠️ ${location.city}, ${location.state_code} ${lifeStage}: Age gap too wide for group ${groupSequence}`);
      continue;
    }

    // Create the group
    const groupData: Omit<Group, 'group_id' | 'created_at'> = {
      name: generateGroupName(location, lifeStage, groupSequence),
      location: location,
      member_ids: chunk.map(u => u.session_id),
      member_emails: chunk.map(u => u.email || '').filter(email => email),
      status: 'pending',
      emailed_member_ids: [],
      test_mode: testMode,
      life_stage: lifeStage,
    };

    try {
      // Save group to database
      const savedGroup = await database.createGroup(groupData);
      groups.push(savedGroup);

      console.log(`✅ Created group "${savedGroup.name}" with ${savedGroup.member_ids.length} members`);
      groupSequence++;

    } catch (error) {
      console.error(`❌ Failed to create group for ${location.city}, ${location.state_code} ${lifeStage}:`, error);
      throw new Error(`Failed to create group: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  return groups;
}

/**
 * Send group introduction emails for newly created groups
 */
async function sendGroupEmails(groups: Group[], testMode: boolean): Promise<void> {
  if (groups.length === 0) {
    console.log('📧 No groups to send emails for');
    return;
  }

  console.log(`📧 Sending introduction emails for ${groups.length} groups (${testMode ? 'TEST MODE' : 'PRODUCTION'})`);

  for (const group of groups) {
    try {
      // Get member details for email
      const memberDetails: Array<{ email: string; name: string; childInfo: string }> = [];

      for (const sessionId of group.member_ids) {
        try {
          const user = await database.getProfile(sessionId);
          if (user && user.email) {
            // Generate child info string
            let childInfo = 'Dad';
            if (user.children && user.children.length > 0) {
              const child = user.children[0];
              if (child.type === 'expecting') {
                childInfo = `Expecting ${child.birth_month}/${child.birth_year}`;
              } else {
                const ageInMonths = calculateAgeInMonths(child.birth_month, child.birth_year);
                if (ageInMonths <= 6) {
                  childInfo = `${ageInMonths}mo old`;
                } else if (ageInMonths <= 36) {
                  const years = Math.floor(ageInMonths / 12);
                  const months = ageInMonths % 12;
                  childInfo = years > 0 ? `${years}y ${months}mo old` : `${months}mo old`;
                } else {
                  childInfo = `${Math.floor(ageInMonths / 12)}y old`;
                }
              }
            }

            memberDetails.push({
              email: user.email,
              name: user.email.split('@')[0], // Use email prefix as name
              childInfo
            });
          }
        } catch (userError) {
          console.error(`❌ Error getting user details for ${sessionId}:`, userError);
        }
      }

      if (memberDetails.length === 0) {
        console.warn(`⚠️ No members with email addresses found for group ${group.name}`);
        continue;
      }

      // Import and use email service
      try {
        // @ts-ignore - Dynamic import of backend service
        const { EmailService } = await import('../functions/src/emailService');

        const emailResult = await EmailService.sendGroupIntroductionEmail(
          group.name,
          memberDetails,
          testMode
        );

        if (emailResult.success && emailResult.emailedMembers.length > 0) {
          // Update group with email results
          await database.updateGroup(group.group_id, {
            emailed_member_ids: emailResult.emailedMembers,
            introduction_email_sent_at: Date.now(),
            status: 'active'
          });

          console.log(`✅ Sent introduction emails for group "${group.name}" to ${emailResult.emailedMembers.length} members`);
        } else {
          console.warn(`⚠️ Failed to send emails for group "${group.name}"`);
        }

      } catch (emailError) {
        console.error(`❌ Error importing/using email service for group ${group.name}:`, emailError);
        // Continue with other groups rather than failing completely
      }

    } catch (groupError) {
      console.error(`❌ Error processing emails for group ${group.name}:`, groupError);
      // Continue with other groups rather than failing completely
    }
  }

  console.log('📧 Group email processing complete');
}
/**
 * Update user profiles with group assignments
 */
async function assignUsersToGroups(groups: Group[]): Promise<void> {
  const updatePromises: Promise<void>[] = [];

  for (const group of groups) {
    for (const sessionId of group.member_ids) {
      updatePromises.push(
        database.updateUserGroupAssignment(sessionId, group.group_id)
          .catch(error => {
            console.error(`❌ Failed to assign user ${sessionId} to group ${group.group_id}:`, error);
            throw error;
          })
      );
    }
  }

  try {
    await Promise.all(updatePromises);
    console.log(`✅ Successfully assigned ${updatePromises.length} users to groups`);
  } catch (error) {
    console.error('❌ Failed to assign some users to groups:', error);
    throw new Error(`Failed to assign users to groups: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Main matching algorithm with full persistence
 */
export async function runMatchingAlgorithm(
  city?: string,
  stateCode?: string,
  testMode: boolean = false,
  config: MatchingConfig = DEFAULT_CONFIG
): Promise<MatchingResult> {
  console.log(`🔄 Running matching algorithm${city ? ` for ${city}, ${stateCode}` : ' for all cities'}${testMode ? ' (TEST MODE)' : ''}`);

  try {
    // Step 1: Get unmatched users
    const unmatchedUsers = await database.getUnmatchedUsers(city, stateCode);
    console.log(`📊 Found ${unmatchedUsers.length} unmatched eligible users`);

    if (unmatchedUsers.length === 0) {
      return {
        groups_created: [],
        users_matched: 0,
        users_unmatched: 0,
        summary: 'No unmatched users found'
      };
    }

    // Step 2: Group by location and life stage
    const locationLifeStageBuckets: Record<string, Record<LifeStage, UserProfile[]>> = {};

    for (const user of unmatchedUsers) {
      if (!user.location) {
        console.warn(`⚠️ User ${user.session_id} has no location data, skipping`);
        continue;
      }

      const locationKey = `${user.location.city}|${user.location.state_code}`;
      const lifeStage = getLifeStageFromUser(user);

      if (!lifeStage) {
        console.warn(`⚠️ User ${user.session_id} has no valid life stage, skipping`);
        continue;
      }

      if (!locationLifeStageBuckets[locationKey]) {
        locationLifeStageBuckets[locationKey] = {
          [LifeStage.EXPECTING]: [],
          [LifeStage.NEWBORN]: [],
          [LifeStage.INFANT]: [],
          [LifeStage.TODDLER]: [],
        };
      }

      locationLifeStageBuckets[locationKey][lifeStage].push(user);
    }

    console.log(`📍 Organized users into ${Object.keys(locationLifeStageBuckets).length} location buckets`);

    // Step 3: Form groups for each location + life stage combination
    const allGroups: Group[] = [];
    let totalUsersMatched = 0;

    for (const [locationKey, lifeStageBuckets] of Object.entries(locationLifeStageBuckets)) {
      const [cityName, stateCodeName] = locationKey.split('|');
      const location: UserLocation = { city: cityName, state_code: stateCodeName };

      for (const [lifeStageStr, users] of Object.entries(lifeStageBuckets)) {
        const lifeStage = lifeStageStr as LifeStage;

        if (users.length === 0) continue;

        console.log(`🏙️ Processing ${location.city}, ${location.state_code} - ${lifeStage}: ${users.length} users`);

        try {
          const groups = await formGroupsFromUsers(users, location, lifeStage, testMode, config);
          allGroups.push(...groups);

          // Count matched users
          for (const group of groups) {
            totalUsersMatched += group.member_ids.length;
          }

        } catch (error) {
          console.error(`❌ Failed to form groups for ${location.city}, ${location.state_code} - ${lifeStage}:`, error);
          // Continue with other locations rather than failing completely
        }
      }
    }

    // Step 4: Assign users to groups in database
    if (allGroups.length > 0) {
      try {
        await assignUsersToGroups(allGroups);
      } catch (error) {
        console.error('❌ Failed to assign users to groups, rolling back...');
        // TODO: Implement rollback logic if needed
        throw error;
      }
    }

    // Step 5: Send group introduction emails (if not test mode or if test mode is explicitly requested)
    if (allGroups.length > 0) {
      try {
        await sendGroupEmails(allGroups, testMode);
      } catch (error) {
        console.error('❌ Failed to send group emails (continuing anyway):', error);
        // Don't fail the entire matching process if emails fail
      }
    }

    const totalUsersUnmatched = unmatchedUsers.length - totalUsersMatched;

    const summary = `Created ${allGroups.length} groups, matched ${totalUsersMatched} users, ${totalUsersUnmatched} remain unmatched`;
    console.log(`🎉 Matching complete: ${summary}`);

    return {
      groups_created: allGroups,
      users_matched: totalUsersMatched,
      users_unmatched: totalUsersUnmatched,
      summary
    };

  } catch (error) {
    console.error('❌ Error in matching algorithm:', error);
    throw new Error(`Matching algorithm failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get unmatched users with optional filtering
 */
export async function getUnmatchedUsers(city?: string, stateCode?: string): Promise<UserProfile[]> {
  try {
    return await database.getUnmatchedUsers(city, stateCode);
  } catch (error) {
    console.error('❌ Error getting unmatched users:', error);
    throw new Error(`Failed to get unmatched users: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get matching statistics
 */
export async function getMatchingStats() {
  try {
    return await database.getMatchingStats();
  } catch (error) {
    console.error('❌ Error getting matching statistics:', error);
    throw new Error(`Failed to get matching statistics: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get all groups with optional filtering
 */
export async function getAllGroups(): Promise<Group[]> {
  try {
    return await database.getAllGroups();
  } catch (error) {
    console.error('❌ Error getting all groups:', error);
    throw new Error(`Failed to get groups: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get groups by location
 */
export async function getGroupsByLocation(city: string, stateCode: string): Promise<Group[]> {
  try {
    return await database.getGroupsByLocation(city, stateCode);
  } catch (error) {
    console.error('❌ Error getting groups by location:', error);
    throw new Error(`Failed to get groups by location: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}