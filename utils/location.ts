export interface LocationInfo {
  city: string;
  state: string;
  stateCode: string;
  countryCode: string;
}

/**
 * Convert a postcode to city and state information (US/AU supported)
 * Returns null if lookup fails or format is not supported (does not block access).
 *
 * @param postcode - Postcode string (any format)
 * @returns LocationInfo object or null if lookup fails
 */
export const getLocationFromPostcode = async (postcode: string): Promise<LocationInfo | null> => {
  try {
    const normalized = postcode.trim().replace(/\s+/g, '');

    // Detect country based on format
    const usMatch = normalized.match(/^\d{5}/);
    const auMatch = normalized.match(/^\d{4}/);

    // We strictly identify US and AU for lookup purposes only.
    // Any other format will simply return null (no location data), 
    // but should be considered "valid" for the purpose of the application.
    const countryCode = usMatch ? 'US' : auMatch ? 'AU' : null;
    const cleanPostcode = usMatch ? usMatch[0] : auMatch ? auMatch[0] : '';

    if (!countryCode || !cleanPostcode) {
      // Not a supported lookup format, but valid input.
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
    // Log primarily for debugging, but don't treat as a fatal error
    console.warn('Location lookup failed for postcode:', postcode, error);
    return null;
  }
};
