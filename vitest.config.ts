import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/functions/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: [
        'services/**/*.ts',
        'utils/**/*.ts',
        'config/**/*.ts',
        'types.ts',
      ],
      exclude: [
        '**/*.d.ts',
        'tests/**/*',
        '**/node_modules/**',
        'functions/**/*',
      ],
    },
    testTimeout: 10000,
    // Silence console output during tests (optional - uncomment to enable)
    // silent: true,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './'),
    },
  },
});
