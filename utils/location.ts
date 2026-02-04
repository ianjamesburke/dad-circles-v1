export interface LocationInfo {
  city: string;
  state: string;
  stateCode: string;
  countryCode: string;
}

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

export const formatLocationDisplay = (location?: {
  city?: string;
  state_code?: string;
  country_code?: string;
}): string | undefined => {
  if (!location?.city || !location?.state_code) return undefined;
  const country = location.country_code?.toUpperCase();
  const parts = [location.city, location.state_code];
  if (country && country !== 'US') {
    parts.push(country);
  }
  return parts.join(', ');
};
