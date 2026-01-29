/**
 * PII (Personally Identifiable Information) Utilities
 * 
 * Provides functions to mask sensitive data in logs to comply with privacy best practices.
 */

/**
 * Masks an email address for logging purposes
 * Examples:
 *   john.doe@example.com -> j***@example.com
 *   a@test.com -> a***@test.com
 *   verylongemail@domain.co.uk -> v***@domain.co.uk
 */
export function maskEmail(email: string | undefined | null): string {
  if (!email) return '[no-email]';
  
  const [localPart, domain] = email.split('@');
  
  if (!domain) {
    // Invalid email format
    return '[invalid-email]';
  }
  
  // Show first character of local part, mask the rest
  const maskedLocal = localPart.length > 0 
    ? `${localPart[0]}***` 
    : '***';
  
  return `${maskedLocal}@${domain}`;
}

/**
 * Masks a postcode for logging purposes
 * Shows first 3 characters, masks the rest
 * Examples:
 *   SW1A 1AA -> SW1***
 *   12345 -> 123***
 */
export function maskPostcode(postcode: string | undefined | null): string {
  if (!postcode) return '[no-postcode]';
  
  const cleaned = postcode.replace(/\s/g, '');
  
  if (cleaned.length <= 3) {
    return '***';
  }
  
  return `${cleaned.substring(0, 3)}***`;
}

/**
 * Creates a safe logging object that masks PII fields
 * Use this when logging objects that may contain sensitive data
 */
export function maskPII<T extends Record<string, any>>(obj: T): T {
  const masked: any = { ...obj };
  
  // Mask email fields
  if ('email' in masked && masked.email) {
    masked.email = maskEmail(masked.email);
  }
  
  // Mask postcode fields
  if ('postcode' in masked && masked.postcode) {
    masked.postcode = maskPostcode(masked.postcode);
  }
  
  return masked as T;
}
