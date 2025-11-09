/**
 * Test data generators for E2E tests
 */

export interface TestEmployee {
  name: string;
  email: string;
  employeeType: 'VZ' | 'TZ' | 'GFB' | 'TL';
  weeklyHours: number;
  isKeyholder: boolean;
}

export interface TestSchedule {
  startDate: string;
  endDate: string;
  name?: string;
}

/**
 * Generate a random employee for testing
 */
export function generateTestEmployee(overrides?: Partial<TestEmployee>): TestEmployee {
  const randomId = Math.floor(Math.random() * 10000);
  
  return {
    name: `Test Employee ${randomId}`,
    email: `test.employee${randomId}@example.com`,
    employeeType: 'VZ',
    weeklyHours: 40,
    isKeyholder: false,
    ...overrides,
  };
}

/**
 * Generate multiple test employees
 */
export function generateTestEmployees(count: number): TestEmployee[] {
  return Array.from({ length: count }, (_, i) => 
    generateTestEmployee({ name: `Test Employee ${i + 1}` })
  );
}

/**
 * Generate a test schedule
 */
export function generateTestSchedule(overrides?: Partial<TestSchedule>): TestSchedule {
  const today = new Date();
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - today.getDay() + 1); // Monday
  
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 6); // Sunday
  
  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
    name: `Test Schedule ${Date.now()}`,
    ...overrides,
  };
}

/**
 * Get current week dates
 */
export function getCurrentWeekDates() {
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - today.getDay() + 1);
  
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  
  return {
    monday: monday.toISOString().split('T')[0],
    sunday: sunday.toISOString().split('T')[0],
  };
}

/**
 * Format date for display
 */
export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Wait for a condition with timeout
 */
export async function waitFor(
  condition: () => Promise<boolean>,
  timeout = 5000,
  interval = 100
): Promise<void> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  
  throw new Error(`Timeout waiting for condition after ${timeout}ms`);
}
