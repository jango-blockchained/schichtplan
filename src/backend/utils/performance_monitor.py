"""
Performance monitoring utilities for tracking response times and metrics.
"""

import functools
import logging
import time
from datetime import datetime
from typing import Dict, List, Optional

from flask import g, request

logger = logging.getLogger(__name__)


class PerformanceMonitor:
    """Monitor and track performance metrics for API endpoints."""

    def __init__(self):
        self.metrics: Dict[str, List[Dict]] = {}
        self.alert_thresholds = {
            "response_time": 2.0,  # seconds
            "error_rate": 0.05,  # 5%
        }

    def track_request_start(self):
        """Mark the start of a request."""
        g.request_start_time = time.time()
        g.request_id = f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{id(request)}"

    def track_request_end(
        self, endpoint: str, status_code: int, error: Optional[str] = None
    ):
        """Track the completion of a request."""
        if not hasattr(g, "request_start_time"):
            return

        response_time = time.time() - g.request_start_time

        metric = {
            "timestamp": datetime.now().isoformat(),
            "endpoint": endpoint,
            "response_time": response_time,
            "status_code": status_code,
            "error": error,
            "request_id": getattr(g, "request_id", None),
        }

        if endpoint not in self.metrics:
            self.metrics[endpoint] = []

        self.metrics[endpoint].append(metric)

        # Keep only last 1000 metrics per endpoint
        if len(self.metrics[endpoint]) > 1000:
            self.metrics[endpoint] = self.metrics[endpoint][-1000:]

        # Check for performance alerts
        self._check_performance_alerts(endpoint, response_time, status_code)

    def _check_performance_alerts(
        self, endpoint: str, response_time: float, status_code: int
    ):
        """Check if performance metrics exceed alert thresholds."""
        if response_time > self.alert_thresholds["response_time"]:
            logger.warning(
                f"Slow response detected: {endpoint} took {response_time:.2f}s"
            )

        # Check error rate for last 10 requests
        recent_metrics = self.metrics[endpoint][-10:]
        if len(recent_metrics) >= 5:
            error_count = sum(1 for m in recent_metrics if m["status_code"] >= 400)
            error_rate = error_count / len(recent_metrics)
            if error_rate > self.alert_thresholds["error_rate"]:
                logger.warning(
                    f"High error rate detected: {endpoint} has {error_rate:.1%} error rate"
                )

    def get_endpoint_stats(self, endpoint: str) -> Dict:
        """Get performance statistics for a specific endpoint."""
        if endpoint not in self.metrics:
            return {}

        metrics = self.metrics[endpoint]
        if not metrics:
            return {}

        response_times = [m["response_time"] for m in metrics]
        error_count = sum(1 for m in metrics if m["status_code"] >= 400)

        return {
            "endpoint": endpoint,
            "total_requests": len(metrics),
            "avg_response_time": sum(response_times) / len(response_times),
            "min_response_time": min(response_times),
            "max_response_time": max(response_times),
            "error_rate": error_count / len(metrics) if metrics else 0,
            "last_24h_requests": len(
                [m for m in metrics if self._is_within_24h(m["timestamp"])]
            ),
            "recent_errors": [m for m in metrics[-10:] if m["status_code"] >= 400],
        }

    def get_overall_stats(self) -> Dict:
        """Get overall performance statistics."""
        all_metrics = []
        for endpoint_metrics in self.metrics.values():
            all_metrics.extend(endpoint_metrics)

        if not all_metrics:
            return {"total_requests": 0}

        response_times = [m["response_time"] for m in all_metrics]
        error_count = sum(1 for m in all_metrics if m["status_code"] >= 400)

        endpoint_stats = {}
        for endpoint in self.metrics:
            endpoint_stats[endpoint] = self.get_endpoint_stats(endpoint)

        return {
            "total_requests": len(all_metrics),
            "avg_response_time": sum(response_times) / len(response_times),
            "error_rate": error_count / len(all_metrics),
            "endpoints": endpoint_stats,
            "slowest_endpoints": self._get_slowest_endpoints(),
            "last_updated": datetime.now().isoformat(),
        }

    def _get_slowest_endpoints(self) -> List[Dict]:
        """Get the slowest endpoints by average response time."""
        endpoint_averages = []
        for endpoint in self.metrics:
            stats = self.get_endpoint_stats(endpoint)
            if stats:
                endpoint_averages.append(
                    {
                        "endpoint": endpoint,
                        "avg_response_time": stats["avg_response_time"],
                        "total_requests": stats["total_requests"],
                    }
                )

        return sorted(
            endpoint_averages, key=lambda x: x["avg_response_time"], reverse=True
        )[:5]

    def _is_within_24h(self, timestamp_str: str) -> bool:
        """Check if timestamp is within the last 24 hours."""
        try:
            timestamp = datetime.fromisoformat(timestamp_str.replace("Z", "+00:00"))
            time_diff = datetime.now() - timestamp.replace(tzinfo=None)
            return time_diff.total_seconds() < 86400  # 24 hours
        except (ValueError, TypeError):
            return False


# Global performance monitor instance
performance_monitor = PerformanceMonitor()


def track_performance(func):
    """Decorator to track performance of route functions."""

    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        endpoint = f"{request.method} {request.endpoint}"
        performance_monitor.track_request_start()

        try:
            result = func(*args, **kwargs)

            # Handle different return types
            if isinstance(result, tuple):
                status_code = result[1] if len(result) > 1 else 200
            else:
                status_code = 200

            performance_monitor.track_request_end(endpoint, status_code)
            return result

        except Exception as e:
            performance_monitor.track_request_end(endpoint, 500, str(e))
            raise

    return wrapper
