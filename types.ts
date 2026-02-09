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
  type?: 'expecting' | 'existing'; // Deprecated - use isExpecting() helper instead. Kept for backwards compatibility.
  birth_month?: number; // Optional - some users only provide year
  birth_year: number;
  gender?: string;
}

export interface UserLocation {
  city: string;
  state_code: string;
  country_code: string;
}

export interface UserProfile {
  session_id: string;
  name?: string; // User's first name
  dad_status?: 'current' | 'expecting' | 'both'; // Current/expecting dad status (inferred or stated)
  email?: string;
  postcode?: string; // Initial postcode from landing page
  onboarded: boolean;
  onboarding_step: OnboardingStep;
  location?: UserLocation;
  location_confirmed?: boolean;
  interests?: string[];
  children: Child[];
  children_complete?: boolean; // True when user confirms they have no other kids
  siblings?: Child[]; // Other existing children
  last_updated: any; // Firestore Timestamp (server-side) or number (legacy)

  // UTM attribution tracking
  utm?: UtmParams;

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

export interface UtmParams {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
}

export interface Lead {
  id?: string;
  email: string;
  postcode: string;
  signupForOther: boolean;
  session_id?: string; // Links to UserProfile for non-signupForOther leads
  timestamp: any; // Firestore Timestamp (server-side) or number (legacy)
  source: 'landing_page';

  // UTM attribution tracking
  utm?: UtmParams;

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

  // Unified communication tracking (simplifies follow-up queries)
  // Updated whenever a welcome or abandonment email is sent
  last_communication_at?: any; // Firestore timestamp
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

export type MissionLifeStage = 'expecting' | 'newborn' | 'infant' | 'toddler';
export type MissionBudget = 'free' | 'under_20' | 'under_50' | 'flexible';
export type MissionEnvironment = 'indoors' | 'outdoors' | 'either';
export type MissionEventCategory = 'local_dad_meetup' | 'with_kids' | 'without_kids';

export interface WeekendMissionRequest {
  postcode: string;
  life_stage: MissionLifeStage;
  interests: string[];
  constraints: {
    budget: MissionBudget;
    environment: MissionEnvironment;
    notes?: string;
  };
}

export interface WeekendMissionEvent {
  title: string;
  date_time: string;
  category: MissionEventCategory;
  location_name: string;
  address: string;
  price: string;
  url: string;
  start_iso: string;
  end_iso: string;
  source?: string;
  why_it_fits: string;
  safety_note: string;
  calendar_invite: {
    filename: string;
    ics: string;
  };
}

export interface WeekendMissionReport {
  title: string;
  summary: string;
  local_context: string;
  official_meetup_plan: {
    should_launch: boolean;
    rationale: string;
    suggested_format: string;
    attendee_threshold: string;
  };
}

export interface WeekendMissionPlan {
  title: string;
  summary: string;
  agenda: Array<{ time: string; activity: string }>;
  icebreakers: string[];
  backup_plan: string;
  safety_constraints: string[];
  fit_reasoning: string[];
}

export interface WeekendMissionResponse {
  location: {
    city: string;
    state_code: string;
    country_code: string;
    postcode: string;
  };
  events: WeekendMissionEvent[];
  sections: {
    local_dad_meetups: WeekendMissionEvent[];
    things_to_do_with_kids: WeekendMissionEvent[];
    things_to_do_without_kids: WeekendMissionEvent[];
  };
  report: WeekendMissionReport;
  mission: WeekendMissionPlan;
  email: {
    subject: string;
    body: string;
  };
  calendar_invite: {
    filename: string;
    ics: string;
  };
  generated_at: string;
}

export interface WeekendMissionJobResponse {
  job_id: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed';
}

export interface WeekendMissionJobStatus {
  job_id: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed';
  result?: WeekendMissionResponse;
  error?: string;
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
