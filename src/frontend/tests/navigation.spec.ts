import { test, expect } from '@playwright/test';

test.describe('Navigation and Basic Functionality', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the application before each test
    await page.goto('/');
  });

  test('should navigate through all main routes', async ({ page }) => {
    // Verify we start at schedule page (index route)
    await expect(page).toHaveURL('/');
    await expect(page.getByRole('heading', { name: /schedule/i })).toBeVisible();

    // Test navigation to Shifts page
    await page.getByRole('link', { name: /shifts/i }).click();
    await expect(page).toHaveURL('/shifts');
    await expect(page.getByRole('heading', { name: /shifts/i })).toBeVisible();

    // Test navigation to Coverage page
    await page.getByRole('link', { name: /coverage/i }).click();
    await expect(page).toHaveURL('/coverage');
    await expect(page.getByRole('heading', { name: /coverage/i })).toBeVisible();

    // Test navigation to Employees page
    await page.getByRole('link', { name: /employees/i }).click();
    await expect(page).toHaveURL('/employees');
    await expect(page.getByRole('heading', { name: /employees/i })).toBeVisible();

    // Test navigation to Settings page
    await page.getByRole('link', { name: /settings/i }).click();
    await expect(page).toHaveURL('/settings');
    await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible();
  });

  test('theme toggle functionality', async ({ page }) => {
    // Check initial theme
    await expect(page.locator('html')).toHaveAttribute('class', /light|dark/);

    // Find and click theme toggle button
    const themeToggle = page.getByRole('button', { name: /toggle theme/i });
    await themeToggle.click();

    // Verify theme changed
    const currentTheme = await page.locator('html').getAttribute('class');
    await expect(page.locator('html')).toHaveAttribute('class', currentTheme === 'dark' ? 'light' : 'dark');
  });

  test('toaster notifications', async ({ page }) => {
    // Navigate to a page that would trigger a notification (e.g., settings)
    await page.goto('/settings');

    // Attempt an action that would trigger a notification
    // This is a placeholder - adjust based on actual functionality
    const saveButton = page.getByRole('button', { name: /save/i });
    if (await saveButton.isVisible()) {
      await saveButton.click();
      // Verify toaster appears
      await expect(page.locator('.toaster')).toBeVisible();
    }
  });
}); 