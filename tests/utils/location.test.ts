import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getLocationFromPostcode } from '../../utils/location';

global.fetch = vi.fn();

describe('getLocationFromPostcode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return location info for valid US postcode (5 digits)', async () => {
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
      stateCode: 'CA',
      countryCode: 'US'
    });
    expect(global.fetch).toHaveBeenCalledWith('https://api.zippopotam.us/us/90210');
  });

  it('should return location info for valid AU postcode (4 digits)', async () => {
    const mockResponse = {
      places: [
        {
          'place name': 'Sydney',
          'state': 'New South Wales',
          'state abbreviation': 'NSW'
        }
      ]
    };

    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => mockResponse
    });

    const result = await getLocationFromPostcode('2000');

    expect(result).toEqual({
      city: 'Sydney',
      state: 'New South Wales',
      stateCode: 'NSW',
      countryCode: 'AU'
    });
    expect(global.fetch).toHaveBeenCalledWith('https://api.zippopotam.us/au/2000');
  });

  it('should return null for unsupported/invalid postcode format', async () => {
    // Too short
    let result = await getLocationFromPostcode('123');
    expect(result).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();

    // Unsupported format (UK) - should return null gracefully
    result = await getLocationFromPostcode('SW1A 1AA');
    expect(result).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('should return null if API returns 404', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: false
    });

    const result = await getLocationFromPostcode('00000'); // Valid format, invalid code
    expect(result).toBeNull();
  });

  it('should return null if fetch fails', async () => {
    (global.fetch as any).mockRejectedValue(new Error('Network error'));

    const result = await getLocationFromPostcode('90210');
    expect(result).toBeNull();
  });

  it('should handle whitespace in postcode', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        places: [{ 'place name': 'Beverly Hills', 'state': 'California', 'state abbreviation': 'CA' }]
      })
    });

    await getLocationFromPostcode('  90210  ');
    expect(global.fetch).toHaveBeenCalledWith('https://api.zippopotam.us/us/90210');
  });
});
