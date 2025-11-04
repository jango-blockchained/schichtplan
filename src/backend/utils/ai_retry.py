"""
Retry utilities for AI and MCP operations with exponential backoff.

Provides decorators and utilities for handling transient failures in
AI operations, API calls, and database operations.
"""

import asyncio
import functools
import logging
import time
from typing import Any, Callable, Type, TypeVar

logger = logging.getLogger(__name__)

T = TypeVar("T")


class RetryConfig:
    """Configuration for retry behavior."""

    def __init__(
        self,
        max_retries: int = 3,
        initial_delay: float = 1.0,
        max_delay: float = 60.0,
        exponential_base: float = 2.0,
        jitter: bool = True,
    ):
        """Initialize retry configuration.

        Args:
            max_retries: Maximum number of retry attempts
            initial_delay: Initial delay between retries in seconds
            max_delay: Maximum delay between retries in seconds
            exponential_base: Base for exponential backoff calculation
            jitter: Whether to add random jitter to delays
        """
        self.max_retries = max_retries
        self.initial_delay = initial_delay
        self.max_delay = max_delay
        self.exponential_base = exponential_base
        self.jitter = jitter

    def calculate_delay(self, attempt: int) -> float:
        """Calculate delay for given attempt number.

        Args:
            attempt: Current attempt number (0-indexed)

        Returns:
            Delay in seconds
        """
        delay = min(
            self.initial_delay * (self.exponential_base**attempt), self.max_delay
        )

        if self.jitter:
            import random

            delay *= 0.5 + random.random()  # Add 0-50% jitter

        return delay


def should_retry(exception: Exception, retryable_exceptions: tuple) -> bool:
    """Determine if an exception should trigger a retry.

    Args:
        exception: Exception that occurred
        retryable_exceptions: Tuple of exception types that are retryable

    Returns:
        True if should retry, False otherwise
    """
    if not retryable_exceptions:
        return False

    return isinstance(exception, retryable_exceptions)


def retry_async(
    retryable_exceptions: tuple[Type[Exception], ...] = (Exception,),
    config: RetryConfig | None = None,
    on_retry: Callable[[Exception, int], None] | None = None,
):
    """Decorator for async functions with retry logic.

    Args:
        retryable_exceptions: Tuple of exception types to retry on
        config: Retry configuration (uses default if None)
        on_retry: Optional callback called on each retry
    """
    if config is None:
        config = RetryConfig()

    def decorator(func: Callable[..., Any]) -> Callable[..., Any]:
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            last_exception = None

            for attempt in range(config.max_retries + 1):
                try:
                    return await func(*args, **kwargs)
                except Exception as e:
                    last_exception = e

                    if attempt >= config.max_retries:
                        logger.error(
                            f"{func.__name__} failed after {config.max_retries + 1} attempts: {e}"
                        )
                        raise

                    if not should_retry(e, retryable_exceptions):
                        logger.warning(
                            f"{func.__name__} failed with non-retryable error: {e}"
                        )
                        raise

                    delay = config.calculate_delay(attempt)
                    logger.warning(
                        f"{func.__name__} attempt {attempt + 1} failed: {e}. "
                        f"Retrying in {delay:.2f}s..."
                    )

                    if on_retry:
                        on_retry(e, attempt)

                    await asyncio.sleep(delay)

            # Should never reach here, but for type safety
            if last_exception:
                raise last_exception

        return wrapper

    return decorator


def retry_sync(
    retryable_exceptions: tuple[Type[Exception], ...] = (Exception,),
    config: RetryConfig | None = None,
    on_retry: Callable[[Exception, int], None] | None = None,
):
    """Decorator for sync functions with retry logic.

    Args:
        retryable_exceptions: Tuple of exception types to retry on
        config: Retry configuration (uses default if None)
        on_retry: Optional callback called on each retry
    """
    if config is None:
        config = RetryConfig()

    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @functools.wraps(func)
        def wrapper(*args, **kwargs) -> T:
            last_exception = None

            for attempt in range(config.max_retries + 1):
                try:
                    return func(*args, **kwargs)
                except Exception as e:
                    last_exception = e

                    if attempt >= config.max_retries:
                        logger.error(
                            f"{func.__name__} failed after {config.max_retries + 1} attempts: {e}"
                        )
                        raise

                    if not should_retry(e, retryable_exceptions):
                        logger.warning(
                            f"{func.__name__} failed with non-retryable error: {e}"
                        )
                        raise

                    delay = config.calculate_delay(attempt)
                    logger.warning(
                        f"{func.__name__} attempt {attempt + 1} failed: {e}. "
                        f"Retrying in {delay:.2f}s..."
                    )

                    if on_retry:
                        on_retry(e, attempt)

                    time.sleep(delay)

            # Should never reach here, but for type safety
            if last_exception:
                raise last_exception
            raise RuntimeError("Retry logic error")

        return wrapper

    return decorator


class CircuitBreaker:
    """Circuit breaker pattern for preventing cascading failures.

    States:
    - CLOSED: Normal operation, requests pass through
    - OPEN: Failure threshold exceeded, requests fail immediately
    - HALF_OPEN: Testing if service recovered, limited requests pass
    """

    def __init__(
        self,
        failure_threshold: int = 5,
        recovery_timeout: float = 60.0,
        expected_exception: Type[Exception] = Exception,
    ):
        """Initialize circuit breaker.

        Args:
            failure_threshold: Number of failures before opening circuit
            recovery_timeout: Seconds to wait before attempting recovery
            expected_exception: Exception type to monitor
        """
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.expected_exception = expected_exception

        self._failure_count = 0
        self._last_failure_time = None
        self._state = "CLOSED"
        self._lock = asyncio.Lock()

    @property
    def state(self) -> str:
        """Get current circuit breaker state."""
        return self._state

    async def call(self, func: Callable[..., Any], *args, **kwargs) -> Any:
        """Execute function through circuit breaker.

        Args:
            func: Async function to call
            *args: Positional arguments for func
            **kwargs: Keyword arguments for func

        Returns:
            Result from func

        Raises:
            Exception: If circuit is open or func fails
        """
        async with self._lock:
            if self._state == "OPEN":
                if (
                    self._last_failure_time
                    and time.time() - self._last_failure_time >= self.recovery_timeout
                ):
                    self._state = "HALF_OPEN"
                    logger.info("Circuit breaker entering HALF_OPEN state")
                else:
                    raise Exception("Circuit breaker is OPEN")

        try:
            result = await func(*args, **kwargs)

            async with self._lock:
                if self._state == "HALF_OPEN":
                    self._state = "CLOSED"
                    self._failure_count = 0
                    logger.info("Circuit breaker closed after successful call")

            return result

        except self.expected_exception as e:
            async with self._lock:
                self._failure_count += 1
                self._last_failure_time = time.time()

                if self._failure_count >= self.failure_threshold:
                    self._state = "OPEN"
                    logger.error(
                        f"Circuit breaker opened after {self._failure_count} failures"
                    )

            raise e

    def reset(self):
        """Manually reset circuit breaker to closed state."""
        self._failure_count = 0
        self._last_failure_time = None
        self._state = "CLOSED"
        logger.info("Circuit breaker manually reset")


# Common retry configurations for different scenarios
AI_REQUEST_RETRY_CONFIG = RetryConfig(
    max_retries=3, initial_delay=2.0, max_delay=30.0, exponential_base=2.0
)

DATABASE_RETRY_CONFIG = RetryConfig(
    max_retries=5, initial_delay=0.5, max_delay=10.0, exponential_base=1.5
)

API_REQUEST_RETRY_CONFIG = RetryConfig(
    max_retries=3, initial_delay=1.0, max_delay=20.0, exponential_base=2.0
)
