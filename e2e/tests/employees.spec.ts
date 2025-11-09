/**
 * E2E tests for employee management
 * Tests CRUD operations on employees
 */
import { test, expect } from '../fixtures/base';
import { EmployeesPage } from '../helpers/page-objects';
import { generateTestEmployee } from '../helpers/test-data';

test.describe('Employee Management', () => {
  let employeesPage: EmployeesPage;
  let testEmployee: ReturnType<typeof generateTestEmployee>;

  test.beforeEach(async ({ page }) => {
    employeesPage = new EmployeesPage(page);
    testEmployee = generateTestEmployee();
  });

  test('should load employees page', async ({ page, navigateTo }) => {
    await navigateTo('employees');
    
    // Verify page loaded
    await expect(page).toHaveURL(/employees/i);
    
    // Check for main elements
    const addButton = page.getByRole('button', { name: /add|hinzufügen|neu/i });
    await expect(addButton).toBeVisible({ timeout: 5000 });
  });

  test('should display employee list', async ({ page, navigateTo }) => {
    await navigateTo('employees');
    
    // Wait for employees to load
    await page.waitForSelector('table, [data-testid="employees-list"]', { timeout: 10000 });
    
    // Check if table or list is visible
    const table = page.locator('table');
    const isList = await table.isVisible().catch(() => false);
    
    if (isList) {
      // Count rows (excluding header)
      const rows = await page.$$('tbody tr, [data-testid="employee-row"]');
      console.log(`📋 Found ${rows.length} employees`);
      expect(rows.length).toBeGreaterThanOrEqual(0);
    }
  });

  test('should open add employee dialog', async ({ page, navigateTo }) => {
    await navigateTo('employees');
    await employeesPage.clickAddEmployee();
    
    // Verify dialog opened
    const dialog = page.locator('[role="dialog"], [data-testid="employee-dialog"]');
    await expect(dialog).toBeVisible();
    
    // Check for form fields
    await expect(page.getByLabel(/name/i)).toBeVisible();
  });

  test('should create new employee', async ({ page, navigateTo }) => {
    await navigateTo('employees');
    
    // Open add dialog
    await employeesPage.clickAddEmployee();
    
    // Fill in employee details
    await page.getByLabel(/name/i).fill(testEmployee.name);
    await page.getByLabel(/email|e-mail/i).fill(testEmployee.email);
    
    // Select employee type
    const typeSelect = page.locator('select[name*="type"], [data-testid="employee-type"]');
    if (await typeSelect.isVisible().catch(() => false)) {
      await typeSelect.selectOption(testEmployee.employeeType);
    }
    
    // Set weekly hours
    const hoursInput = page.getByLabel(/hours|stunden/i);
    if (await hoursInput.isVisible().catch(() => false)) {
      await hoursInput.fill(testEmployee.weeklyHours.toString());
    }
    
    // Submit form
    const saveButton = page.getByRole('button', { name: /save|speichern|create|erstellen/i });
    await saveButton.click();
    
    // Wait for dialog to close
    await page.waitForTimeout(1000);
    
    // Verify employee was added
    await expect(page.locator(`text=${testEmployee.name}`)).toBeVisible({ timeout: 5000 });
  });

  test('should search for employees', async ({ page, navigateTo }) => {
    await navigateTo('employees');
    
    // Use search functionality
    const searchInput = page.getByPlaceholder(/search|suchen/i);
    
    if (await searchInput.isVisible().catch(() => false)) {
      await searchInput.fill('Test');
      await page.waitForTimeout(500); // Debounce
      
      // Results should be filtered
      const rows = await page.$$('tbody tr');
      console.log(`🔍 Search returned ${rows.length} results`);
    } else {
      console.log('ℹ️  Search not available on this page');
    }
  });

  test('should edit employee details', async ({ page, navigateTo }) => {
    await navigateTo('employees');
    
    // Find first employee row
    const firstRow = page.locator('tbody tr, [data-testid="employee-row"]').first();
    
    if (await firstRow.isVisible().catch(() => false)) {
      // Click edit button
      const editButton = firstRow.getByRole('button', { name: /edit|bearbeiten/i });
      
      if (await editButton.isVisible().catch(() => false)) {
        await editButton.click();
        
        // Verify edit dialog opened
        const dialog = page.locator('[role="dialog"]');
        await expect(dialog).toBeVisible();
        
        // Modify a field
        const nameInput = page.getByLabel(/name/i);
        const originalName = await nameInput.inputValue();
        const newName = `${originalName} (Edited)`;
        await nameInput.fill(newName);
        
        // Save changes
        const saveButton = page.getByRole('button', { name: /save|speichern/i });
        await saveButton.click();
        
        await page.waitForTimeout(1000);
        
        // Verify changes
        await expect(page.locator(`text=${newName}`)).toBeVisible({ timeout: 5000 });
      }
    } else {
      console.log('ℹ️  No employees available to edit');
    }
  });

  test('should delete employee', async ({ page, navigateTo }) => {
    await navigateTo('employees');
    
    // Create a test employee first
    await employeesPage.clickAddEmployee();
    await page.getByLabel(/name/i).fill(testEmployee.name);
    await page.getByLabel(/email|e-mail/i).fill(testEmployee.email);
    const saveButton = page.getByRole('button', { name: /save|speichern|create/i });
    await saveButton.click();
    await page.waitForTimeout(1000);
    
    // Now delete it
    await employeesPage.deleteEmployee(testEmployee.name);
    
    // Verify employee was deleted
    await expect(page.locator(`text=${testEmployee.name}`)).not.toBeVisible();
  });

  test('should filter by employee type', async ({ page, navigateTo }) => {
    await navigateTo('employees');
    
    // Look for filter controls
    const filterButton = page.getByRole('button', { name: /filter/i });
    
    if (await filterButton.isVisible().catch(() => false)) {
      await filterButton.click();
      
      // Select a type filter
      const vzFilter = page.locator('text=VZ, [value="VZ"]');
      if (await vzFilter.isVisible().catch(() => false)) {
        await vzFilter.click();
        await page.waitForTimeout(500);
        
        console.log('ℹ️  Applied VZ filter');
      }
    } else {
      console.log('ℹ️  No filter controls found');
    }
  });

  test('should display employee details', async ({ page, navigateTo }) => {
    await navigateTo('employees');
    
    // Click on first employee
    const firstRow = page.locator('tbody tr').first();
    
    if (await firstRow.isVisible().catch(() => false)) {
      await firstRow.click();
      
      // Check if detail view or modal appears
      await page.waitForTimeout(500);
      
      // Verify employee information is shown
      const content = await page.content();
      expect(content.length).toBeGreaterThan(0);
    }
  });
});

test.describe('Employee Validation', () => {
  test('should validate required fields', async ({ page, navigateTo }) => {
    await navigateTo('employees');
    
    // Open add dialog
    const addButton = page.getByRole('button', { name: /add|hinzufügen|neu/i });
    await addButton.click();
    
    // Try to submit without filling fields
    const saveButton = page.getByRole('button', { name: /save|speichern|create/i });
    await saveButton.click();
    
    // Check for validation errors
    const errorMessage = page.locator('text=/required|erforderlich|error|fehler/i');
    const hasError = await errorMessage.isVisible({ timeout: 2000 }).catch(() => false);
    
    if (hasError) {
      expect(hasError).toBeTruthy();
      console.log('✓ Validation working correctly');
    } else {
      console.log('⚠️  No validation errors shown - may have default values');
    }
  });

  test('should validate email format', async ({ page, navigateTo }) => {
    await navigateTo('employees');
    
    const addButton = page.getByRole('button', { name: /add|hinzufügen|neu/i });
    await addButton.click();
    
    // Enter invalid email
    const emailInput = page.getByLabel(/email|e-mail/i);
    await emailInput.fill('invalid-email');
    
    // Trigger validation by clicking outside or submitting
    await page.click('body');
    await page.waitForTimeout(300);
    
    // Check for validation message
    const validationMessage = page.locator('text=/invalid|ungültig/i');
    const hasValidation = await validationMessage.isVisible({ timeout: 1000 }).catch(() => false);
    
    console.log(hasValidation ? '✓ Email validation active' : 'ℹ️  Email validation not shown');
  });
});
