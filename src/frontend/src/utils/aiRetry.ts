/**
 * Retry utilities for frontend AI requests
 *
 * Provides exponential backoff and error recovery for AI API calls
 */

export interface RetryConfig {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  exponentialBase: number;
  retryableStatuses: number[];
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelay: 1000, // 1 second
  maxDelay: 30000, // 30 seconds
  exponentialBase: 2,
  retryableStatuses: [408, 429, 500, 502, 503, 504],
};

/**
 * Calculate delay for retry attempt with exponential backoff and jitter
 */
function calculateDelay(
  attempt: number,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
): number {
  const exponentialDelay = Math.min(
    config.initialDelay * Math.pow(config.exponentialBase, attempt),
    config.maxDelay,
  );

  // Add random jitter (0-50% of delay)
  const jitter = Math.random() * 0.5 * exponentialDelay;

  return exponentialDelay + jitter;
}

/**
 * Check if error/response is retryable
 */
function isRetryable(
  error: unknown,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
): boolean {
  if (error instanceof Response) {
    return config.retryableStatuses.includes(error.status);
  }

  if (error instanceof Error) {
    // Network errors are retryable
    return (
      error.name === "NetworkError" ||
      error.name === "TypeError" ||
      error.message.includes("fetch") ||
      error.message.includes("network")
    );
  }

  return false;
}

/**
 * Wait for specified duration
 */
function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 */
export async function retryAsync<T>(
  fn: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
  onRetry?: (attempt: number, error: unknown) => void,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry if it's the last attempt
      if (attempt >= config.maxRetries) {
        break;
      }

      // Check if error is retryable
      if (!isRetryable(error, config)) {
        throw error;
      }

      // Calculate delay and wait
      const delay = calculateDelay(attempt, config);

      console.warn(
        `Request failed (attempt ${attempt + 1}/${config.maxRetries + 1}). Retrying in ${delay}ms...`,
        error,
      );

      if (onRetry) {
        onRetry(attempt, error);
      }

      await wait(delay);
    }
  }

  // All retries exhausted
  throw lastError;
}

/**
 * Circuit breaker for preventing cascading failures
 */
export class CircuitBreaker {
  private failureCount = 0;
  private lastFailureTime: number | null = null;
  private state: "CLOSED" | "OPEN" | "HALF_OPEN" = "CLOSED";

  constructor(
    private failureThreshold: number = 5,
    private recoveryTimeout: number = 60000, // 60 seconds
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === "OPEN") {
      // Check if we should try recovery
      if (
        this.lastFailureTime &&
        Date.now() - this.lastFailureTime >= this.recoveryTimeout
      ) {
        console.info("Circuit breaker entering HALF_OPEN state");
        this.state = "HALF_OPEN";
      } else {
        throw new Error("Circuit breaker is OPEN");
      }
    }

    try {
      const result = await fn();

      // Success - reset on half-open or keep closed
      if (this.state === "HALF_OPEN") {
        console.info("Circuit breaker closed after successful call");
        this.state = "CLOSED";
        this.failureCount = 0;
      }

      return result;
    } catch (error) {
      this.failureCount++;
      this.lastFailureTime = Date.now();

      if (this.failureCount >= this.failureThreshold) {
        console.error(
          `Circuit breaker opened after ${this.failureCount} failures`,
        );
        this.state = "OPEN";
      }

      throw error;
    }
  }

  reset(): void {
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.state = "CLOSED";
    console.info("Circuit breaker manually reset");
  }

  getState(): string {
    return this.state;
  }
}

/**
 * Request deduplication cache
 */
export class RequestCache {
  private cache = new Map<string, Promise<any>>();
  private timestamps = new Map<string, number>();

  constructor(private ttl: number = 5000) {} // 5 second TTL

  /**
   * Generate cache key from request parameters
   */
  private getCacheKey(endpoint: string, params: unknown): string {
    return `${endpoint}:${JSON.stringify(params)}`;
  }

  /**
   * Check if cache entry is expired
   */
  private isExpired(key: string): boolean {
    const timestamp = this.timestamps.get(key);
    if (!timestamp) return true;
    return Date.now() - timestamp > this.ttl;
  }

  /**
   * Get cached request or execute and cache new one
   */
  async deduplicate<T>(
    endpoint: string,
    params: unknown,
    fn: () => Promise<T>,
  ): Promise<T> {
    const key = this.getCacheKey(endpoint, params);

    // Check if we have a valid cached request
    if (this.cache.has(key) && !this.isExpired(key)) {
      console.debug(`Using cached request for ${endpoint}`);
      return this.cache.get(key)!;
    }

    // Execute new request and cache the promise
    const promise = fn();
    this.cache.set(key, promise);
    this.timestamps.set(key, Date.now());

    try {
      const result = await promise;
      return result;
    } catch (error) {
      // Remove from cache on error
      this.cache.delete(key);
      this.timestamps.delete(key);
      throw error;
    }
  }

  /**
   * Clear all cached requests
   */
  clear(): void {
    this.cache.clear();
    this.timestamps.clear();
  }

  /**
   * Clear expired entries
   */
  clearExpired(): void {
    const now = Date.now();
    for (const [key, timestamp] of this.timestamps.entries()) {
      if (now - timestamp > this.ttl) {
        this.cache.delete(key);
        this.timestamps.delete(key);
      }
    }
  }
}

/**
 * Rate limiter using token bucket algorithm
 */
export class RateLimiter {
  private tokens: number;
  private lastRefill: number;

  constructor(
    private capacity: number,
    private refillRate: number, // tokens per second
  ) {
    this.tokens = capacity;
    this.lastRefill = Date.now();
  }

  /**
   * Try to consume tokens
   */
  async consume(tokens: number = 1): Promise<boolean> {
    this.refill();

    if (this.tokens >= tokens) {
      this.tokens -= tokens;
      return true;
    }

    return false;
  }

  /**
   * Wait until tokens are available
   */
  async waitForTokens(tokens: number = 1, timeout: number = 30000): Promise<boolean> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      if (await this.consume(tokens)) {
        return true;
      }

      // Wait before checking again
      const waitTime = Math.min(1000 / this.refillRate, timeout - (Date.now() - startTime));
      if (waitTime > 0) {
        await wait(waitTime);
      }
    }

    return false;
  }

  /**
   * Refill tokens based on elapsed time
   */
  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000; // Convert to seconds
    const refillAmount = elapsed * this.refillRate;

    this.tokens = Math.min(this.capacity, this.tokens + refillAmount);
    this.lastRefill = now;
  }

  /**
   * Get available tokens
   */
  getAvailableTokens(): number {
    this.refill();
    return this.tokens;
  }

  /**
   * Reset to full capacity
   */
  reset(): void {
    this.tokens = this.capacity;
    this.lastRefill = Date.now();
  }
}
