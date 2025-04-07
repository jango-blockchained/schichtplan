import { test, expect } from '@playwright/test';

test('has title', async ({ page }) => {
  // Navigate to the base URL defined in playwright.config.ts
  await page.goto('/');

  // Expect a title "to contain" a substring.
  // Replace 'Schichtplan' with the actual expected title or a substring of it.
  await expect(page).toHaveTitle(/Schichtplan/);
});

// Test the login flow
test('should allow user to login', async ({ page }) => {
  await page.goto('/');

  // --- Replace with actual selectors and credentials ---
  const username = 'testuser'; // Replace with a valid test username
  const password = 'password'; // Replace with the corresponding password
  const usernameLabel = 'Username'; // Replace if your label is different (e.g., 'Email')
  const passwordLabel = 'Password'; // Replace if your label is different
  const loginButtonName = /Login|Sign in/i; // Regex to match 'Login' or 'Sign in', case-insensitive
  const expectedUrlAfterLogin = /.*dashboard/; // Regex to match a URL containing 'dashboard'
  // --- End of values you might need to adjust ---

  // Find the username input by its label and fill it
  await page.getByLabel(usernameLabel).fill(username);

  // Find the password input by its label and fill it
  await page.getByLabel(passwordLabel).fill(password);

  // Find the login button by its role and name (using regex) and click it
  await page.getByRole('button', { name: loginButtonName }).click();

  // Assert that the URL changes to the expected pattern after successful login
  // Wait for navigation to complete before checking the URL
  await page.waitForURL(expectedUrlAfterLogin);
  await expect(page).toHaveURL(expectedUrlAfterLogin);

  // Optional: Add further assertions, e.g., check for a welcome message
  // await expect(page.getByText(`Welcome, ${username}`)).toBeVisible();
});

// You can add more tests here, for example:
// test('should show error message for invalid login', async ({ page }) => { ... });
// test('should navigate to schedule page after login', async ({ page }) => { ... });
