export enum OnboardingStep {
  WELCOME = 'welcome',
  NAME = 'name',
  STATUS = 'status',
  CHILD_INFO = 'child_info',
  SIBLINGS = 'siblings',
  INTERESTS = 'interests',
  LOCATION = 'location',
  CONFIRM = 'confirm',
  COMPLETE = 'complete'
}

export enum Role {
  USER = 'user',
  AGENT = 'agent',
  ADMIN = 'admin'
}

export interface Child {
  type: 'expecting' | 'existing';
  birth_month: number;
  birth_year: number;
  gender?: string;
}

export interface UserLocation {
  city: string;
  state_code: string;
}

export interface UserProfile {
  session_id: string;
  name?: string; // User's first name
  email?: string;
  postcode?: string; // Initial postcode from landing page
  onboarded: boolean;
  onboarding_step: OnboardingStep;
  location?: UserLocation;
  interests?: string[];
  children: Child[];
  siblings?: Child[]; // Other existing children
  last_updated: any; // Firestore Timestamp (server-side) or number (legacy)

  // Matching fields
  group_id?: string; // Reference to assigned group
  matched_at?: any; // Firestore Timestamp
  matching_eligible: boolean; // True if onboarded with valid location and child data

  // Email tracking fields
  abandonment_sent?: boolean;
  abandonment_sent_at?: any; // Firestore Timestamp
  welcomeEmailSent?: boolean;
  welcomeEmailSentAt?: any; // Firestore Timestamp
}

export interface Message {
  id: string;
  session_id: string;
  timestamp: any; // Firestore Timestamp (server-side) or number (legacy)
  role: Role;
  content: string;
}

export interface Lead {
  id?: string;
  email: string;
  postcode: string;
  signupForOther: boolean;
  session_id?: string; // Links to UserProfile for non-signupForOther leads
  timestamp: any; // Firestore Timestamp (server-side) or number (legacy)
  source: 'landing_page';

  // Email tracking fields
  welcomeEmailSent?: boolean;
  welcomeEmailSentAt?: any; // Firestore timestamp
  welcomeEmailFailed?: boolean;
  welcomeEmailFailedAt?: any; // Firestore timestamp
  welcomeEmailPending?: boolean;
  welcomeEmailPendingAt?: any; // Firestore timestamp

  // Abandonment email tracking (separate from welcome)
  abandonmentEmailSent?: boolean;
  abandonmentEmailSentAt?: any; // Firestore timestamp

  // Signup-other email tracking
  signupOtherEmailSent?: boolean;
  signupOtherEmailSentAt?: any; // Firestore timestamp

  // Follow-up email tracking
  followUpEmailSent?: boolean;
  followUpEmailSentAt?: any; // Firestore timestamp
  followUpEmailFailed?: boolean;
  followUpEmailFailedAt?: any; // Firestore timestamp
}

export enum LifeStage {
  EXPECTING = 'Expecting',
  NEWBORN = 'Newborn',
  INFANT = 'Infant',
  TODDLER = 'Toddler'
}

export interface Group {
  group_id: string;
  name: string;
  created_at: any; // Firestore Timestamp (server-side) or number (legacy)
  location: UserLocation;
  member_ids: string[]; // Array of session_ids (4-6 members)
  member_emails: string[]; // Array of member emails
  status: 'pending' | 'active' | 'inactive';
  emailed_member_ids: string[]; // Array of session_ids who successfully received the email
  introduction_email_sent_at?: any; // Firestore Timestamp
  test_mode: boolean; // True for test groups
  life_stage: LifeStage; // The life stage this group represents
}

export interface MatchingStats {
  total_users: number;
  matched_users: number;
  unmatched_users: number;
}

export interface MatchingResult {
  groups_created: Group[];
  users_matched: number;
  users_unmatched: number;
  summary: string;
}

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string; // Markdown or HTML
  author: string;
  published_at: any; // Firestore Timestamp (server-side) or number (legacy)
  is_published: boolean;
  cover_image?: string; // URL or path
  tags?: string[];
  read_time_minutes?: number;
}