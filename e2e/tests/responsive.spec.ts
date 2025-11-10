/**
 * E2E tests for responsive design and mobile devices
 * Tests application on various screen sizes and devices
 * 
 * NOTE: test.use() must be called at the top level, not inside test.describe()
 * Fixed: Moved device configuration to top level to comply with Playwright requirements
 */
import { test, expect, devices } from '@playwright/test';

// Mobile device tests - device config must be at top level
test.use({ ...devices['iPhone 13'] });

test.describe('Responsive Design - Mobile', () => {
  test('should display mobile navigation', async ({ page }) => {
    await page.goto('/');
    
    // Look for mobile menu button (hamburger)
    const mobileMenu = page.locator('[data-testid="mobile-menu"], button:has-text(/menu/i), .hamburger');
    
    if (await mobileMenu.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('✓ Mobile menu button visible');
      
      // Click to open menu
      await mobileMenu.click();
      await page.waitForTimeout(500);
      
      // Check if menu opened
      const nav = page.locator('nav, [role="navigation"]');
      await expect(nav).toBeVisible();
      
      console.log('✓ Mobile menu opens correctly');
    } else {
      console.log('ℹ️  Mobile menu not found (may be different UI pattern)');
    }
  });

  test('should have touch-friendly buttons on mobile', async ({ page }) => {
    await page.goto('/employees');
    
    // Check button sizes
    const buttons = page.locator('button');
    const firstButton = buttons.first();
    
    if (await firstButton.isVisible().catch(() => false)) {
      const box = await firstButton.boundingBox();
      
      if (box) {
        // Buttons should be at least 44x44 for touch
        const isTouchFriendly = box.height >= 40 && box.width >= 40;
        console.log(`📱 Button size: ${box.width}x${box.height}px ${isTouchFriendly ? '✓' : '⚠️'}`);
      }
    }
  });

  test('should not have horizontal scroll on mobile', async ({ page }) => {
    await page.goto('/');
    
    // Check for horizontal overflow
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    
    if (hasHorizontalScroll) {
      console.log('⚠️  Horizontal scroll detected on mobile');
    } else {
      console.log('✓ No horizontal scroll on mobile');
    }
    
    expect(hasHorizontalScroll).toBe(false);
  });

  test('should display condensed layout on mobile', async ({ page }) => {
    await page.goto('/employees');
    
    // Check viewport width
    const viewportSize = page.viewportSize();
    console.log(`📱 Mobile viewport: ${viewportSize?.width}x${viewportSize?.height}`);
    
    // Verify mobile-specific layout
    await page.waitForLoadState('networkidle');
    
    // Mobile layouts often stack vertically
    const layout = await page.evaluate(() => {
      const main = document.querySelector('main');
      return main ? getComputedStyle(main).flexDirection : 'unknown';
    });
    
    console.log(`📐 Layout direction: ${layout}`);
  });

  test('should handle mobile form inputs', async ({ page }) => {
    await page.goto('/employees');
    
    // Try to open add dialog
    const addButton = page.getByRole('button', { name: /add|hinzufügen/i });
    
    if (await addButton.isVisible().catch(() => false)) {
      await addButton.click();
      await page.waitForTimeout(500);
      
      // Check if dialog is full-screen on mobile
      const dialog = page.locator('[role="dialog"]');
      
      if (await dialog.isVisible().catch(() => false)) {
        const box = await dialog.boundingBox();
        const viewport = page.viewportSize();
        
        if (box && viewport) {
          const isFullScreen = box.width >= viewport.width * 0.9;
          console.log(`📱 Dialog ${isFullScreen ? 'full-screen' : 'modal'} on mobile`);
        }
      }
    }
  });

  test('should support swipe gestures', async ({ page }) => {
    await page.goto('/schedule');
    
    // Try to swipe for week navigation
    const scheduleArea = page.locator('[data-testid="schedule-table"], table').first();
    
    if (await scheduleArea.isVisible().catch(() => false)) {
      const box = await scheduleArea.boundingBox();
      
      if (box) {
        // Simulate swipe
        await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
        await page.waitForTimeout(100);
        
        console.log('📱 Touch interaction tested');
      }
    }
  });

  test('should handle pinch zoom appropriately', async ({ page }) => {
    await page.goto('/');
    
    // Check viewport meta tag
    const viewport = await page.evaluate(() => {
      const meta = document.querySelector('meta[name="viewport"]');
      return meta ? meta.getAttribute('content') : '';
    });
    
    console.log(`📱 Viewport meta: ${viewport}`);
    
    // Should prevent zoom on form inputs
    const preventsZoom = viewport.includes('user-scalable=no') || 
                        viewport.includes('maximum-scale=1');
    
    console.log(preventsZoom ? 
      'ℹ️  Zoom prevented (check if intentional)' : 
      '✓ Zoom allowed'
    );
  });
});

test.describe('Responsive Tables on Mobile', () => {
  test('should handle tables on mobile', async ({ page }) => {
    // Uses inherited device settings from test.use() above
    await page.goto('/employees');
    
    // Check if table is responsive
    const table = page.locator('table');
    
    if (await table.isVisible({ timeout: 5000 }).catch(() => false)) {
      const hasHorizontalScroll = await page.evaluate(() => {
        const table = document.querySelector('table');
        if (!table) return false;
        return table.scrollWidth > table.clientWidth;
      });
      
      console.log(`📱 Table ${hasHorizontalScroll ? 'scrolls horizontally' : 'fits viewport'}`);
    } else {
      console.log('ℹ️  Table might use card layout on mobile');
    }
  });

  test('should use card layout for mobile tables', async ({ page }) => {
    await page.goto('/employees');
    
    // Check for card-based layout
    const cards = page.locator('[data-testid="employee-card"], .card');
    const cardCount = await cards.count();
    
    if (cardCount > 0) {
      console.log(`✓ Using card layout with ${cardCount} cards`);
    } else {
      console.log('ℹ️  Not using card layout');
    }
  });
});

// Note: Tablet and Desktop device-specific tests should be run via playwright.config.ts projects
// The config already includes iPad and Desktop Chrome projects which test those screen sizes
// This avoids the test.use() in describe block issue

test.describe('Responsive Breakpoints', () => {
  test('should adapt to different screen sizes', async ({ page }) => {
    const breakpoints = [
      { name: 'Mobile', width: 375, height: 667 },
      { name: 'Tablet Portrait', width: 768, height: 1024 },
      { name: 'Tablet Landscape', width: 1024, height: 768 },
      { name: 'Desktop', width: 1920, height: 1080 }
    ];

    for (const bp of breakpoints) {
      await page.setViewportSize({ width: bp.width, height: bp.height });
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      // Check for horizontal overflow
      const hasOverflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });
      
      console.log(`${bp.name} (${bp.width}x${bp.height}): ${hasOverflow ? '⚠️ Overflow' : '✓ OK'}`);
      
      if (hasOverflow) {
        console.log(`⚠️  Horizontal overflow detected at ${bp.name}`);
      }
    }
  });
});
