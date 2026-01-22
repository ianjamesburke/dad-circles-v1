import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock import.meta.env for tests
vi.stubGlobal('import', {
  meta: {
    env: {
      DEV: true,
      PROD: false,
      VITE_GEMINI_API_KEY: 'test-api-key',
    }
  }
});

// Reset all mocks between tests
beforeEach(() => {
  vi.clearAllMocks();
});

// Clean up after all tests
afterAll(() => {
  vi.restoreAllMocks();
});
