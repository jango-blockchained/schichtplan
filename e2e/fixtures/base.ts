/**
 * Base test fixtures for Schichtplan E2E tests
 * Extends Playwright's base test with custom fixtures
 */
import { test as base, expect } from '@playwright/test';

/**
 * Custom test context with Schichtplan-specific helpers
 */
export type TestContext = {
  // Authentication helpers
  loginAsAdmin: () => Promise<void>;
  logout: () => Promise<void>;
  
  // Navigation helpers
  navigateTo: (page: string) => Promise<void>;
  
  // Wait helpers
  waitForPageLoad: () => Promise<void>;
  waitForApiResponse: (url: string) => Promise<void>;
};

/**
 * Extended test with custom fixtures
 */
export const test = base.extend<TestContext>({
  /**
   * Login as admin user
   */
  loginAsAdmin: async ({ page }, use) => {
    const login = async () => {
      // Navigate to login page
      await page.goto('/login');
      
      // Wait for page to load
      await page.waitForLoadState('networkidle');
      
      // Note: This is a placeholder. Actual implementation depends on:
      // - Whether passkey authentication is set up
      // - Development mode bypasses
      // - Test database state
      
      console.log('⚠️  Login implementation needed - depends on setup state');
    };
    
    await use(login);
  },
  
  /**
   * Logout current user
   */
  logout: async ({ page }, use) => {
    const logoutFn = async () => {
      // Click on user menu or logout button
      await page.click('[data-testid="user-menu"]').catch(() => {
        console.log('User menu not found');
      });
      
      await page.click('text=Logout').catch(() => {
        console.log('Logout button not found');
      });
      
      await page.waitForURL('/login');
    };
    
    await use(logoutFn);
  },
  
  /**
   * Navigate to a specific page
   */
  navigateTo: async ({ page }, use) => {
    const navigate = async (pageName: string) => {
      const routes: Record<string, string> = {
        'home': '/',
        'dashboard': '/dashboard',
        'employees': '/employees',
        'schedule': '/schedule',
        'settings': '/settings',
        'availability': '/availability',
        'statistics': '/statistics',
      };
      
      const route = routes[pageName] || pageName;
      await page.goto(route);
      await page.waitForLoadState('networkidle');
    };
    
    await use(navigate);
  },
  
  /**
   * Wait for page to fully load
   */
  waitForPageLoad: async ({ page }, use) => {
    const wait = async () => {
      await page.waitForLoadState('networkidle');
      // Also wait for any pending API calls
      await page.waitForTimeout(500);
    };
    
    await use(wait);
  },
  
  /**
   * Wait for specific API response
   */
  waitForApiResponse: async ({ page }, use) => {
    const wait = async (url: string) => {
      await page.waitForResponse(response => 
        response.url().includes(url) && response.status() === 200
      );
    };
    
    await use(wait);
  },
});

// Re-export expect
export { expect };
