import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getLocationFromPostcode } from '../../utils/location';

global.fetch = vi.fn();

describe('getLocationFromPostcode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return location info for valid postcode', async () => {
    const mockResponse = {
      places: [
        {
          'place name': 'Beverly Hills',
          'state': 'California',
          'state abbreviation': 'CA'
        }
      ]
    };

    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => mockResponse
    });

    const result = await getLocationFromPostcode('90210');

    expect(result).toEqual({
      city: 'Beverly Hills',
      state: 'California',
      stateCode: 'CA'
    });
    expect(global.fetch).toHaveBeenCalledWith('https://api.zippopotam.us/us/90210');
  });

  it('should return null for invalid postcode format', async () => {
    const result = await getLocationFromPostcode('123');
    expect(result).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('should return null if API returns 404', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: false
    });

    const result = await getLocationFromPostcode('00000');
    expect(result).toBeNull();
  });
  
  it('should return null if fetch fails', async () => {
     (global.fetch as any).mockRejectedValue(new Error('Network error'));
     
     const result = await getLocationFromPostcode('90210');
     expect(result).toBeNull();
  });
});
