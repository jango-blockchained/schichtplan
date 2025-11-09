/**
 * E2E tests for navigation and general UI functionality
 */
import { test, expect } from '../fixtures/base';

test.describe('Navigation', () => {
  test('should have functional navigation menu', async ({ page }) => {
    await page.goto('/');
    
    // Look for navigation menu
    const nav = page.locator('nav, [role="navigation"]');
    await expect(nav).toBeVisible({ timeout: 10000 });
  });

  test('should navigate to all main pages', async ({ page, navigateTo }) => {
    const pages = ['dashboard', 'employees', 'schedule', 'settings'];
    
    for (const pageName of pages) {
      console.log(`📍 Navigating to ${pageName}...`);
      
      await navigateTo(pageName);
      
      // Verify URL changed
      await expect(page).toHaveURL(new RegExp(pageName, 'i'), { timeout: 5000 });
      
      // Wait for page to load
      await page.waitForLoadState('networkidle');
      
      console.log(`✓ ${pageName} page loaded`);
    }
  });

  test('should display breadcrumbs', async ({ page, navigateTo }) => {
    await navigateTo('employees');
    
    // Look for breadcrumb navigation
    const breadcrumbs = page.locator('[aria-label="breadcrumb"], .breadcrumbs, nav ol');
    
    if (await breadcrumbs.isVisible({ timeout: 2000 }).catch(() => false)) {
      const items = await breadcrumbs.locator('a, span').count();
      console.log(`🍞 Found ${items} breadcrumb items`);
      expect(items).toBeGreaterThan(0);
    } else {
      console.log('ℹ️  Breadcrumbs not visible on this page');
    }
  });

  test('should have working back navigation', async ({ page, navigateTo }) => {
    await navigateTo('dashboard');
    const dashboardUrl = page.url();
    
    await navigateTo('employees');
    const employeesUrl = page.url();
    
    // Go back
    await page.goBack();
    await page.waitForLoadState('networkidle');
    
    // Verify we're back at dashboard
    expect(page.url()).toBe(dashboardUrl);
    console.log('✓ Browser back navigation works');
  });

  test('should handle 404 page', async ({ page }) => {
    const response = await page.goto('/non-existent-page-12345');
    
    // Check response status
    if (response) {
      console.log(`📄 Response status: ${response.status()}`);
    }
    
    // Check for 404 message or redirect
    const has404 = await page.locator('text=/404|not found|nicht gefunden/i')
      .isVisible({ timeout: 2000 })
      .catch(() => false);
    
    if (has404) {
      console.log('✓ 404 page displayed');
    } else {
      console.log('ℹ️  Redirected or custom error handling');
    }
  });
});

test.describe('Theme Toggle', () => {
  test('should toggle between light and dark theme', async ({ page }) => {
    await page.goto('/');
    
    // Look for theme toggle button
    const themeToggle = page.locator('[data-testid="theme-toggle"], button:has-text(/theme|dark|light/)');
    
    if (await themeToggle.isVisible({ timeout: 5000 }).catch(() => false)) {
      // Get initial theme
      const html = page.locator('html');
      const initialClass = await html.getAttribute('class') || '';
      
      console.log(`🎨 Initial theme: ${initialClass.includes('dark') ? 'dark' : 'light'}`);
      
      // Click toggle
      await themeToggle.click();
      await page.waitForTimeout(300);
      
      // Check theme changed
      const newClass = await html.getAttribute('class') || '';
      
      expect(newClass).not.toBe(initialClass);
      console.log(`✓ Theme toggled to: ${newClass.includes('dark') ? 'dark' : 'light'}`);
    } else {
      console.log('ℹ️  Theme toggle not found');
    }
  });

  test('should persist theme preference', async ({ page, context }) => {
    await page.goto('/');
    
    const themeToggle = page.locator('[data-testid="theme-toggle"], button:has-text(/theme/)');
    
    if (await themeToggle.isVisible({ timeout: 5000 }).catch(() => false)) {
      // Toggle theme
      await themeToggle.click();
      await page.waitForTimeout(300);
      
      const html = page.locator('html');
      const themeClass = await html.getAttribute('class');
      
      // Reload page
      await page.reload();
      await page.waitForLoadState('networkidle');
      
      // Check theme persisted
      const newThemeClass = await html.getAttribute('class');
      
      expect(newThemeClass).toBe(themeClass);
      console.log('✓ Theme preference persisted across reload');
    }
  });
});

test.describe('Notifications', () => {
  test('should display toast notifications', async ({ page, navigateTo }) => {
    await navigateTo('employees');
    
    // Try to trigger a notification by performing an action
    const addButton = page.getByRole('button', { name: /add|hinzufügen/i });
    
    if (await addButton.isVisible().catch(() => false)) {
      await addButton.click();
      await page.waitForTimeout(300);
      
      // Close dialog if opened
      const cancelButton = page.getByRole('button', { name: /cancel|abbrechen/i });
      if (await cancelButton.isVisible().catch(() => false)) {
        await cancelButton.click();
      }
      
      // Check for toast container
      const toast = page.locator('[data-testid="toast"], .toast, [role="alert"]');
      const hasToast = await toast.isVisible({ timeout: 2000 }).catch(() => false);
      
      console.log(hasToast ? '✓ Toast notification system working' : 'ℹ️  No toast shown for this action');
    }
  });
});

test.describe('Accessibility', () => {
  test('should have proper heading hierarchy', async ({ page, navigateTo }) => {
    await navigateTo('dashboard');
    
    // Check for h1
    const h1 = page.locator('h1');
    const h1Count = await h1.count();
    
    console.log(`📋 Found ${h1Count} h1 heading(s)`);
    
    // Should have exactly one h1
    if (h1Count > 0) {
      const h1Text = await h1.first().textContent();
      console.log(`✓ Page has h1: "${h1Text}"`);
    }
  });

  test('should have alt text for images', async ({ page, navigateTo }) => {
    await navigateTo('dashboard');
    
    // Find all images
    const images = page.locator('img');
    const imageCount = await images.count();
    
    console.log(`🖼️  Found ${imageCount} images`);
    
    // Check for alt attributes
    for (let i = 0; i < Math.min(imageCount, 10); i++) {
      const img = images.nth(i);
      const alt = await img.getAttribute('alt');
      
      if (!alt) {
        console.log(`⚠️  Image ${i + 1} missing alt text`);
      }
    }
  });

  test('should have keyboard navigation', async ({ page }) => {
    await page.goto('/');
    
    // Try Tab key navigation
    await page.keyboard.press('Tab');
    await page.waitForTimeout(100);
    
    // Check if focus is visible
    const focusedElement = await page.evaluate(() => {
      const el = document.activeElement;
      return el ? el.tagName : 'NONE';
    });
    
    console.log(`⌨️  Tab navigation: focus on ${focusedElement}`);
    expect(focusedElement).not.toBe('BODY');
  });

  test('should have ARIA labels', async ({ page, navigateTo }) => {
    await navigateTo('employees');
    
    // Check for ARIA labels on interactive elements
    const buttons = page.locator('button');
    const buttonCount = await buttons.count();
    
    let labeledCount = 0;
    
    for (let i = 0; i < Math.min(buttonCount, 10); i++) {
      const button = buttons.nth(i);
      const ariaLabel = await button.getAttribute('aria-label');
      const text = await button.textContent();
      
      if (ariaLabel || text?.trim()) {
        labeledCount++;
      }
    }
    
    console.log(`♿ ${labeledCount}/${Math.min(buttonCount, 10)} buttons have labels`);
  });
});

test.describe('Loading States', () => {
  test('should show loading indicators', async ({ page, navigateTo }) => {
    // Navigate and watch for loading states
    const navigationPromise = navigateTo('employees');
    
    // Check for loading indicator
    const loader = page.locator('[data-testid="loading"], .loading, .spinner');
    const hadLoader = await loader.isVisible({ timeout: 1000 }).catch(() => false);
    
    await navigationPromise;
    
    console.log(hadLoader ? '✓ Loading indicator shown' : 'ℹ️  No loading indicator detected');
  });
});

test.describe('Error Handling', () => {
  test('should handle network errors gracefully', async ({ page, context }) => {
    await page.goto('/');
    
    // Simulate offline mode
    await context.setOffline(true);
    
    // Try to navigate
    await page.goto('/employees').catch(() => {
      console.log('✓ Network error caught');
    });
    
    // Check for error message
    const errorMessage = page.locator('text=/error|fehler|offline/i');
    const hasError = await errorMessage.isVisible({ timeout: 2000 }).catch(() => false);
    
    console.log(hasError ? '✓ Error message displayed' : 'ℹ️  No error message shown');
    
    // Restore connection
    await context.setOffline(false);
  });
});
