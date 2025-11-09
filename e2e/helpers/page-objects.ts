/**
 * Page object models for common UI interactions
 */
import { Page, Locator } from '@playwright/test';

/**
 * Base page object with common functionality
 */
export class BasePage {
  constructor(protected page: Page) {}

  /**
   * Navigate to this page
   */
  async goto(url: string) {
    await this.page.goto(url);
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Wait for element to be visible
   */
  async waitForElement(selector: string, timeout = 10000) {
    await this.page.waitForSelector(selector, { state: 'visible', timeout });
  }

  /**
   * Check if element exists
   */
  async elementExists(selector: string): Promise<boolean> {
    return (await this.page.$(selector)) !== null;
  }

  /**
   * Get page title
   */
  async getTitle(): Promise<string> {
    return this.page.title();
  }
}

/**
 * Login Page
 */
export class LoginPage extends BasePage {
  readonly loginButton: Locator;
  readonly setupButton: Locator;

  constructor(page: Page) {
    super(page);
    this.loginButton = page.getByRole('button', { name: /login|anmelden/i });
    this.setupButton = page.getByRole('button', { name: /setup/i });
  }

  async goto() {
    await super.goto('/login');
  }

  async hasSetupPrompt(): Promise<boolean> {
    return this.elementExists('text=Setup');
  }

  async clickLogin() {
    await this.loginButton.click();
  }
}

/**
 * Dashboard Page
 */
export class DashboardPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async goto() {
    await super.goto('/dashboard');
  }

  async isLoaded(): Promise<boolean> {
    return this.elementExists('[data-testid="dashboard"]') ||
           this.elementExists('h1:has-text("Dashboard")');
  }
}

/**
 * Employees Page
 */
export class EmployeesPage extends BasePage {
  readonly addEmployeeButton: Locator;
  readonly searchInput: Locator;

  constructor(page: Page) {
    super(page);
    this.addEmployeeButton = page.getByRole('button', { name: /add|hinzufügen|neu/i });
    this.searchInput = page.getByPlaceholder(/search|suchen/i);
  }

  async goto() {
    await super.goto('/employees');
  }

  async clickAddEmployee() {
    await this.addEmployeeButton.click();
    await this.page.waitForSelector('[data-testid="employee-dialog"], [role="dialog"]');
  }

  async searchEmployee(name: string) {
    await this.searchInput.fill(name);
    await this.page.waitForTimeout(300); // Debounce
  }

  async getEmployeeCount(): Promise<number> {
    const rows = await this.page.$$('[data-testid="employee-row"], tbody tr');
    return rows.length;
  }

  async deleteEmployee(name: string) {
    const row = this.page.locator(`tr:has-text("${name}")`).first();
    await row.getByRole('button', { name: /delete|löschen/i }).click();
    
    // Confirm deletion
    const confirmButton = this.page.getByRole('button', { name: /confirm|bestätigen|delete/i });
    await confirmButton.click();
    await this.page.waitForTimeout(500);
  }
}

/**
 * Schedule Page
 */
export class SchedulePage extends BasePage {
  readonly generateButton: Locator;
  readonly publishButton: Locator;
  readonly weekNavigator: Locator;

  constructor(page: Page) {
    super(page);
    this.generateButton = page.getByRole('button', { name: /generate|generieren/i });
    this.publishButton = page.getByRole('button', { name: /publish|veröffentlichen/i });
    this.weekNavigator = page.locator('[data-testid="week-navigator"]');
  }

  async goto() {
    await super.goto('/schedule');
  }

  async selectWeek(weekIdentifier: string) {
    // Implementation depends on week navigation UI
    await this.weekNavigator.click();
    await this.page.locator(`text=${weekIdentifier}`).click();
  }

  async generateSchedule() {
    await this.generateButton.click();
    await this.page.waitForTimeout(1000); // Wait for generation
  }

  async publishSchedule() {
    await this.publishButton.click();
    // Wait for confirmation
    await this.page.waitForTimeout(500);
  }

  async getShiftCount(): Promise<number> {
    const shifts = await this.page.$$('[data-testid="shift"], .shift-cell');
    return shifts.length;
  }
}

/**
 * Settings Page
 */
export class SettingsPage extends BasePage {
  readonly saveButton: Locator;

  constructor(page: Page) {
    super(page);
    this.saveButton = page.getByRole('button', { name: /save|speichern/i });
  }

  async goto() {
    await super.goto('/settings');
  }

  async updateSetting(name: string, value: string) {
    const input = this.page.locator(`input[name="${name}"], input[id="${name}"]`);
    await input.fill(value);
  }

  async saveSettings() {
    await this.saveButton.click();
    await this.page.waitForTimeout(500);
  }
}
