"""
Rate limiting for AI requests with token bucket algorithm.

Prevents API abuse and manages costs by limiting request rates
per user, conversation, and globally.
"""

import asyncio
import logging
import time
from collections import defaultdict
from dataclasses import dataclass
from typing import Any

logger = logging.getLogger(__name__)


@dataclass
class RateLimitConfig:
    """Configuration for rate limiting."""

    requests_per_minute: int = 10
    requests_per_hour: int = 100
    tokens_per_minute: int = 50000
    tokens_per_hour: int = 500000
    burst_allowance: int = 5  # Allow burst requests up to this amount


class TokenBucket:
    """Token bucket for rate limiting."""

    def __init__(self, capacity: int, refill_rate: float):
        """Initialize token bucket.

        Args:
            capacity: Maximum number of tokens
            refill_rate: Tokens added per second
        """
        self.capacity = capacity
        self.refill_rate = refill_rate
        self.tokens = capacity
        self.last_refill = time.time()
        self._lock = asyncio.Lock()

    async def consume(self, tokens: int = 1) -> bool:
        """Try to consume tokens from bucket.

        Args:
            tokens: Number of tokens to consume

        Returns:
            True if tokens consumed, False if insufficient tokens
        """
        async with self._lock:
            # Refill tokens based on time elapsed
            now = time.time()
            elapsed = now - self.last_refill
            refill_amount = elapsed * self.refill_rate

            self.tokens = min(self.capacity, self.tokens + refill_amount)
            self.last_refill = now

            # Try to consume tokens
            if self.tokens >= tokens:
                self.tokens -= tokens
                return True

            return False

    async def wait_for_tokens(
        self, tokens: int = 1, timeout: float = 60.0
    ) -> bool:
        """Wait until tokens are available (optimized).

        Args:
            tokens: Number of tokens needed
            timeout: Maximum time to wait in seconds

        Returns:
            True if tokens acquired, False if timeout
        """
        start_time = time.time()

        while True:
            elapsed = time.time() - start_time
            
            if elapsed >= timeout:
                return False

            if await self.consume(tokens):
                return True

            # Calculate wait time for next token
            remaining_time = timeout - elapsed
            wait_time = min(1.0 / self.refill_rate, remaining_time)
            
            if wait_time > 0:
                await asyncio.sleep(wait_time)
            else:
                return False

    async def get_available_tokens(self) -> float:
        """Get number of available tokens.

        Returns:
            Number of available tokens
        """
        async with self._lock:
            # Refill first
            now = time.time()
            elapsed = now - self.last_refill
            refill_amount = elapsed * self.refill_rate

            tokens = min(self.capacity, self.tokens + refill_amount)
            return tokens

    async def reset(self):
        """Reset bucket to full capacity."""
        async with self._lock:
            self.tokens = self.capacity
            self.last_refill = time.time()


class RateLimiter:
    """Rate limiter for AI requests."""

    def __init__(self, config: RateLimitConfig):
        """Initialize rate limiter.

        Args:
            config: Rate limit configuration
        """
        self.config = config

        # Per-user buckets
        self._user_request_buckets: dict[str, TokenBucket] = {}
        self._user_token_buckets: dict[str, TokenBucket] = {}

        # Per-conversation buckets
        self._conversation_buckets: dict[str, TokenBucket] = {}

        # Global buckets
        self._global_request_bucket = TokenBucket(
            capacity=config.requests_per_minute + config.burst_allowance,
            refill_rate=config.requests_per_minute / 60.0,
        )

        self._global_token_bucket = TokenBucket(
            capacity=config.tokens_per_minute,
            refill_rate=config.tokens_per_minute / 60.0,
        )

        # Track request counts for analytics
        self._request_counts: dict[str, int] = defaultdict(int)
        self._token_counts: dict[str, int] = defaultdict(int)

        # Cleanup task
        self._cleanup_task: asyncio.Task | None = None

    def _get_user_request_bucket(self, user_id: str) -> TokenBucket:
        """Get or create request bucket for user."""
        if user_id not in self._user_request_buckets:
            self._user_request_buckets[user_id] = TokenBucket(
                capacity=self.config.requests_per_minute + self.config.burst_allowance,
                refill_rate=self.config.requests_per_minute / 60.0,
            )
        return self._user_request_buckets[user_id]

    def _get_user_token_bucket(self, user_id: str) -> TokenBucket:
        """Get or create token bucket for user."""
        if user_id not in self._user_token_buckets:
            self._user_token_buckets[user_id] = TokenBucket(
                capacity=self.config.tokens_per_minute,
                refill_rate=self.config.tokens_per_minute / 60.0,
            )
        return self._user_token_buckets[user_id]

    def _get_conversation_bucket(self, conversation_id: str) -> TokenBucket:
        """Get or create bucket for conversation."""
        if conversation_id not in self._conversation_buckets:
            self._conversation_buckets[conversation_id] = TokenBucket(
                capacity=self.config.requests_per_minute,
                refill_rate=self.config.requests_per_minute / 60.0,
            )
        return self._conversation_buckets[conversation_id]

    async def check_rate_limit(
        self,
        user_id: str | None = None,
        conversation_id: str | None = None,
        estimated_tokens: int = 1000,
    ) -> dict[str, Any]:
        """Check if request is within rate limits.

        Args:
            user_id: Optional user identifier
            conversation_id: Optional conversation identifier
            estimated_tokens: Estimated tokens for the request

        Returns:
            Dictionary with rate limit status
        """
        result = {
            "allowed": True,
            "reason": None,
            "retry_after": 0,
            "limits": {
                "global_requests": await self._global_request_bucket.get_available_tokens(),
                "global_tokens": await self._global_token_bucket.get_available_tokens(),
            },
        }

        # Check global request limit
        if not await self._global_request_bucket.consume(1):
            result["allowed"] = False
            result["reason"] = "Global request rate limit exceeded"
            result["retry_after"] = 60.0 / self.config.requests_per_minute
            return result

        # Check global token limit
        if not await self._global_token_bucket.consume(estimated_tokens):
            result["allowed"] = False
            result["reason"] = "Global token rate limit exceeded"
            result["retry_after"] = estimated_tokens / (self.config.tokens_per_minute / 60.0)
            return result

        # Check user-specific limits
        if user_id:
            user_request_bucket = self._get_user_request_bucket(user_id)
            if not await user_request_bucket.consume(1):
                result["allowed"] = False
                result["reason"] = f"User {user_id} request rate limit exceeded"
                result["retry_after"] = 60.0 / self.config.requests_per_minute
                return result

            user_token_bucket = self._get_user_token_bucket(user_id)
            if not await user_token_bucket.consume(estimated_tokens):
                result["allowed"] = False
                result["reason"] = f"User {user_id} token rate limit exceeded"
                result["retry_after"] = estimated_tokens / (self.config.tokens_per_minute / 60.0)
                return result

            result["limits"]["user_requests"] = await user_request_bucket.get_available_tokens()
            result["limits"]["user_tokens"] = await user_token_bucket.get_available_tokens()

        # Check conversation-specific limits
        if conversation_id:
            conversation_bucket = self._get_conversation_bucket(conversation_id)
            if not await conversation_bucket.consume(1):
                result["allowed"] = False
                result["reason"] = f"Conversation {conversation_id} rate limit exceeded"
                result["retry_after"] = 60.0 / self.config.requests_per_minute
                return result

            result["limits"]["conversation_requests"] = (
                await conversation_bucket.get_available_tokens()
            )

        # Track counts
        if user_id:
            self._request_counts[f"user:{user_id}"] += 1
            self._token_counts[f"user:{user_id}"] += estimated_tokens

        if conversation_id:
            self._request_counts[f"conversation:{conversation_id}"] += 1

        self._request_counts["global"] += 1
        self._token_counts["global"] += estimated_tokens

        return result

    async def wait_for_capacity(
        self,
        user_id: str | None = None,
        conversation_id: str | None = None,
        estimated_tokens: int = 1000,
        timeout: float = 60.0,
    ) -> bool:
        """Wait until request can be made within rate limits.

        Args:
            user_id: Optional user identifier
            conversation_id: Optional conversation identifier
            estimated_tokens: Estimated tokens for request
            timeout: Maximum time to wait

        Returns:
            True if capacity available, False if timeout
        """
        start_time = time.time()

        while time.time() - start_time < timeout:
            result = await self.check_rate_limit(user_id, conversation_id, estimated_tokens)

            if result["allowed"]:
                return True

            # Wait for estimated retry time
            wait_time = min(result.get("retry_after", 1.0), timeout - (time.time() - start_time))
            if wait_time > 0:
                await asyncio.sleep(wait_time)

        return False

    def get_statistics(self, user_id: str | None = None) -> dict[str, Any]:
        """Get rate limiter statistics.

        Args:
            user_id: Optional user ID to get specific stats

        Returns:
            Dictionary with statistics
        """
        stats = {
            "global": {
                "requests": self._request_counts.get("global", 0),
                "tokens": self._token_counts.get("global", 0),
            },
            "active_users": len(self._user_request_buckets),
            "active_conversations": len(self._conversation_buckets),
        }

        if user_id:
            stats["user"] = {
                "requests": self._request_counts.get(f"user:{user_id}", 0),
                "tokens": self._token_counts.get(f"user:{user_id}", 0),
            }

        return stats

    async def reset_limits(self, user_id: str | None = None, conversation_id: str | None = None):
        """Reset rate limits.

        Args:
            user_id: Optional user ID to reset
            conversation_id: Optional conversation ID to reset
        """
        if user_id:
            if user_id in self._user_request_buckets:
                await self._user_request_buckets[user_id].reset()
            if user_id in self._user_token_buckets:
                await self._user_token_buckets[user_id].reset()
            logger.info(f"Reset rate limits for user {user_id}")

        if conversation_id:
            if conversation_id in self._conversation_buckets:
                await self._conversation_buckets[conversation_id].reset()
            logger.info(f"Reset rate limits for conversation {conversation_id}")

        if not user_id and not conversation_id:
            await self._global_request_bucket.reset()
            await self._global_token_bucket.reset()
            logger.info("Reset global rate limits")

    async def cleanup_old_buckets(self, max_age: float = 3600.0):
        """Remove old unused buckets to free memory.

        Args:
            max_age: Maximum age in seconds before bucket is removed
        """
        now = time.time()

        # Cleanup user buckets
        old_users = [
            user_id
            for user_id, bucket in self._user_request_buckets.items()
            if now - bucket.last_refill > max_age
        ]

        for user_id in old_users:
            del self._user_request_buckets[user_id]
            if user_id in self._user_token_buckets:
                del self._user_token_buckets[user_id]

        # Cleanup conversation buckets
        old_conversations = [
            conv_id
            for conv_id, bucket in self._conversation_buckets.items()
            if now - bucket.last_refill > max_age
        ]

        for conv_id in old_conversations:
            del self._conversation_buckets[conv_id]

        if old_users or old_conversations:
            logger.info(
                f"Cleaned up {len(old_users)} user buckets and {len(old_conversations)} conversation buckets"
            )


# Global rate limiter instance
_rate_limiter: RateLimiter | None = None


def get_rate_limiter(config: RateLimitConfig | None = None) -> RateLimiter:
    """Get or create global rate limiter instance.

    Args:
        config: Optional rate limit configuration

    Returns:
        RateLimiter instance
    """
    global _rate_limiter

    if _rate_limiter is None:
        if config is None:
            config = RateLimitConfig()
        _rate_limiter = RateLimiter(config)

    return _rate_limiter
