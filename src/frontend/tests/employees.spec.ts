import { test, expect } from '@playwright/test';

test.describe('Employees Page Functionality', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the employees page before each test
    await page.goto('/employees');
  });

  test('employees page loads correctly', async ({ page }) => {
    // Verify main employees components are present
    await expect(page.getByRole('heading', { name: /employees/i })).toBeVisible();
    
    // Verify employees list/table is present
    await expect(page.locator('.employees-list')).toBeVisible();
  });

  test('add new employee functionality', async ({ page }) => {
    // Click add employee button
    const addButton = page.getByRole('button', { name: /add employee/i });
    await addButton.click();

    // Verify add employee form appears
    const employeeForm = page.locator('.employee-form');
    await expect(employeeForm).toBeVisible();

    // Fill out the form
    await page.getByLabel(/name/i).fill('John Doe');
    await page.getByLabel(/email/i).fill('john.doe@example.com');
    // Add more form fields based on your implementation

    // Submit the form
    await page.getByRole('button', { name: /save|submit/i }).click();

    // Verify new employee appears in the list
    await expect(page.getByText('John Doe')).toBeVisible();
  });

  test('edit employee functionality', async ({ page }) => {
    // Find and click edit button for first employee
    const editButton = page.locator('.employee-row').first().getByRole('button', { name: /edit/i });
    await editButton.click();

    // Verify edit form appears
    const editForm = page.locator('.employee-form');
    await expect(editForm).toBeVisible();

    // Update employee information
    await page.getByLabel(/name/i).fill('Jane Smith');
    
    // Save changes
    await page.getByRole('button', { name: /save|update/i }).click();

    // Verify changes are reflected
    await expect(page.getByText('Jane Smith')).toBeVisible();
  });

  test('delete employee functionality', async ({ page }) => {
    // Store initial employee count
    const initialCount = await page.locator('.employee-row').count();

    // Find and click delete button for first employee
    const deleteButton = page.locator('.employee-row').first().getByRole('button', { name: /delete/i });
    await deleteButton.click();

    // Verify confirmation dialog appears
    const confirmDialog = page.locator('.confirmation-dialog');
    await expect(confirmDialog).toBeVisible();

    // Confirm deletion
    await page.getByRole('button', { name: /confirm|yes/i }).click();

    // Verify employee count decreased
    await expect(page.locator('.employee-row')).toHaveCount(initialCount - 1);
  });

  test('employee search and filter functionality', async ({ page }) => {
    // Test search functionality
    const searchInput = page.getByRole('textbox', { name: /search/i });
    await searchInput.fill('John');

    // Verify filtered results
    await expect(page.locator('.employee-row')).toContainText('John');

    // Test other filters if present (e.g., department, status)
    const filterDropdown = page.getByRole('combobox', { name: /filter/i });
    if (await filterDropdown.isVisible()) {
      await filterDropdown.click();
      // Select a filter option
      // Verify filtered results
    }
  });

  test('employee data persistence', async ({ page }) => {
    // Make a change to employee data
    const editButton = page.locator('.employee-row').first().getByRole('button', { name: /edit/i });
    await editButton.click();
    await page.getByLabel(/name/i).fill('Test User');
    await page.getByRole('button', { name: /save|update/i }).click();

    // Refresh the page
    await page.reload();

    // Verify changes persist
    await expect(page.getByText('Test User')).toBeVisible();
  });
}); 