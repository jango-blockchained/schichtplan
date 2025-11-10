import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E Test Configuration for Schichtplan
 * 
 * This configuration enables comprehensive browser testing across multiple devices
 * and browsers to ensure production readiness.
 * 
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  // Test directory
  testDir: './e2e',
  
  // Timeout for each test
  timeout: 60 * 1000,
  
  // Test run timeout
  globalTimeout: 15 * 60 * 1000,
  
  // Run tests in files in parallel
  fullyParallel: true,
  
  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,
  
  // Retry on CI only
  retries: process.env.CI ? 2 : 0,
  
  // Opt out of parallel tests on CI
  workers: process.env.CI ? 1 : undefined,
  
  // Reporter configuration
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'playwright-report/results.json' }],
    ['junit', { outputFile: 'playwright-report/junit.xml' }],
    ['list']
  ],
  
  // Shared settings for all projects
  use: {
    // Base URL for the application
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173',
    
    // Use saved authentication state
    storageState: 'e2e/.auth/user.json',
    
    // Collect trace on first retry
    trace: 'on-first-retry',
    
    // Screenshot on failure
    screenshot: 'only-on-failure',
    
    // Video on retry (disabled to avoid ffmpeg dependency)
    video: 'off',
    
    // Maximum time each action can take
    actionTimeout: 10 * 1000,
    
    // Navigation timeout
    navigationTimeout: 30 * 1000,
  },

  // Projects for major browsers and device emulation
  projects: [
    // Desktop Browsers
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    
    // Mobile Browsers
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 13'] },
    },
    
    // Tablet Browsers
    {
      name: 'iPad',
      use: { ...devices['iPad (gen 7)'] },
    },
    {
      name: 'iPad Pro',
      use: { ...devices['iPad Pro 11'] },
    },
    
    // Additional mobile devices for production testing
    {
      name: 'Galaxy S9+',
      use: { ...devices['Galaxy S9+'] },
    },
    {
      name: 'iPhone 12',
      use: { ...devices['iPhone 12'] },
    },
  ],

  // Web server configuration - start dev server before running tests
  webServer: {
    command: 'cd src/frontend && npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
    stdout: 'ignore',
    stderr: 'pipe',
  },

  // Global setup/teardown
  globalSetup: require.resolve('./e2e/global-setup.ts'),
  globalTeardown: require.resolve('./e2e/global-teardown.ts'),
});
