/**
 * Shared location utilities for Cloud Functions
 *
 * This module provides location lookup functionality that can be used
 * across Cloud Functions to convert postcodes to city/state information.
 */

export interface LocationInfo {
  city: string;
  state: string;
  stateCode: string;
  countryCode: string;
}

/**
 * Convert a postcode to city and state information (US/AU supported)
 *
 * @param postcode - Postcode (US 5 digits or AU 4 digits)
 * @returns LocationInfo object or null if lookup fails
 */
export const getLocationFromPostcode = async (postcode: string): Promise<LocationInfo | null> => {
  try {
    const normalized = postcode.trim().replace(/\s+/g, '');
    const usMatch = normalized.match(/^\d{5}/);
    const auMatch = normalized.match(/^\d{4}/);
    const countryCode = usMatch ? 'US' : auMatch ? 'AU' : null;
    const cleanPostcode = usMatch ? usMatch[0] : auMatch ? auMatch[0] : '';

    if (!countryCode || !cleanPostcode) {
      return null;
    }

    const response = await fetch(`https://api.zippopotam.us/${countryCode.toLowerCase()}/${cleanPostcode}`);

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    if (data.places && data.places.length > 0) {
      const place = data.places[0];
      const stateCode = place['state abbreviation'] || place['state'] || '';
      return {
        city: place['place name'],
        state: place['state'],
        stateCode,
        countryCode,
      };
    }

    return null;
  } catch (error) {
    console.error('Error fetching location from postcode:', error);
    return null;
  }
};

/**
 * Format location for display in emails
 *
 * @param city - City name
 * @param stateCode - Two-letter state code
 * @returns Formatted location string (e.g., "Austin, TX")
 */
export const formatLocation = (city: string, stateCode: string, countryCode?: string): string => {
  if (countryCode && countryCode.toUpperCase() !== 'US') {
    return `${city}, ${stateCode}, ${countryCode.toUpperCase()}`;
  }
  return `${city}, ${stateCode}`;
};
