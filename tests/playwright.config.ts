import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false, // Disable parallel execution to prevent multiple tests running
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Force sequential execution with single worker
  reporter: 'html',
  timeout: 60000, // Increase timeout for comprehensive tests
  use: {
    baseURL: 'https://kollator.local:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    ignoreHTTPSErrors: true, // Ignore HTTPS certificate errors for local development
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // Remove webServer since we'll manage servers externally via test-harness.sh
});
