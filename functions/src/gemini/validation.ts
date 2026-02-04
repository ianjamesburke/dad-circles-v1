/**
 * Profile Validation - Unified Source of Truth
 *
 * Validates and applies profile updates from Gemini extraction calls.
 * We keep this narrow and deterministic: sanitize inputs, then let
 * the dialog manager decide the next prompt.
 */

import { logger } from '../logger';
import { CONFIG } from '../config';

interface ExtractionArgs {
  name?: string;
  children_add?: Array<{ birth_year: number; birth_month?: number; gender?: string }>;
  children_replace?: Array<{ birth_year: number; birth_month?: number; gender?: string }>;
  children_age_years?: number[];
  interests?: string[];
  interests_clear?: boolean;
  location?: { city: string; state_code: string; country_code?: string };
  confirm_profile?: boolean;
  no_more_children?: boolean;
  has_more_children?: boolean;
}

interface UserProfile {
  name?: string;
  children?: Array<{ birth_year: number; birth_month?: number; gender?: string }>;
  interests?: string[];
  location?: { city: string; state_code: string; country_code?: string };
  onboarded?: boolean;
  children_complete?: boolean;
}

export interface DialogSignals {
  needsChildBirthdate?: boolean;
  confirmProfile?: boolean;
  noMoreChildren?: boolean;
  hasMoreChildren?: boolean;
}

const normalizeName = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
};

const normalizeInterests = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  const normalized = value
    .filter(i => typeof i === 'string' && i.trim())
    .map(i => i.trim());
  return normalized;
};

const normalizeChild = (child: any, errors: string[]): { birth_year: number; birth_month?: number; gender?: string } | null => {
  if (!child || typeof child !== 'object') {
    errors.push('Invalid child entry');
    return null;
  }
  if (!child.birth_year ||
    child.birth_year < CONFIG.validation.minBirthYear ||
    child.birth_year > CONFIG.validation.maxBirthYear) {
    errors.push(`Invalid birth year: ${child.birth_year}`);
    return null;
  }
  if (child.birth_month !== undefined && (child.birth_month < 1 || child.birth_month > 12)) {
    errors.push(`Invalid birth month: ${child.birth_month}`);
    return null;
  }
  const normalized: { birth_year: number; birth_month?: number; gender?: string } = {
    birth_year: child.birth_year,
  };
  if (child.birth_month) normalized.birth_month = child.birth_month;
  if (child.gender === 'Boy' || child.gender === 'Girl') {
    normalized.gender = child.gender;
  }
  return normalized;
};

const dedupeChildren = (children: Array<{ birth_year: number; birth_month?: number; gender?: string }>) => {
  const seen = new Set<string>();
  const result: Array<{ birth_year: number; birth_month?: number; gender?: string }> = [];
  for (const child of children) {
    const key = `${child.birth_year}-${child.birth_month ?? ''}-${child.gender ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(child);
  }
  return result;
};

/**
 * Validate and apply extraction updates
 *
 * @param args - Extraction arguments from Gemini
 * @param currentProfile - Current user profile state
 * @returns Object containing validated updates, signals, and any validation errors
 */
export const validateAndApplyExtraction = (
  args: ExtractionArgs,
  currentProfile: UserProfile
): { updates: any; signals: DialogSignals; errors: string[] } => {
  const updates: any = {};
  const signals: DialogSignals = {};
  const errors: string[] = [];

  // Name validation - simple string
  if (args.name !== undefined) {
    const normalized = normalizeName(args.name);
    if (normalized) {
      updates.name = normalized;
    } else {
      errors.push('Invalid name');
    }
  }

  // Children replacement (explicit correction)
  if (args.children_replace !== undefined) {
    if (Array.isArray(args.children_replace)) {
      const normalized = args.children_replace
        .map(child => normalizeChild(child, errors))
        .filter(Boolean) as Array<{ birth_year: number; birth_month?: number; gender?: string }>;
      updates.children = dedupeChildren(normalized);
    } else {
      errors.push('children_replace must be an array');
    }
  }

  // Children additions (append)
  if (args.children_add !== undefined) {
    if (Array.isArray(args.children_add)) {
      const normalized = args.children_add
        .map(child => normalizeChild(child, errors))
        .filter(Boolean) as Array<{ birth_year: number; birth_month?: number; gender?: string }>;
      if (normalized.length > 0) {
        const baseChildren = Array.isArray(updates.children)
          ? updates.children
          : (Array.isArray(currentProfile.children) ? currentProfile.children : []);
        const merged = dedupeChildren([...baseChildren, ...normalized]);
        updates.children = merged;
        if (!args.no_more_children) {
          updates.children_complete = false;
        }
      }
    } else {
      errors.push('children_add must be an array');
    }
  }

  // Age-only children (needs follow-up)
  if (Array.isArray(args.children_age_years) && args.children_age_years.length > 0) {
    signals.needsChildBirthdate = true;
  }

  // Interests
  if (args.interests_clear === true) {
    updates.interests = [];
  } else if (args.interests !== undefined) {
    const normalized = normalizeInterests(args.interests);
    if (normalized) {
      updates.interests = normalized;
    } else {
      errors.push('Interests must be an array of strings');
    }
  }

  // Location
  if (args.location !== undefined) {
    const city = args.location?.city?.trim();
    const state = args.location?.state_code?.trim().toUpperCase();
    const explicitCountry = args.location?.country_code?.trim().toUpperCase()
      || currentProfile.location?.country_code;
    const country = explicitCountry || (state && state.length === 3 ? 'AU' : 'US');
    if (
      city &&
      state &&
      CONFIG.validation.stateCodePattern.test(state) &&
      CONFIG.validation.countryCodePattern.test(country)
    ) {
      updates.location = { city, state_code: state, country_code: country };
    } else {
      errors.push('Location needs city, state/region code, and country code');
    }
  }

  // Confirmation + sibling signals
  if (args.confirm_profile === true) {
    signals.confirmProfile = true;
  }
  if (args.no_more_children === true) {
    updates.children_complete = true;
    signals.noMoreChildren = true;
  }
  if (args.has_more_children === true) {
    updates.children_complete = false;
    signals.hasMoreChildren = true;
  }

  if (errors.length) {
    logger.warn('Validation errors:', { errors });
  }

  return { updates, signals, errors };
};

/**
 * Check if profile has all required fields for completion
 */
export const isProfileComplete = (profile: UserProfile): boolean => {
  const hasChildren = Array.isArray(profile.children) && profile.children.length > 0;
  const hasInterests = profile.interests !== undefined;
  const hasLocation = !!(
    profile.location?.city &&
    profile.location?.state_code &&
    (profile.location?.country_code || 'US')
  );
  const childrenConfirmed = profile.children_complete === true;
  return !!(hasChildren && hasInterests && hasLocation && childrenConfirmed);
};
