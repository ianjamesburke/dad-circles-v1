/**
 * Utility functions for displaying child information consistently
 */

import { Child } from '../types';

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
 * Format child info with type prefix (Expecting/Child born)
 */
export function formatChildInfo(child: Child): string {
  const dateStr = formatChildDate(child);
  if (child.type === 'expecting') {
    return `Expecting ${dateStr}`;
  }
  return `Child born ${dateStr}`;
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
