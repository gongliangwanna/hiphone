import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // @hiphone/* aliases so src/apps/* files that use SDK imports can be
      // tested directly by vitest (outside the sandbox), e.g. hook unit tests.
      '@hiphone/ai': path.resolve(__dirname, './src/platform/userApp/sdk/ai'),
      '@hiphone/ui': path.resolve(__dirname, './src/platform/userApp/sdk/ui'),
      '@hiphone/motion': path.resolve(__dirname, './src/platform/userApp/sdk/motion'),
      '@hiphone/toast': path.resolve(__dirname, './src/platform/userApp/sdk/toast'),
      '@hiphone/storage': path.resolve(__dirname, './src/platform/userApp/sdk/storage'),
      '@hiphone/nav': path.resolve(__dirname, './src/platform/userApp/sdk/nav'),
      '@hiphone/perspective': path.resolve(__dirname, './src/platform/userApp/sdk/perspective'),
      '@hiphone/hooks': path.resolve(__dirname, './src/platform/userApp/sdk/hooks'),
      '@hiphone/banner': path.resolve(__dirname, './src/platform/userApp/sdk/banner'),
      '@hiphone/services': path.resolve(__dirname, './src/platform/userApp/sdk/services'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    css: true,
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
