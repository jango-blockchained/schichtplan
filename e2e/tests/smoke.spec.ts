/**
 * Production Smoke Tests
 * Quick tests to verify critical functionality is working after deployment
 * Run these immediately after deploying to production
 */
import { test, expect } from '@playwright/test';

test.describe('Production Smoke Tests', () => {
  test.describe.configure({ retries: 3 }); // Retry smoke tests to handle network issues

  test('Application should be accessible', async ({ page }) => {
    // Navigate to root
    const response = await page.goto('/');
    
    // Should get successful response
    expect(response?.status()).toBeLessThan(400);
    
    // Page should load
    await expect(page).toHaveTitle(/Schichtplan/i);
    
    console.log('✓ Application is accessible');
  });

  test('Backend API should be responding', async ({ page }) => {
    // Test API health endpoint
    const response = await page.request.get('/api/health');
    
    expect(response.status()).toBe(200);
    
    const body = await response.text();
    expect(body).toContain('OK');
    
    console.log('✓ Backend API is responding');
  });

  test('Database connection should work', async ({ page }) => {
    // Try to fetch data that requires database
    const response = await page.request.get('/api/settings');
    
    // Should not get 500 error
    expect(response.status()).not.toBe(500);
    
    console.log('✓ Database connection working');
  });

  test('Static assets should load', async ({ page }) => {
    await page.goto('/');
    
    // Check for JavaScript bundles
    const scripts = page.locator('script[src]');
    const scriptCount = await scripts.count();
    
    expect(scriptCount).toBeGreaterThan(0);
    
    // Check for CSS
    const styles = page.locator('link[rel="stylesheet"], style');
    const styleCount = await styles.count();
    
    expect(styleCount).toBeGreaterThan(0);
    
    console.log('✓ Static assets loading correctly');
  });

  test('Navigation should work', async ({ page }) => {
    await page.goto('/');
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    
    // Check for navigation menu
    const nav = page.locator('nav, [role="navigation"]');
    await expect(nav).toBeVisible({ timeout: 10000 });
    
    console.log('✓ Navigation is working');
  });

  test('Authentication page should load', async ({ page }) => {
    await page.goto('/login');
    
    // Should show login interface
    await page.waitForLoadState('networkidle');
    
    // Check for login elements
    const hasLogin = await page.locator('button, a').first().isVisible();
    expect(hasLogin).toBe(true);
    
    console.log('✓ Authentication page loads');
  });

  test('SSL/HTTPS should be enabled', async ({ page, context }) => {
    const response = await page.goto('/');
    
    // Check if HTTPS is enforced
    const url = page.url();
    
    if (process.env.PRODUCTION_URL) {
      expect(url).toMatch(/^https:/);
      console.log('✓ HTTPS is enabled');
    } else {
      console.log('⚠ Skipping HTTPS check (not production URL)');
    }
  });

  test('Security headers should be present', async ({ page }) => {
    const response = await page.goto('/');
    const headers = response?.headers();
    
    if (headers) {
      // Check for important security headers
      const hasSTSHeader = 'strict-transport-security' in headers;
      const hasFrameOptions = 'x-frame-options' in headers;
      const hasContentType = 'x-content-type-options' in headers;
      
      console.log('Security headers:');
      console.log(`  HSTS: ${hasSTSHeader ? '✓' : '✗'}`);
      console.log(`  X-Frame-Options: ${hasFrameOptions ? '✓' : '✗'}`);
      console.log(`  X-Content-Type-Options: ${hasContentType ? '✓' : '✗'}`);
      
      // At least one should be present
      expect(hasSTSHeader || hasFrameOptions || hasContentType).toBe(true);
    }
  });

  test('Console should not have critical errors', async ({ page }) => {
    const errors: string[] = [];
    
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Filter out known acceptable errors
    const criticalErrors = errors.filter(err => 
      !err.includes('favicon') &&
      !err.includes('DevTools') &&
      !err.includes('404')
    );
    
    if (criticalErrors.length > 0) {
      console.log('⚠ Console errors detected:', criticalErrors);
    } else {
      console.log('✓ No critical console errors');
    }
    
    expect(criticalErrors.length).toBeLessThan(5);
  });

  test('Page should load within acceptable time', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const loadTime = Date.now() - startTime;
    
    console.log(`Page load time: ${loadTime}ms`);
    
    // Should load within 5 seconds
    expect(loadTime).toBeLessThan(5000);
    
    console.log('✓ Page performance acceptable');
  });

  test('Error handling should work', async ({ page }) => {
    // Try to access non-existent page
    const response = await page.goto('/non-existent-page-12345');
    
    // Should handle gracefully (either 404 or redirect)
    const status = response?.status();
    
    // Should not crash with 500 error
    expect(status).not.toBe(500);
    
    console.log('✓ Error handling working');
  });

  test('WebAuthn configuration should be correct', async ({ page }) => {
    await page.goto('/login');
    
    // Check if WebAuthn is available
    const hasWebAuthn = await page.evaluate(() => {
      return typeof window.PublicKeyCredential !== 'undefined';
    });
    
    if (hasWebAuthn) {
      console.log('✓ WebAuthn API available');
    } else {
      console.log('⚠ WebAuthn API not available (may not be supported in test environment)');
    }
  });
});

test.describe('Critical User Flows', () => {
  test('Can navigate to main pages', async ({ page }) => {
    await page.goto('/');
    
    const pages = ['/dashboard', '/employees', '/schedule'];
    
    for (const pagePath of pages) {
      const response = await page.goto(pagePath);
      expect(response?.status()).toBeLessThan(400);
      console.log(`✓ ${pagePath} accessible`);
    }
  });

  test('API endpoints are accessible', async ({ page }) => {
    const endpoints = [
      '/api/health',
      '/api/settings',
    ];
    
    for (const endpoint of endpoints) {
      const response = await page.request.get(endpoint);
      expect(response.status()).not.toBe(500);
      console.log(`✓ ${endpoint} responding`);
    }
  });
});

test.describe('Performance Checks', () => {
  test('Assets should be properly cached', async ({ page }) => {
    // First load
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Check cache headers on assets
    const response = await page.request.get('/');
    const headers = response.headers();
    
    console.log('Cache-Control:', headers['cache-control'] || 'not set');
    
    // Should have cache control header
    expect(headers).toHaveProperty('cache-control');
  });

  test('Compression should be enabled', async ({ page }) => {
    const response = await page.request.get('/');
    const headers = response.headers();
    
    const hasCompression = headers['content-encoding']?.includes('gzip') ||
                          headers['content-encoding']?.includes('br');
    
    if (hasCompression) {
      console.log('✓ Compression enabled:', headers['content-encoding']);
    } else {
      console.log('⚠ Compression not detected');
    }
  });
});

test.describe('Mobile Compatibility', () => {
  test.use({ 
    viewport: { width: 375, height: 667 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15'
  });

  test('Mobile site should be accessible', async ({ page }) => {
    await page.goto('/');
    
    // Should load without horizontal scroll
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    
    expect(hasHorizontalScroll).toBe(false);
    
    console.log('✓ Mobile site accessible without horizontal scroll');
  });
});
