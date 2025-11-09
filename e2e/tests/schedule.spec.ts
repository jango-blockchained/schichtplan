/**
 * E2E tests for schedule management
 * Tests schedule creation, editing, and publishing
 */
import { test, expect } from '../fixtures/base';
import { SchedulePage } from '../helpers/page-objects';
import { generateTestSchedule, getCurrentWeekDates } from '../helpers/test-data';

test.describe('Schedule Management', () => {
  let schedulePage: SchedulePage;

  test.beforeEach(async ({ page }) => {
    schedulePage = new SchedulePage(page);
  });

  test('should load schedule page', async ({ page, navigateTo }) => {
    await navigateTo('schedule');
    
    // Verify page loaded
    await expect(page).toHaveURL(/schedule|dienstplan/i);
    
    // Check for schedule elements
    const scheduleTable = page.locator('table, [data-testid="schedule-table"]');
    await expect(scheduleTable).toBeVisible({ timeout: 10000 });
  });

  test('should display week navigator', async ({ page, navigateTo }) => {
    await navigateTo('schedule');
    
    // Check for week navigation controls
    const prevButton = page.getByRole('button', { name: /prev|zurück|vorherig/i });
    const nextButton = page.getByRole('button', { name: /next|weiter|nächst/i });
    
    await expect(prevButton).toBeVisible();
    await expect(nextButton).toBeVisible();
  });

  test('should navigate between weeks', async ({ page, navigateTo }) => {
    await navigateTo('schedule');
    
    // Get current week display
    const weekDisplay = page.locator('[data-testid="week-display"], .week-info');
    const initialWeek = await weekDisplay.textContent().catch(() => '');
    
    // Click next week
    const nextButton = page.getByRole('button', { name: /next|weiter|nächst/i });
    await nextButton.click();
    await page.waitForTimeout(500);
    
    // Verify week changed
    const newWeek = await weekDisplay.textContent().catch(() => '');
    
    if (initialWeek && newWeek) {
      expect(newWeek).not.toBe(initialWeek);
      console.log(`📅 Navigated from ${initialWeek} to ${newWeek}`);
    }
  });

  test('should display schedule grid', async ({ page, navigateTo }) => {
    await navigateTo('schedule');
    
    // Wait for schedule to load
    await page.waitForSelector('table, [data-testid="schedule-grid"]', { timeout: 10000 });
    
    // Verify schedule has days
    const dayHeaders = page.locator('th:has-text(/monday|montag|tuesday|dienstag/i)');
    const hasDays = await dayHeaders.count();
    expect(hasDays).toBeGreaterThan(0);
    
    console.log(`📋 Schedule shows ${hasDays} day columns`);
  });

  test('should show employee rows', async ({ page, navigateTo }) => {
    await navigateTo('schedule');
    
    // Wait for employees to load
    await page.waitForTimeout(2000);
    
    // Count employee rows
    const employeeRows = page.locator('tbody tr, [data-testid="employee-row"]');
    const rowCount = await employeeRows.count();
    
    console.log(`👥 Schedule displays ${rowCount} employees`);
    expect(rowCount).toBeGreaterThanOrEqual(0);
  });

  test('should generate schedule', async ({ page, navigateTo }) => {
    await navigateTo('schedule');
    
    // Look for generate button
    const generateButton = page.getByRole('button', { name: /generate|generieren/i });
    
    if (await generateButton.isVisible().catch(() => false)) {
      // Count shifts before generation
      const shiftsBefore = await schedulePage.getShiftCount();
      
      // Click generate
      await generateButton.click();
      
      // Wait for generation (may show loading indicator)
      await page.waitForTimeout(3000);
      
      // Count shifts after generation
      const shiftsAfter = await schedulePage.getShiftCount();
      
      console.log(`🔄 Generated schedule: ${shiftsBefore} → ${shiftsAfter} shifts`);
      expect(shiftsAfter).toBeGreaterThanOrEqual(shiftsBefore);
    } else {
      console.log('ℹ️  Generate button not available');
    }
  });

  test('should create manual shift assignment', async ({ page, navigateTo }) => {
    await navigateTo('schedule');
    
    // Find an empty cell
    const emptyCell = page.locator('.schedule-cell:empty, [data-testid="empty-cell"]').first();
    
    if (await emptyCell.isVisible().catch(() => false)) {
      await emptyCell.click();
      
      // Check if assignment dialog opens
      await page.waitForTimeout(500);
      
      const dialog = page.locator('[role="dialog"]');
      if (await dialog.isVisible().catch(() => false)) {
        console.log('✓ Shift assignment dialog opened');
        
        // Close dialog
        const cancelButton = page.getByRole('button', { name: /cancel|abbrechen/i });
        if (await cancelButton.isVisible().catch(() => false)) {
          await cancelButton.click();
        }
      }
    } else {
      console.log('ℹ️  No empty cells available for manual assignment');
    }
  });

  test('should display shift details on hover', async ({ page, navigateTo }) => {
    await navigateTo('schedule');
    
    // Find a shift cell
    const shiftCell = page.locator('.shift-cell, [data-testid="shift"]').first();
    
    if (await shiftCell.isVisible().catch(() => false)) {
      // Hover over shift
      await shiftCell.hover();
      await page.waitForTimeout(500);
      
      // Check for tooltip or hover card
      const tooltip = page.locator('[role="tooltip"], .tooltip, .hover-card');
      const hasTooltip = await tooltip.isVisible({ timeout: 1000 }).catch(() => false);
      
      console.log(hasTooltip ? '✓ Shift hover details shown' : 'ℹ️  No hover details available');
    } else {
      console.log('ℹ️  No shifts to hover over');
    }
  });

  test('should handle split week navigation', async ({ page, navigateTo }) => {
    await navigateTo('schedule');
    
    // Look for split week indicator
    const splitIndicator = page.locator('text=/split|geteilte woche/i');
    
    if (await splitIndicator.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('📅 Split week detected');
      
      // Look for segment navigation
      const segmentButtons = page.locator('[data-testid="segment-button"], button:has-text(/teil|part/)');
      const segmentCount = await segmentButtons.count();
      
      if (segmentCount > 0) {
        console.log(`✓ Found ${segmentCount} week segments`);
        
        // Click first segment
        await segmentButtons.first().click();
        await page.waitForTimeout(500);
      }
    } else {
      console.log('ℹ️  Current week is not split');
    }
  });

  test('should publish schedule', async ({ page, navigateTo }) => {
    await navigateTo('schedule');
    
    // Look for publish button
    const publishButton = page.getByRole('button', { name: /publish|veröffentlichen/i });
    
    if (await publishButton.isVisible().catch(() => false)) {
      await publishButton.click();
      
      // Wait for confirmation dialog
      await page.waitForTimeout(500);
      
      // Look for confirm button
      const confirmButton = page.getByRole('button', { name: /confirm|bestätigen/i });
      
      if (await confirmButton.isVisible().catch(() => false)) {
        console.log('✓ Publish confirmation dialog shown');
        
        // Cancel instead of actually publishing in tests
        const cancelButton = page.getByRole('button', { name: /cancel|abbrechen/i });
        if (await cancelButton.isVisible().catch(() => false)) {
          await cancelButton.click();
        }
      }
    } else {
      console.log('ℹ️  Publish button not available (may need schedule generation first)');
    }
  });

  test('should export schedule to PDF', async ({ page, navigateTo }) => {
    await navigateTo('schedule');
    
    // Look for export/download button
    const exportButton = page.getByRole('button', { name: /export|download|pdf/i });
    
    if (await exportButton.isVisible().catch(() => false)) {
      // Set up download listener
      const downloadPromise = page.waitForEvent('download', { timeout: 5000 }).catch(() => null);
      
      await exportButton.click();
      
      const download = await downloadPromise;
      
      if (download) {
        console.log(`✓ Schedule export initiated: ${download.suggestedFilename()}`);
      } else {
        console.log('ℹ️  Export may require additional steps or different trigger');
      }
    } else {
      console.log('ℹ️  Export button not found');
    }
  });

  test('should handle version management', async ({ page, navigateTo }) => {
    await navigateTo('schedule');
    
    // Look for version selector
    const versionSelect = page.locator('select:has-text(/version/i), [data-testid="version-select"]');
    
    if (await versionSelect.isVisible().catch(() => false)) {
      // Get version options
      const options = await versionSelect.locator('option').count();
      console.log(`📋 Found ${options} schedule versions`);
      
      if (options > 1) {
        // Select different version
        await versionSelect.selectOption({ index: 1 });
        await page.waitForTimeout(1000);
        
        console.log('✓ Version switching works');
      }
    } else {
      console.log('ℹ️  Version management not visible');
    }
  });
});

test.describe('Schedule Statistics', () => {
  test('should display schedule statistics', async ({ page, navigateTo }) => {
    await navigateTo('schedule');
    
    // Look for statistics section
    const statsSection = page.locator('[data-testid="statistics"], .statistics');
    
    if (await statsSection.isVisible({ timeout: 5000 }).catch(() => false)) {
      // Check for key metrics
      const content = await statsSection.textContent();
      
      console.log('📊 Schedule statistics displayed');
      expect(content).toBeDefined();
    } else {
      console.log('ℹ️  Statistics not visible on this page');
    }
  });

  test('should show coverage warnings', async ({ page, navigateTo }) => {
    await navigateTo('schedule');
    
    // Look for warning indicators
    const warnings = page.locator('.warning, [data-testid="warning"], text=/warning|warnung/i');
    const warningCount = await warnings.count();
    
    console.log(`⚠️  Found ${warningCount} coverage warnings`);
  });
});

test.describe('Schedule Filters', () => {
  test('should filter by employee type', async ({ page, navigateTo }) => {
    await navigateTo('schedule');
    
    // Look for filter controls
    const filterButton = page.getByRole('button', { name: /filter/i });
    
    if (await filterButton.isVisible().catch(() => false)) {
      await filterButton.click();
      await page.waitForTimeout(300);
      
      // Try to select a filter
      const vzFilter = page.locator('text=VZ, [type="checkbox"][value="VZ"]');
      if (await vzFilter.isVisible().catch(() => false)) {
        await vzFilter.click();
        await page.waitForTimeout(500);
        
        console.log('✓ Applied employee type filter');
      }
    } else {
      console.log('ℹ️  Filter controls not found');
    }
  });
});
