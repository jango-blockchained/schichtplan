/**
 * Global teardown for Playwright E2E tests
 * Runs once after all tests
 */
import { FullConfig } from '@playwright/test';

async function globalTeardown(config: FullConfig) {
  console.log('🧹 Cleaning up E2E test environment...');
  
  // Here you can add global teardown logic such as:
  // - Stopping additional services
  // - Cleaning up test database
  // - Removing temporary files
  // - Generating final reports
  
  console.log('✅ E2E test suite cleanup complete');
}

export default globalTeardown;
