"""
Simple caching system for AI routes performance optimization.
Uses in-memory caching with TTL support.
"""

import hashlib
import threading
import time
from datetime import datetime
from functools import wraps
from typing import Any, Dict, Optional


class TTLCache:
    """Time-To-Live cache implementation with automatic cleanup."""

    def __init__(self, default_ttl: int = 300):  # 5 minutes default
        self.cache: Dict[str, Dict] = {}
        self.default_ttl = default_ttl
        self._lock = threading.RLock()
        self._last_cleanup = time.time()
        self._cleanup_interval = 60  # Cleanup every minute

    def get(self, key: str) -> Optional[Any]:
        """Get value from cache if not expired."""
        with self._lock:
            self._maybe_cleanup()

            if key not in self.cache:
                return None

            entry = self.cache[key]
            if time.time() > entry["expires_at"]:
                del self.cache[key]
                return None

            entry["last_accessed"] = time.time()
            entry["access_count"] += 1
            return entry["value"]

    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        """Set value in cache with TTL."""
        with self._lock:
            ttl = ttl or self.default_ttl
            self.cache[key] = {
                "value": value,
                "created_at": time.time(),
                "expires_at": time.time() + ttl,
                "last_accessed": time.time(),
                "access_count": 1,
                "ttl": ttl,
            }

    def delete(self, key: str) -> bool:
        """Delete key from cache."""
        with self._lock:
            if key in self.cache:
                del self.cache[key]
                return True
            return False

    def clear(self) -> None:
        """Clear all cache entries."""
        with self._lock:
            self.cache.clear()

    def _maybe_cleanup(self) -> None:
        """Clean up expired entries if cleanup interval passed."""
        now = time.time()
        if now - self._last_cleanup > self._cleanup_interval:
            self._cleanup_expired()
            self._last_cleanup = now

    def _cleanup_expired(self) -> None:
        """Remove expired entries from cache."""
        now = time.time()
        expired_keys = [
            key for key, entry in self.cache.items() if now > entry["expires_at"]
        ]
        for key in expired_keys:
            del self.cache[key]

    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics."""
        with self._lock:
            now = time.time()
            total_entries = len(self.cache)
            expired_entries = sum(
                1 for entry in self.cache.values() if now > entry["expires_at"]
            )

            total_accesses = sum(entry["access_count"] for entry in self.cache.values())

            # Calculate hit rate (mock for now, would need request tracking)
            return {
                "total_entries": total_entries,
                "expired_entries": expired_entries,
                "active_entries": total_entries - expired_entries,
                "total_accesses": total_accesses,
                "memory_usage_estimate": len(str(self.cache)),
                "last_cleanup": datetime.fromtimestamp(self._last_cleanup).isoformat(),
                "cache_keys": list(self.cache.keys()),
            }


class AIRoutesCache:
    """Specialized cache for AI routes with different TTL strategies."""

    def __init__(self):
        # Different caches for different types of data
        self.tools_cache = TTLCache(default_ttl=600)  # 10 minutes for tools
        self.agent_cache = TTLCache(default_ttl=300)  # 5 minutes for agents
        self.workflow_cache = TTLCache(default_ttl=300)  # 5 minutes for workflows
        self.settings_cache = TTLCache(default_ttl=1800)  # 30 minutes for settings
        self.conversation_cache = TTLCache(default_ttl=60)  # 1 minute for conversations

        # Metrics tracking
        self.hit_count = 0
        self.miss_count = 0
        self._lock = threading.RLock()

    def _generate_key(self, prefix: str, *args, **kwargs) -> str:
        """Generate cache key from prefix and parameters."""
        # Create deterministic key from arguments
        key_data = f"{prefix}:{str(args)}:{str(sorted(kwargs.items()))}"
        return hashlib.md5(key_data.encode()).hexdigest()

    def get_tools(self, *args, **kwargs) -> Optional[Any]:
        """Get cached tools data."""
        key = self._generate_key("tools", *args, **kwargs)
        result = self.tools_cache.get(key)
        self._update_metrics(result is not None)
        return result

    def set_tools(self, data: Any, *args, **kwargs) -> None:
        """Cache tools data."""
        key = self._generate_key("tools", *args, **kwargs)
        self.tools_cache.set(key, data)

    def get_agents(self, *args, **kwargs) -> Optional[Any]:
        """Get cached agents data."""
        key = self._generate_key("agents", *args, **kwargs)
        result = self.agent_cache.get(key)
        self._update_metrics(result is not None)
        return result

    def set_agents(self, data: Any, *args, **kwargs) -> None:
        """Cache agents data."""
        key = self._generate_key("agents", *args, **kwargs)
        self.agent_cache.set(key, data)

    def get_workflows(self, *args, **kwargs) -> Optional[Any]:
        """Get cached workflow data."""
        key = self._generate_key("workflows", *args, **kwargs)
        result = self.workflow_cache.get(key)
        self._update_metrics(result is not None)
        return result

    def set_workflows(self, data: Any, *args, **kwargs) -> None:
        """Cache workflow data."""
        key = self._generate_key("workflows", *args, **kwargs)
        self.workflow_cache.set(key, data)

    def get_settings(self, *args, **kwargs) -> Optional[Any]:
        """Get cached settings data."""
        key = self._generate_key("settings", *args, **kwargs)
        result = self.settings_cache.get(key)
        self._update_metrics(result is not None)
        return result

    def set_settings(self, data: Any, *args, **kwargs) -> None:
        """Cache settings data."""
        key = self._generate_key("settings", *args, **kwargs)
        self.settings_cache.set(key, data)

    def get_conversation(self, conversation_id: str) -> Optional[Any]:
        """Get cached conversation data."""
        key = f"conversation:{conversation_id}"
        result = self.conversation_cache.get(key)
        self._update_metrics(result is not None)
        return result

    def set_conversation(self, conversation_id: str, data: Any) -> None:
        """Cache conversation data."""
        key = f"conversation:{conversation_id}"
        self.conversation_cache.set(key, data, ttl=60)  # Short TTL for dynamic data

    def invalidate_tools(self) -> None:
        """Invalidate all tools cache."""
        self.tools_cache.clear()

    def invalidate_agents(self) -> None:
        """Invalidate all agents cache."""
        self.agent_cache.clear()

    def invalidate_workflows(self) -> None:
        """Invalidate all workflows cache."""
        self.workflow_cache.clear()

    def invalidate_settings(self) -> None:
        """Invalidate all settings cache."""
        self.settings_cache.clear()

    def clear_all(self) -> None:
        """Clear all caches."""
        self.tools_cache.clear()
        self.agent_cache.clear()
        self.workflow_cache.clear()
        self.settings_cache.clear()
        self.conversation_cache.clear()
        with self._lock:
            self.hit_count = 0
            self.miss_count = 0

    def _update_metrics(self, is_hit: bool) -> None:
        """Update cache hit/miss metrics."""
        with self._lock:
            if is_hit:
                self.hit_count += 1
            else:
                self.miss_count += 1

    def get_cache_stats(self) -> Dict[str, Any]:
        """Get comprehensive cache statistics."""
        with self._lock:
            total_requests = self.hit_count + self.miss_count
            hit_rate = (self.hit_count / total_requests) if total_requests > 0 else 0

            return {
                "hit_count": self.hit_count,
                "miss_count": self.miss_count,
                "hit_rate": hit_rate,
                "total_requests": total_requests,
                "caches": {
                    "tools": self.tools_cache.get_stats(),
                    "agents": self.agent_cache.get_stats(),
                    "workflows": self.workflow_cache.get_stats(),
                    "settings": self.settings_cache.get_stats(),
                    "conversations": self.conversation_cache.get_stats(),
                },
                "timestamp": datetime.now().isoformat(),
            }


# Global cache instance
ai_cache = AIRoutesCache()


def cached_response(cache_type: str, ttl: Optional[int] = None):
    """Decorator to cache route responses."""

    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            # Generate cache key from function name and arguments
            cache_key = f"{func.__name__}:{str(args)}:{str(sorted(kwargs.items()))}"

            # Try to get from appropriate cache
            cached_data = None
            if cache_type == "tools":
                cached_data = ai_cache.get_tools(cache_key)
            elif cache_type == "agents":
                cached_data = ai_cache.get_agents(cache_key)
            elif cache_type == "workflows":
                cached_data = ai_cache.get_workflows(cache_key)
            elif cache_type == "settings":
                cached_data = ai_cache.get_settings(cache_key)

            if cached_data is not None:
                return cached_data

            # Execute function and cache result
            result = func(*args, **kwargs)

            # Cache the result
            if cache_type == "tools":
                ai_cache.set_tools(result, cache_key)
            elif cache_type == "agents":
                ai_cache.set_agents(result, cache_key)
            elif cache_type == "workflows":
                ai_cache.set_workflows(result, cache_key)
            elif cache_type == "settings":
                ai_cache.set_settings(result, cache_key)

            return result

        return wrapper

    return decorator
