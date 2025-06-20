"""
Enhanced MCP Service with tool result caching and usage analytics.
"""

import hashlib
import json
import time
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from src.backend.utils.ai_cache import TTLCache
from src.backend.utils.logger import logger


@dataclass
class ToolUsageMetric:
    """Represents a tool usage metric."""

    tool_id: str
    timestamp: datetime
    execution_time: float
    success: bool
    error_message: Optional[str] = None
    parameters_hash: Optional[str] = None
    result_size: Optional[int] = None


class MCPToolAnalytics:
    """Analytics system for MCP tool usage."""

    def __init__(self):
        self.usage_metrics: List[ToolUsageMetric] = []
        self.tool_popularity: Dict[str, int] = defaultdict(int)
        self.tool_success_rates: Dict[str, Dict[str, int]] = defaultdict(
            lambda: {"success": 0, "total": 0}
        )
        self.tool_avg_times: Dict[str, List[float]] = defaultdict(list)

    def record_usage(self, metric: ToolUsageMetric):
        """Record a tool usage metric."""
        self.usage_metrics.append(metric)
        self.tool_popularity[metric.tool_id] += 1

        # Update success rates
        self.tool_success_rates[metric.tool_id]["total"] += 1
        if metric.success:
            self.tool_success_rates[metric.tool_id]["success"] += 1

        # Update average execution times (keep last 100 measurements)
        self.tool_avg_times[metric.tool_id].append(metric.execution_time)
        if len(self.tool_avg_times[metric.tool_id]) > 100:
            self.tool_avg_times[metric.tool_id] = self.tool_avg_times[metric.tool_id][
                -100:
            ]

        # Keep only last 10000 metrics to prevent memory issues
        if len(self.usage_metrics) > 10000:
            self.usage_metrics = self.usage_metrics[-10000:]

    def get_tool_stats(self, tool_id: str) -> Dict[str, Any]:
        """Get statistics for a specific tool."""
        stats = self.tool_success_rates[tool_id]
        success_rate = (stats["success"] / stats["total"]) if stats["total"] > 0 else 0

        times = self.tool_avg_times[tool_id]
        avg_time = sum(times) / len(times) if times else 0

        # Get recent usage (last 24 hours)
        cutoff = datetime.now() - timedelta(hours=24)
        recent_usage = len(
            [
                m
                for m in self.usage_metrics
                if m.tool_id == tool_id and m.timestamp >= cutoff
            ]
        )

        return {
            "tool_id": tool_id,
            "total_calls": stats["total"],
            "success_rate": success_rate,
            "avg_execution_time": avg_time,
            "popularity_rank": self._get_popularity_rank(tool_id),
            "recent_24h_usage": recent_usage,
        }

    def get_overall_stats(self) -> Dict[str, Any]:
        """Get overall analytics statistics."""
        total_calls = sum(self.tool_popularity.values())
        total_tools = len(self.tool_popularity)

        # Calculate overall success rate
        total_success = sum(
            stats["success"] for stats in self.tool_success_rates.values()
        )
        overall_success_rate = (total_success / total_calls) if total_calls > 0 else 0

        # Get most popular tools
        popular_tools = sorted(
            self.tool_popularity.items(), key=lambda x: x[1], reverse=True
        )[:5]

        # Get recent activity (last hour)
        cutoff = datetime.now() - timedelta(hours=1)
        recent_activity = len([m for m in self.usage_metrics if m.timestamp >= cutoff])

        return {
            "total_tool_calls": total_calls,
            "total_unique_tools": total_tools,
            "overall_success_rate": overall_success_rate,
            "most_popular_tools": popular_tools,
            "recent_activity_1h": recent_activity,
            "analytics_since": min(
                [m.timestamp for m in self.usage_metrics]
            ).isoformat()
            if self.usage_metrics
            else None,
        }

    def _get_popularity_rank(self, tool_id: str) -> int:
        """Get the popularity rank of a tool (1 = most popular)."""
        sorted_tools = sorted(
            self.tool_popularity.items(), key=lambda x: x[1], reverse=True
        )
        for rank, (tid, _) in enumerate(sorted_tools, 1):
            if tid == tool_id:
                return rank
        return len(sorted_tools) + 1


class EnhancedMCPToolCache:
    """Enhanced caching system specifically for MCP tools."""

    def __init__(self):
        # Different cache strategies for different tool types
        self.analysis_cache = TTLCache(default_ttl=300)  # 5 minutes for analysis
        self.data_cache = TTLCache(default_ttl=600)  # 10 minutes for data retrieval
        self.computation_cache = TTLCache(
            default_ttl=1800
        )  # 30 minutes for heavy computations

        # Cache hit tracking
        self.cache_stats = {
            "hits": 0,
            "misses": 0,
            "cache_types": {
                "analysis": {"hits": 0, "misses": 0},
                "data": {"hits": 0, "misses": 0},
                "computation": {"hits": 0, "misses": 0},
            },
        }

    def _generate_cache_key(self, tool_id: str, parameters: Dict[str, Any]) -> str:
        """Generate a deterministic cache key."""
        # Sort parameters to ensure consistent keys
        sorted_params = json.dumps(parameters, sort_keys=True)
        key_data = f"{tool_id}:{sorted_params}"
        return hashlib.md5(key_data.encode()).hexdigest()

    def _get_cache_type(self, tool_id: str) -> str:
        """Determine cache type based on tool ID."""
        if "analysis" in tool_id.lower() or "statistics" in tool_id.lower():
            return "analysis"
        elif "schedule" in tool_id.lower() or "optimization" in tool_id.lower():
            return "computation"
        else:
            return "data"

    def get_cached_result(
        self, tool_id: str, parameters: Dict[str, Any]
    ) -> Optional[Any]:
        """Get cached result for a tool call."""
        cache_key = self._generate_cache_key(tool_id, parameters)
        cache_type = self._get_cache_type(tool_id)

        # Select appropriate cache
        cache = getattr(self, f"{cache_type}_cache")
        result = cache.get(cache_key)

        # Update statistics
        if result is not None:
            self.cache_stats["hits"] += 1
            self.cache_stats["cache_types"][cache_type]["hits"] += 1
        else:
            self.cache_stats["misses"] += 1
            self.cache_stats["cache_types"][cache_type]["misses"] += 1

        return result

    def cache_result(
        self,
        tool_id: str,
        parameters: Dict[str, Any],
        result: Any,
        custom_ttl: Optional[int] = None,
    ):
        """Cache a tool result."""
        cache_key = self._generate_cache_key(tool_id, parameters)
        cache_type = self._get_cache_type(tool_id)

        # Select appropriate cache
        cache = getattr(self, f"{cache_type}_cache")
        cache.set(cache_key, result, ttl=custom_ttl)

    def invalidate_tool_cache(self, tool_id: str):
        """Invalidate all cached results for a specific tool."""
        # This is a simplified invalidation - in production, we might want more granular control
        cache_type = self._get_cache_type(tool_id)
        cache = getattr(self, f"{cache_type}_cache")
        cache.clear()  # For now, clear the entire cache type

    def get_cache_statistics(self) -> Dict[str, Any]:
        """Get cache performance statistics."""
        total_requests = self.cache_stats["hits"] + self.cache_stats["misses"]
        hit_rate = (
            (self.cache_stats["hits"] / total_requests) if total_requests > 0 else 0
        )

        return {
            "overall": {
                "hit_rate": hit_rate,
                "total_hits": self.cache_stats["hits"],
                "total_misses": self.cache_stats["misses"],
                "total_requests": total_requests,
            },
            "by_cache_type": self.cache_stats["cache_types"],
            "cache_sizes": {
                "analysis": len(self.analysis_cache.cache),
                "data": len(self.data_cache.cache),
                "computation": len(self.computation_cache.cache),
            },
        }


class MCPToolExecutor:
    """Enhanced tool executor with caching and analytics."""

    def __init__(self):
        self.cache = EnhancedMCPToolCache()
        self.analytics = MCPToolAnalytics()

    async def execute_tool(
        self, tool_id: str, parameters: Dict[str, Any], tool_function: callable
    ) -> Dict[str, Any]:
        """Execute a tool with caching and analytics."""
        start_time = time.time()

        # Check cache first
        cached_result = self.cache.get_cached_result(tool_id, parameters)
        if cached_result is not None:
            logger.info(f"Cache hit for tool {tool_id}")
            return {
                "success": True,
                "result": cached_result,
                "cached": True,
                "execution_time": time.time() - start_time,
            }

        # Execute tool
        try:
            logger.info(f"Executing tool {tool_id} with parameters: {parameters}")
            result = await tool_function(**parameters)
            execution_time = time.time() - start_time

            # Cache successful results
            self.cache.cache_result(tool_id, parameters, result)

            # Record analytics
            metric = ToolUsageMetric(
                tool_id=tool_id,
                timestamp=datetime.now(),
                execution_time=execution_time,
                success=True,
                parameters_hash=self.cache._generate_cache_key(tool_id, parameters),
                result_size=len(str(result)) if result else 0,
            )
            self.analytics.record_usage(metric)

            logger.info(
                f"Tool {tool_id} executed successfully in {execution_time:.2f}s"
            )

            return {
                "success": True,
                "result": result,
                "cached": False,
                "execution_time": execution_time,
            }

        except Exception as e:
            execution_time = time.time() - start_time
            error_message = str(e)

            # Record failed analytics
            metric = ToolUsageMetric(
                tool_id=tool_id,
                timestamp=datetime.now(),
                execution_time=execution_time,
                success=False,
                error_message=error_message,
                parameters_hash=self.cache._generate_cache_key(tool_id, parameters),
            )
            self.analytics.record_usage(metric)

            logger.error(
                f"Tool {tool_id} failed after {execution_time:.2f}s: {error_message}"
            )

            return {
                "success": False,
                "error": error_message,
                "cached": False,
                "execution_time": execution_time,
            }

    def get_tool_analytics(self, tool_id: Optional[str] = None) -> Dict[str, Any]:
        """Get analytics for a specific tool or all tools."""
        if tool_id:
            return self.analytics.get_tool_stats(tool_id)
        else:
            return self.analytics.get_overall_stats()

    def get_cache_performance(self) -> Dict[str, Any]:
        """Get cache performance statistics."""
        return self.cache.get_cache_statistics()


# Global instances
mcp_tool_executor = MCPToolExecutor()


def with_mcp_enhancement(tool_id: str):
    """Decorator to add caching and analytics to MCP tools."""

    def decorator(func):
        async def wrapper(*args, **kwargs):
            return await mcp_tool_executor.execute_tool(tool_id, kwargs, func)

        return wrapper

    return decorator
