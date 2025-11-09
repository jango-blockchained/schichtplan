# End-to-End Tests

This directory contains comprehensive E2E tests for Schichtplan using Playwright.

## Quick Start

```bash
# Install Playwright browsers
bunx playwright install --with-deps chromium

# Run all tests
npm run test:e2e

# Run with UI
npm run test:e2e:ui

# Debug tests
npm run test:e2e:debug
```

## Test Suites

### 🔐 Authentication Tests (`auth.spec.ts`)
- Login/logout flows
- Passkey authentication
- Recovery codes
- Session persistence
- Security checks

### 👥 Employee Management Tests (`employees.spec.ts`)
- Create, read, update, delete employees
- Search and filter functionality
- Form validation
- Data persistence

### 📅 Schedule Management Tests (`schedule.spec.ts`)
- Schedule generation
- Manual shift assignment
- Week navigation
- Split week handling
- Publishing schedules
- Version management
- PDF export

### 🧭 Navigation Tests (`navigation.spec.ts`)
- Main navigation menu
- Breadcrumbs
- Theme toggle
- Notifications
- Accessibility features
- Error handling

### 📱 Responsive Design Tests (`responsive.spec.ts`)
- Mobile devices (iPhone, Pixel)
- Tablets (iPad)
- Desktop screens
- Touch interactions
- Responsive tables
- Breakpoint testing

## Test Coverage

Browsers tested:
- ✅ Chromium (Desktop)
- ✅ Firefox (Desktop)
- ✅ WebKit/Safari (Desktop)
- ✅ Mobile Chrome (Pixel 5)
- ✅ Mobile Safari (iPhone 13)
- ✅ iPad
- ✅ iPad Pro
- ✅ Galaxy S9+
- ✅ iPhone 12

## Folder Structure

```
e2e/
├── fixtures/
│   └── base.ts           # Custom fixtures (loginAsAdmin, navigateTo, etc.)
├── helpers/
│   ├── page-objects.ts   # Page Object Models for reusable page interactions
│   └── test-data.ts      # Test data generators and utilities
├── tests/
│   ├── auth.spec.ts
│   ├── employees.spec.ts
│   ├── schedule.spec.ts
│   ├── navigation.spec.ts
│   └── responsive.spec.ts
├── global-setup.ts       # Runs once before all tests
└── global-teardown.ts    # Runs once after all tests
```

## Writing Tests

### Using Page Objects

```typescript
import { EmployeesPage } from '../helpers/page-objects';

test('example', async ({ page }) => {
  const employeesPage = new EmployeesPage(page);
  await employeesPage.goto();
  await employeesPage.clickAddEmployee();
});
```

### Using Test Data Generators

```typescript
import { generateTestEmployee } from '../helpers/test-data';

test('create employee', async ({ page }) => {
  const employee = generateTestEmployee({
    name: 'Test User',
    employeeType: 'VZ'
  });
  // Use employee in test
});
```

### Using Custom Fixtures

```typescript
test('navigate', async ({ page, navigateTo, waitForPageLoad }) => {
  await navigateTo('employees');
  await waitForPageLoad();
  // Test implementation
});
```

## Best Practices

1. **Use stable selectors**: Prefer `data-testid`, `role`, and `label` selectors
2. **Test independence**: Each test should set up its own state
3. **Page Objects**: Encapsulate page interactions in Page Object Models
4. **Explicit waits**: Use Playwright's auto-waiting and explicit assertions
5. **Readable tests**: Write tests that document expected behavior

## CI/CD Integration

Tests run automatically on:
- Push to main/develop
- Pull requests
- Daily schedule (2 AM UTC)
- Manual trigger

Results are available in GitHub Actions artifacts.

## Debugging

### View test report
```bash
npm run test:e2e:report
```

### Debug specific test
```bash
npx playwright test --debug e2e/tests/auth.spec.ts
```

### View trace
```bash
npx playwright show-trace test-results/trace.zip
```

## Configuration

Main configuration in `playwright.config.ts`:
- Timeout: 60s per test
- Retries: 2 on CI, 0 locally
- Reporters: HTML, JSON, JUnit
- Base URL: http://localhost:5173

## Maintenance

- Update Playwright: `bun update @playwright/test`
- Update browsers: `bunx playwright install`
- Review and fix flaky tests
- Add tests for new features
- Keep page objects up to date

## Resources

- [Full Testing Guide](../docs/E2E_TESTING_GUIDE.md)
- [Playwright Documentation](https://playwright.dev)
- [Test Examples](./tests/)

---

For questions or issues with E2E tests, please open an issue on GitHub.
