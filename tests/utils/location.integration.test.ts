import { describe, it, expect } from 'vitest';
import { getLocationFromPostcode } from '../../utils/location';

describe('getLocationFromPostcode Integration', () => {
  const shouldRun = process.env.RUN_INTEGRATION_TESTS === 'true';
  const testFn = shouldRun ? it : it.skip;

  testFn('should return Grand Rapids, MI for postcode 49506 using real API', async () => {
    const result = await getLocationFromPostcode('49506');

    expect(result).not.toBeNull();
    expect(result).toEqual({
      city: 'Grand Rapids',
      state: 'Michigan',
      stateCode: 'MI'
    });
  });
});
