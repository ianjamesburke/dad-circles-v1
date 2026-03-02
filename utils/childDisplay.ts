/**
 * Utility functions for displaying child information consistently
 */

import { Child } from '../types';

/**
 * Determine if a child is "expecting" (not yet born) based on birth date.
 * This replaces the deprecated `type` field - we infer from the date instead.
 */
export function isExpecting(child: Child): boolean {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-indexed

  // If birth year is in the future, definitely expecting
  if (child.birth_year > currentYear) {
    return true;
  }

  // If birth year is current year, check month
  if (child.birth_year === currentYear) {
    // If no month provided, assume not expecting (conservative)
    if (!child.birth_month) {
      return false;
    }
    // If birth month is in the future, expecting
    return child.birth_month > currentMonth;
  }

  // Birth year is in the past - not expecting
  return false;
}

/**
 * Format child birth/due date for display
 * Handles optional birth_month gracefully
 */
export function formatChildDate(child: Child): string {
  if (child.birth_month) {
    return `${child.birth_month}/${child.birth_year}`;
  }
  return `${child.birth_year}`;
}

/**
 * Format child info with type prefix (Expecting/Born)
 */
export function formatChildInfo(child: Child): string {
  const dateStr = formatChildDate(child);
  if (isExpecting(child)) {
    return `Expecting ${dateStr}`;
  }
  return `Born ${dateStr}`;
}

/**
 * Format child info with gender if available
 */
export function formatChildInfoWithGender(child: Child): string {
  const baseInfo = formatChildInfo(child);
  if (child.gender) {
    return `${baseInfo}, ${child.gender}`;
  }
  return baseInfo;
}

/**
 * Compact child summary for admin tables/cards.
 * Uses the first child as the matching/display anchor and indicates extra children.
 */
export function formatChildrenSummary(children?: Child[] | null): string {
  if (!children || children.length === 0) return 'No children info';
  const base = formatChildInfo(children[0]);
  return children.length > 1 ? `${base} (+${children.length - 1} more)` : base;
}
