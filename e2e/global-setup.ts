/**
 * Global setup for Playwright E2E tests
 * Runs once before all tests
 */
import { FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting E2E test suite...');
  console.log(`📍 Base URL: ${config.use?.baseURL || 'http://localhost:5173'}`);
  console.log(`🌐 Projects: ${config.projects.map(p => p.name).join(', ')}`);
  
  // Here you can add global setup logic such as:
  // - Starting additional services
  // - Setting up test database
  // - Authenticating for all tests
  // - Seeding test data
  
  return async () => {
    // Global teardown logic can be returned here
    console.log('✅ E2E test suite initialization complete');
  };
}

export default globalSetup;
