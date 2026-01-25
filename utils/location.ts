export interface LocationInfo {
  city: string;
  state: string;
  stateCode: string;
}

export const getLocationFromPostcode = async (postcode: string): Promise<LocationInfo | null> => {
  try {
    // Basic validation for US zip codes (5 digits)
    const cleanPostcode = postcode.trim().substring(0, 5);
    if (!/^\d{5}$/.test(cleanPostcode)) {
      return null;
    }

    const response = await fetch(`https://api.zippopotam.us/us/${cleanPostcode}`);
    
    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    
    if (data.places && data.places.length > 0) {
      const place = data.places[0];
      return {
        city: place['place name'],
        state: place['state'],
        stateCode: place['state abbreviation']
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching location from postcode:', error);
    return null;
  }
};
