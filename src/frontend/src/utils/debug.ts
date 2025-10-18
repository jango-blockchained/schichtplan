/**
 * Debug utility for conditional logging
 * Only logs in development environment
 */

const isDevelopment = process.env.NODE_ENV === "development";

type LogLevel = "log" | "info" | "warn" | "error" | "debug";

interface DebugLogger {
  log: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  debug: (...args: unknown[]) => void;
  group: (label: string) => void;
  groupEnd: () => void;
}

/**
 * Creates a namespaced debug logger that only logs in development
 * @param namespace - The namespace for the logger (e.g., 'SchedulePage', 'VersionManager')
 * @returns A logger object with console methods
 */
export function createDebugger(namespace: string): DebugLogger {
  const prefix = `[${namespace}]`;

  const log = (level: LogLevel, ...args: unknown[]) => {
    if (isDevelopment) {
      console[level](prefix, ...args);
    }
  };

  return {
    log: (...args: unknown[]) => log("log", ...args),
    info: (...args: unknown[]) => log("info", ...args),
    warn: (...args: unknown[]) => log("warn", ...args),
    error: (...args: unknown[]) => log("error", ...args),
    debug: (...args: unknown[]) => log("debug", ...args),
    group: (label: string) => {
      if (isDevelopment) {
        console.group(`${prefix} ${label}`);
      }
    },
    groupEnd: () => {
      if (isDevelopment) {
        console.groupEnd();
      }
    },
  };
}

/**
 * Global debug logger for general use
 */
export const debug = createDebugger("App");

/**
 * Utility to only run code in development
 */
export function devOnly(fn: () => void): void {
  if (isDevelopment) {
    fn();
  }
}

/**
 * Performance measurement utility (dev only)
 */
export function measurePerformance<T>(label: string, fn: () => T): T {
  if (isDevelopment) {
    const start = performance.now();
    const result = fn();
    const end = performance.now();
    console.log(`⏱️ ${label}: ${(end - start).toFixed(2)}ms`);
    return result;
  }
  return fn();
}

/**
 * Async performance measurement utility (dev only)
 */
export async function measurePerformanceAsync<T>(
  label: string,
  fn: () => Promise<T>,
): Promise<T> {
  if (isDevelopment) {
    const start = performance.now();
    const result = await fn();
    const end = performance.now();
    console.log(`⏱️ ${label}: ${(end - start).toFixed(2)}ms`);
    return result;
  }
  return fn();
}
