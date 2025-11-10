/**
 * Global setup for Playwright E2E tests
 * Runs once before all tests
 */
import { FullConfig, chromium } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting E2E test suite...');
  console.log(`📍 Base URL: ${config.use?.baseURL || 'http://localhost:5173'}`);
  console.log(`🌐 Projects: ${config.projects.map(p => p.name).join(', ')}`);
  
  const baseURL = config.use?.baseURL || 'http://localhost:5173';
  
  try {
    // Seed test data
    console.log('📦 Seeding test data...');
    const response = await fetch(`${baseURL.replace('5173', '5000')}/api/v2/demo-data/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (response.ok) {
      console.log('✅ Test data seeded successfully');
    } else {
      console.log('⚠️  Test data seeding skipped or failed (may already exist)');
    }
  } catch (error) {
    console.log('⚠️  Could not seed test data:', error instanceof Error ? error.message : 'Unknown error');
  }
  
  // Set up authentication for tests
  console.log('🔐 Setting up test authentication...');
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    // Go to the app and set up auth
    await page.goto(baseURL);
    
    // Set test authentication token and flags in localStorage
    await page.evaluate(() => {
      localStorage.setItem('E2E_TEST_MODE', 'true');
      localStorage.setItem('auth_token', 'test-token-e2e-playwright');
      localStorage.setItem('setup_complete', 'true');
    });
    
    // Save the authentication state
    await context.storageState({ path: 'e2e/.auth/user.json' });
    console.log('✅ Authentication state saved');
  } catch (error) {
    console.log('⚠️  Authentication setup failed:', error instanceof Error ? error.message : 'Unknown error');
  } finally {
    await browser.close();
  }
  
  return async () => {
    // Global teardown logic
    console.log('✅ E2E test suite initialization complete');
  };
}

export default globalSetup;
