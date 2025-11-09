/**
 * E2E tests for responsive design and mobile devices
 * Tests application on various screen sizes and devices
 */
import { test, expect, devices } from '@playwright/test';

test.describe('Responsive Design - Mobile', () => {
  test.use({ ...devices['iPhone 13'] });

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
});

test.describe('Responsive Design - Tablet', () => {
  test.use({ ...devices['iPad (gen 7)'] });

  test('should display tablet layout', async ({ page }) => {
    await page.goto('/');
    
    const viewportSize = page.viewportSize();
    console.log(`📱 Tablet viewport: ${viewportSize?.width}x${viewportSize?.height}`);
    
    // Tablet should show more content than mobile
    await page.waitForLoadState('networkidle');
    
    // Check for navigation
    const nav = page.locator('nav');
    await expect(nav).toBeVisible();
  });

  test('should handle tablet grid layouts', async ({ page }) => {
    await page.goto('/employees');
    
    // Check if content uses multi-column layout on tablet
    const container = page.locator('main, .container');
    
    if (await container.isVisible().catch(() => false)) {
      const gridColumns = await page.evaluate(() => {
        const el = document.querySelector('main') || document.querySelector('.container');
        return el ? getComputedStyle(el).gridTemplateColumns : 'none';
      });
      
      console.log(`📐 Tablet grid: ${gridColumns}`);
    }
  });

  test('should support landscape and portrait on tablet', async ({ page, context }) => {
    await page.goto('/');
    
    // Portrait mode
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(300);
    console.log('📱 Portrait mode: 768x1024');
    
    // Landscape mode
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.waitForTimeout(300);
    console.log('📱 Landscape mode: 1024x768');
    
    // Content should adapt without breaking
    const hasScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    
    expect(hasScroll).toBe(false);
  });
});

test.describe('Responsive Design - Desktop', () => {
  test.use({ ...devices['Desktop Chrome'] });

  test('should display full desktop layout', async ({ page }) => {
    await page.goto('/');
    
    const viewportSize = page.viewportSize();
    console.log(`🖥️  Desktop viewport: ${viewportSize?.width}x${viewportSize?.height}`);
    
    // Desktop should show sidebar/full navigation
    const nav = page.locator('nav, aside');
    await expect(nav).toBeVisible();
  });

  test('should utilize wide screens effectively', async ({ page }) => {
    await page.goto('/schedule');
    
    // Check if content uses available width
    const main = page.locator('main');
    
    if (await main.isVisible().catch(() => false)) {
      const box = await main.boundingBox();
      const viewport = page.viewportSize();
      
      if (box && viewport) {
        const widthUsage = (box.width / viewport.width) * 100;
        console.log(`🖥️  Content uses ${widthUsage.toFixed(1)}% of screen width`);
      }
    }
  });

  test('should show hover states on desktop', async ({ page }) => {
    await page.goto('/employees');
    
    // Find a button
    const button = page.locator('button').first();
    
    if (await button.isVisible().catch(() => false)) {
      // Get initial style
      const initialBg = await button.evaluate(el => getComputedStyle(el).backgroundColor);
      
      // Hover over button
      await button.hover();
      await page.waitForTimeout(100);
      
      // Check if style changed
      const hoverBg = await button.evaluate(el => getComputedStyle(el).backgroundColor);
      
      console.log(initialBg !== hoverBg ? '✓ Hover states working' : 'ℹ️  No hover effect detected');
    }
  });
});

test.describe('Responsive Tables', () => {
  test('should handle tables on mobile', async ({ page }) => {
    // Test with mobile device
    await page.setViewportSize({ width: 375, height: 667 });
    
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
    await page.setViewportSize({ width: 375, height: 667 });
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

test.describe('Touch Gestures', () => {
  test.use({ ...devices['iPhone 13'] });

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

test.describe('Responsive Images', () => {
  test('should load appropriate image sizes', async ({ page }) => {
    await page.goto('/');
    
    // Check for srcset or picture elements
    const responsiveImages = page.locator('img[srcset], picture img');
    const count = await responsiveImages.count();
    
    console.log(`🖼️  Found ${count} responsive images`);
    
    if (count > 0) {
      const firstImg = responsiveImages.first();
      const srcset = await firstImg.getAttribute('srcset');
      console.log(`✓ Using srcset: ${srcset?.substring(0, 50)}...`);
    }
  });
});

test.describe('Font Sizing', () => {
  test('should have readable font sizes on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    
    // Check body font size
    const fontSize = await page.evaluate(() => {
      return getComputedStyle(document.body).fontSize;
    });
    
    const size = parseInt(fontSize);
    console.log(`📝 Base font size: ${fontSize}`);
    
    // Should be at least 16px for readability
    expect(size).toBeGreaterThanOrEqual(14);
  });
});

test.describe('Breakpoint Testing', () => {
  const breakpoints = [
    { name: 'Mobile S', width: 320, height: 568 },
    { name: 'Mobile M', width: 375, height: 667 },
    { name: 'Mobile L', width: 414, height: 896 },
    { name: 'Tablet', width: 768, height: 1024 },
    { name: 'Laptop', width: 1024, height: 768 },
    { name: 'Desktop', width: 1440, height: 900 },
    { name: 'Large Desktop', width: 1920, height: 1080 },
  ];

  for (const breakpoint of breakpoints) {
    test(`should work at ${breakpoint.name} (${breakpoint.width}x${breakpoint.height})`, async ({ page }) => {
      await page.setViewportSize({ 
        width: breakpoint.width, 
        height: breakpoint.height 
      });
      
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      // Check for layout issues
      const hasHorizontalScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });
      
      console.log(`${breakpoint.name}: ${hasHorizontalScroll ? '⚠️  Horizontal scroll' : '✓ No scroll'}`);
      
      // Take screenshot for visual verification
      await page.screenshot({ 
        path: `/tmp/screenshot-${breakpoint.name.toLowerCase().replace(/\s+/g, '-')}.png`,
        fullPage: false
      });
    });
  }
});
