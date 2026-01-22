/**
 * Test Factories
 * 
 * Provides factory functions for creating test data.
 * Use these to create consistent, valid test objects.
 */

import { 
  Message, 
  UserProfile, 
  OnboardingStep, 
  Role, 
  Child, 
  UserLocation,
  Group,
  LifeStage,
  Lead
} from '../../types';

let messageIdCounter = 0;
let sessionIdCounter = 0;

/**
 * Reset counters between test suites
 */
export function resetFactories(): void {
  messageIdCounter = 0;
  sessionIdCounter = 0;
}

/**
 * Create a test message
 */
export function createMessage(overrides: Partial<Message> = {}): Message {
  messageIdCounter++;
  return {
    id: `msg-${messageIdCounter}`,
    session_id: 'test-session',
    timestamp: Date.now() - (1000 * messageIdCounter), // Stagger timestamps
    role: Role.USER,
    content: `Test message ${messageIdCounter}`,
    ...overrides,
  };
}

/**
 * Create multiple test messages
 */
export function createMessages(count: number, overrides: Partial<Message> = {}): Message[] {
  return Array.from({ length: count }, (_, i) => 
    createMessage({
      ...overrides,
      role: i % 2 === 0 ? Role.USER : Role.AGENT,
      content: `Message ${i + 1}`,
    })
  );
}

/**
 * Create a conversation (alternating user/agent messages)
 */
export function createConversation(turns: number, sessionId = 'test-session'): Message[] {
  const messages: Message[] = [];
  const baseTime = Date.now() - (turns * 2 * 1000);
  
  for (let i = 0; i < turns; i++) {
    messages.push({
      id: `msg-user-${i}`,
      session_id: sessionId,
      timestamp: baseTime + (i * 2 * 1000),
      role: Role.USER,
      content: `User message ${i + 1}`,
    });
    messages.push({
      id: `msg-agent-${i}`,
      session_id: sessionId,
      timestamp: baseTime + (i * 2 * 1000) + 500,
      role: Role.AGENT,
      content: `Agent response ${i + 1}`,
    });
  }
  
  return messages;
}

/**
 * Create a test child
 */
export function createChild(overrides: Partial<Child> = {}): Child {
  const now = new Date();
  return {
    type: 'existing',
    birth_month: now.getMonth() + 1,
    birth_year: now.getFullYear(),
    ...overrides,
  };
}

/**
 * Create an expecting child (due date in future)
 */
export function createExpectingChild(monthsFromNow = 3): Child {
  const dueDate = new Date();
  dueDate.setMonth(dueDate.getMonth() + monthsFromNow);
  return {
    type: 'expecting',
    birth_month: dueDate.getMonth() + 1,
    birth_year: dueDate.getFullYear(),
  };
}

/**
 * Create a child with specific age in months
 */
export function createChildWithAge(ageInMonths: number): Child {
  const birthDate = new Date();
  birthDate.setMonth(birthDate.getMonth() - ageInMonths);
  return {
    type: 'existing',
    birth_month: birthDate.getMonth() + 1,
    birth_year: birthDate.getFullYear(),
  };
}

/**
 * Create a test location
 */
export function createLocation(overrides: Partial<UserLocation> = {}): UserLocation {
  return {
    city: 'Austin',
    state_code: 'TX',
    ...overrides,
  };
}

/**
 * Create a test user profile
 */
export function createUserProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  sessionIdCounter++;
  return {
    session_id: `test-user-${sessionIdCounter}`,
    name: `Test User ${sessionIdCounter}`,
    email: `testuser${sessionIdCounter}@example.com`,
    onboarded: true,
    onboarding_step: OnboardingStep.COMPLETE,
    location: createLocation(),
    interests: ['parenting', 'sports'],
    children: [createChildWithAge(3)], // 3 month old by default
    last_updated: Date.now(),
    matching_eligible: true,
    ...overrides,
  };
}

/**
 * Create multiple user profiles in the same location
 */
export function createUsersInLocation(
  count: number, 
  location: UserLocation,
  childFactory: () => Child = () => createChildWithAge(3)
): UserProfile[] {
  return Array.from({ length: count }, () => 
    createUserProfile({
      location,
      children: [childFactory()],
    })
  );
}

/**
 * Create a test group
 */
export function createGroup(overrides: Partial<Group> = {}): Group {
  const location = createLocation();
  return {
    group_id: `group-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name: `${location.city} Newborn Dads - Group 1`,
    created_at: Date.now(),
    location,
    member_ids: [],
    member_emails: [],
    status: 'pending',
    emailed_member_ids: [],
    test_mode: false,
    life_stage: LifeStage.NEWBORN,
    ...overrides,
  };
}

/**
 * Create a test lead
 */
export function createLead(overrides: Partial<Lead> = {}): Lead {
  return {
    id: `lead-${Date.now()}`,
    email: 'testlead@example.com',
    postcode: '78701',
    signupForOther: false,
    timestamp: Date.now(),
    source: 'landing_page',
    ...overrides,
  };
}
