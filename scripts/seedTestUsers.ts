#!/usr/bin/env node

/**
 * Seed Test Users Script
 * 
 * Creates 50 realistic test user profiles for matching algorithm validation.
 * Geographic distribution: Ann Arbor (15), Austin (12), Boulder (10), Portland (8), Others (5)
 * Child age distribution: Expecting (25), Newborn (10), Infant (10), Toddler (5)
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator, doc, setDoc } from 'firebase/firestore';

// Define types locally to avoid import issues
interface Child {
  type: 'expecting' | 'existing';
  birth_month: number;
  birth_year: number;
  gender?: string;
}

interface UserLocation {
  city: string;
  state_code: string;
}

interface UserProfile {
  session_id: string;
  email?: string;
  onboarded: boolean;
  onboarding_step: string;
  location?: UserLocation;
  interests?: string[];
  children: Child[];
  siblings?: Child[];
  last_updated: number;
  matching_eligible: boolean;
}

// Firebase config for emulator
const firebaseConfig = {
  projectId: 'dad-circles',
  // Other config not needed for emulator
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Connect to emulator if running locally
if (process.env.NODE_ENV !== 'production') {
  try {
    connectFirestoreEmulator(db, 'localhost', 8083);
    console.log('🔧 Connected to Firestore emulator');
  } catch (error) {
    console.log('⚠️ Firestore emulator already connected or not available');
  }
}

interface TestUserTemplate {
  sessionId: string;
  email: string;
  location: UserLocation;
  childType: 'expecting' | 'existing';
  birthMonth: number;
  birthYear: number;
  gender?: string;
  interests: string[];
}

// Generate realistic test data
const generateTestUsers = (): TestUserTemplate[] => {
  const users: TestUserTemplate[] = [];
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

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

const seedTestUsers = async () => {
  console.log('🌱 Starting test user seeding...');
  
  try {
    const testUsers = generateTestUsers();
    console.log(`📊 Generated ${testUsers.length} test users`);

    let seededCount = 0;
    
    for (const user of testUsers) {
      const child: Child = {
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
        onboarding_step: 'complete',
        location: user.location,
        interests: user.interests,
        children: [child],
        siblings: [],
        last_updated: Date.now(),
        matching_eligible: true, // All test users are eligible for matching
      };

      const ref = doc(db, 'profiles', user.sessionId);
      await setDoc(ref, profile);
      seededCount++;
      
      if (seededCount % 10 === 0) {
        console.log(`✅ Seeded ${seededCount}/${testUsers.length} users...`);
      }
    }

    console.log(`🎉 Successfully seeded ${seededCount} test users!`);
    
    // Print summary
    const locationCounts = testUsers.reduce((acc, user) => {
      const key = `${user.location.city}, ${user.location.state_code}`;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log('\n📍 Geographic distribution:');
    Object.entries(locationCounts).forEach(([location, count]) => {
      console.log(`  ${location}: ${count} users`);
    });

    const childTypeCounts = testUsers.reduce((acc, user) => {
      acc[user.childType] = (acc[user.childType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log('\n👶 Child type distribution:');
    Object.entries(childTypeCounts).forEach(([type, count]) => {
      console.log(`  ${type}: ${count} users`);
    });

  } catch (error) {
    console.error('❌ Error seeding test users:', error);
    process.exit(1);
  }
};

// Run the seeding if this script is executed directly
seedTestUsers()
  .then(() => {
    console.log('✅ Seeding complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  });

export { seedTestUsers };