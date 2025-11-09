# End-to-End Testing Guide

## Overview

Schichtplan uses Playwright for comprehensive end-to-end (E2E) testing across multiple browsers and devices. This guide covers setup, writing tests, running tests, and CI/CD integration.

## Quick Start

```bash
# Install dependencies
bun install
bunx playwright install --with-deps

# Run all E2E tests
npm run test:e2e

# Run tests in UI mode (interactive)
npm run test:e2e:ui

# Run tests in headed mode (watch tests execute)
npm run test:e2e:headed

# Run specific browser only
npm run test:e2e:chromium

# Run mobile tests only
npm run test:e2e:mobile

# Debug tests
npm run test:e2e:debug
```

## Test Structure

```
e2e/
├── fixtures/
│   └── base.ts              # Custom test fixtures
├── helpers/
│   ├── page-objects.ts      # Page Object Models
│   └── test-data.ts         # Test data generators
├── tests/
│   ├── auth.spec.ts         # Authentication tests
│   ├── employees.spec.ts    # Employee management tests
│   ├── schedule.spec.ts     # Schedule management tests
│   ├── navigation.spec.ts   # Navigation and UI tests
│   └── responsive.spec.ts   # Responsive design tests
├── global-setup.ts          # Global setup (runs once before all tests)
└── global-teardown.ts       # Global teardown (runs once after all tests)
```

## Writing Tests

### Basic Test Structure

```typescript
import { test, expect } from '../fixtures/base';

test.describe('Feature Name', () => {
  test('should perform action', async ({ page }) => {
    // Navigate
    await page.goto('/employees');
    
    // Interact
    await page.click('button:has-text("Add")');
    
    // Assert
    await expect(page.locator('[role="dialog"]')).toBeVisible();
  });
});
```

### Using Page Objects

```typescript
import { EmployeesPage } from '../helpers/page-objects';

test('should add employee', async ({ page }) => {
  const employeesPage = new EmployeesPage(page);
  
  await employeesPage.goto();
  await employeesPage.clickAddEmployee();
  
  // Fill form and submit...
});
```

### Using Custom Fixtures

```typescript
test('should navigate to page', async ({ page, navigateTo }) => {
  // Custom fixture from base.ts
  await navigateTo('employees');
  
  await expect(page).toHaveURL(/employees/);
});
```

### Generating Test Data

```typescript
import { generateTestEmployee } from '../helpers/test-data';

test('should create employee', async ({ page }) => {
  const employee = generateTestEmployee({
    name: 'John Doe',
    employeeType: 'VZ'
  });
  
  // Use employee data in test...
});
```

## Test Configuration

### Playwright Config

The `playwright.config.ts` file configures:

- **Test directory**: `./e2e`
- **Browsers**: Chromium, Firefox, WebKit
- **Devices**: Desktop, Mobile (iPhone, Pixel), Tablet (iPad)
- **Reporters**: HTML, JSON, JUnit
- **Retries**: 2 retries on CI, 0 locally
- **Timeouts**: 60s per test, 15min total

### Environment Variables

```bash
# Base URL for tests
PLAYWRIGHT_BASE_URL=http://localhost:5173

# Run in CI mode
CI=true
```

## Running Tests

### Local Development

```bash
# Start application first
./start.sh

# In another terminal, run tests
npm run test:e2e
```

### Specific Test Files

```bash
# Run single test file
npx playwright test e2e/tests/auth.spec.ts

# Run tests matching pattern
npx playwright test --grep "employee"

# Run specific test
npx playwright test -g "should create employee"
```

### Browser Selection

```bash
# Run in specific browser
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit

# Run mobile tests
npx playwright test --project="Mobile Chrome"
npx playwright test --project="iPhone 13"
```

### Debug Mode

```bash
# Debug mode (step through tests)
npm run test:e2e:debug

# Debug specific test
npx playwright test --debug e2e/tests/auth.spec.ts

# Pause on failure
npx playwright test --pause-on-failure
```

### UI Mode (Interactive)

```bash
# Open Playwright UI
npm run test:e2e:ui

# Features:
# - Watch mode
# - Time travel debugging
# - Network inspection
# - Console logs
```

## Test Reports

### Viewing Reports

```bash
# Generate and open HTML report
npm run test:e2e:report

# Report shows:
# - Test results by browser
# - Screenshots on failure
# - Video recordings
# - Network activity
# - Console logs
```

### Report Artifacts

After test run, artifacts are saved in:

- `playwright-report/` - HTML report
- `playwright-report/results.json` - JSON results
- `playwright-report/junit.xml` - JUnit format
- `test-results/` - Screenshots, videos, traces

### Traces

View detailed trace:

```bash
# Open trace viewer
npx playwright show-trace test-results/trace.zip

# Trace includes:
# - Timeline of actions
# - Screenshots at each step
# - Network requests
# - Console output
# - Source code
```

## CI/CD Integration

### GitHub Actions Workflow

E2E tests run automatically on:

- Push to main/develop branches
- Pull requests
- Daily schedule (2 AM UTC)
- Manual trigger

Workflow runs tests on:
- Chromium (Desktop)
- Firefox (Desktop)
- WebKit/Safari (Desktop)
- Mobile Chrome
- Mobile Safari
- iPad

### Artifacts

CI uploads:
- Test reports (30 days retention)
- Failure screenshots (7 days retention)
- Combined test results

### Viewing Results

1. Go to **Actions** tab in GitHub
2. Select workflow run
3. Download artifacts
4. Open `playwright-report/index.html`

## Best Practices

### 1. Test Organization

```typescript
test.describe('Feature', () => {
  // Setup runs before each test
  test.beforeEach(async ({ page }) => {
    // Common setup
  });

  test('specific behavior', async ({ page }) => {
    // Test implementation
  });
  
  // Cleanup runs after each test
  test.afterEach(async ({ page }) => {
    // Cleanup
  });
});
```

### 2. Reliable Selectors

```typescript
// ✅ Good - Stable selectors
await page.click('[data-testid="add-button"]');
await page.getByRole('button', { name: 'Add' });
await page.getByLabel('Email');

// ❌ Avoid - Fragile selectors
await page.click('.btn-primary');
await page.click('button:nth-child(3)');
```

### 3. Explicit Waits

```typescript
// ✅ Good - Explicit waits
await page.waitForSelector('[data-testid="dialog"]');
await page.waitForLoadState('networkidle');
await expect(page.locator('.result')).toBeVisible();

// ❌ Avoid - Fixed delays
await page.waitForTimeout(1000); // Use sparingly
```

### 4. Page Objects

```typescript
// Encapsulate page interactions
export class LoginPage {
  constructor(private page: Page) {}
  
  async login(username: string, password: string) {
    await this.page.fill('[name="username"]', username);
    await this.page.fill('[name="password"]', password);
    await this.page.click('button[type="submit"]');
  }
}
```

### 5. Test Independence

```typescript
// ✅ Each test should be independent
test('test 1', async ({ page }) => {
  // Setup own state
  await page.goto('/employees');
  // Test actions
});

test('test 2', async ({ page }) => {
  // Don't depend on test 1
  await page.goto('/employees');
  // Test actions
});
```

### 6. Assertions

```typescript
// Use Playwright assertions
await expect(page).toHaveTitle('Schichtplan');
await expect(page.locator('.error')).toBeVisible();
await expect(page).toHaveURL(/employees/);

// Multiple assertions
const dialog = page.locator('[role="dialog"]');
await expect(dialog).toBeVisible();
await expect(dialog).toContainText('Add Employee');
```

## Debugging Failed Tests

### 1. View Screenshot

```bash
# Screenshots saved in test-results/
open test-results/auth-should-login-chromium/test-failed-1.png
```

### 2. Watch Video

```bash
# Videos saved for failed tests
open test-results/auth-should-login-chromium/video.webm
```

### 3. Inspect Trace

```bash
# Open trace viewer
npx playwright show-trace test-results/auth-should-login-chromium/trace.zip
```

### 4. Run with Debug

```bash
# Run in debug mode
PWDEBUG=1 npx playwright test e2e/tests/auth.spec.ts
```

### 5. Console Output

```typescript
// Add console logging in tests
test('debug test', async ({ page }) => {
  page.on('console', msg => console.log(msg.text()));
  
  const text = await page.textContent('.element');
  console.log('Element text:', text);
});
```

## Mobile Testing

### Device Emulation

```typescript
// Test uses device from config
test('mobile view', async ({ page }) => {
  // Already configured for device
  const isMobile = await page.evaluate(() => window.innerWidth < 768);
  expect(isMobile).toBe(true);
});
```

### Touch Interactions

```typescript
test('swipe gesture', async ({ page }) => {
  await page.touchscreen.tap(100, 100);
  
  // Swipe right
  await page.touchscreen.swipe(
    { x: 50, y: 100 },
    { x: 200, y: 100 }
  );
});
```

### Orientation

```typescript
test('landscape mode', async ({ page }) => {
  await page.setViewportSize({ 
    width: 896, 
    height: 414 
  });
  
  // Test landscape layout
});
```

## Performance Testing

### Measure Page Load

```typescript
test('page performance', async ({ page }) => {
  const start = Date.now();
  
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  
  const loadTime = Date.now() - start;
  console.log(`Page loaded in ${loadTime}ms`);
  
  expect(loadTime).toBeLessThan(3000);
});
```

### Lighthouse Integration

```typescript
// Add @axe-core/playwright for accessibility testing
import { injectAxe, checkA11y } from 'axe-playwright';

test('accessibility check', async ({ page }) => {
  await page.goto('/');
  await injectAxe(page);
  await checkA11y(page);
});
```

## Continuous Improvement

### Test Coverage

Monitor test coverage:
- Authentication flows
- CRUD operations
- Navigation
- Error handling
- Responsive design
- Accessibility
- Performance

### Regular Maintenance

- Update Playwright: `bun update @playwright/test`
- Review and update selectors
- Add tests for new features
- Remove flaky tests
- Optimize slow tests

## Troubleshooting

### Common Issues

**Tests timing out**
```bash
# Increase timeout
npx playwright test --timeout=120000
```

**Browser not installed**
```bash
# Install browsers
bunx playwright install --with-deps
```

**Connection refused**
```bash
# Start application first
./start.sh

# Or set BASE_URL
PLAYWRIGHT_BASE_URL=http://other-host:5173 npm run test:e2e
```

**Flaky tests**
```typescript
// Add retries for specific tests
test.describe.configure({ retries: 2 });

test('potentially flaky', async ({ page }) => {
  // Test code
});
```

## Resources

- [Playwright Documentation](https://playwright.dev)
- [Best Practices](https://playwright.dev/docs/best-practices)
- [Debugging Guide](https://playwright.dev/docs/debug)
- [Selectors Guide](https://playwright.dev/docs/selectors)
- [Test Generator](https://playwright.dev/docs/codegen) - Generate tests from browser interactions

## Next Steps

1. Run existing tests: `npm run test:e2e`
2. View report: `npm run test:e2e:report`
3. Write custom tests for your workflows
4. Integrate into CI/CD pipeline
5. Monitor test results and fix failures

---

For questions or issues, see [GitHub Issues](https://github.com/jango-blockchained/schichtplan/issues).
