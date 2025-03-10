#!/usr/bin/env python
"""
Script to benchmark the scheduler performance.
"""

import time
from datetime import date, timedelta
import gc
from src.backend.app import create_app
from services.scheduler import ScheduleGenerator
from services.scheduler.resources import ScheduleResources


def measure_execution_time(func, *args, **kwargs):
    """Measure the execution time of a function"""
    gc.collect()  # Force garbage collection to get more consistent results

    # Warm up run
    func(*args, **kwargs)

    # Timed runs
    times = []
    for _ in range(3):
        start_time = time.time()
        result = func(*args, **kwargs)
        end_time = time.time()
        times.append(end_time - start_time)

    return min(times), result  # Return the best time and the function result


def test_resource_loading():
    """Test the performance of resource loading"""
    resources = ScheduleResources()
    exec_time, _ = measure_execution_time(resources.load)
    print(f"Resource loading time: {exec_time:.4f} seconds")
    return resources


def test_daily_coverage(resources, days=7):
    """Test the performance of daily coverage retrieval"""
    today = date.today()
    dates = [today + timedelta(days=i) for i in range(days)]

    # First run - no cache
    resources.clear_caches()
    first_time = 0
    for day in dates:
        exec_time, _ = measure_execution_time(resources.get_daily_coverage, day)
        first_time += exec_time

    # Second run - with cache
    second_time = 0
    for day in dates:
        exec_time, _ = measure_execution_time(resources.get_daily_coverage, day)
        second_time += exec_time

    print(
        f"Daily coverage retrieval (first run): {first_time:.4f} seconds for {days} days"
    )
    print(
        f"Daily coverage retrieval (cached): {second_time:.4f} seconds for {days} days"
    )
    print(f"Cache speedup: {first_time / max(second_time, 0.0001):.1f}x")


def test_schedule_generation(days=7):
    """Test the performance of schedule generation"""
    generator = ScheduleGenerator()
    today = date.today()
    end_date = today + timedelta(days=days - 1)

    exec_time, result = measure_execution_time(
        generator.generate_schedule,
        start_date=today,
        end_date=end_date,
        create_empty_schedules=True,
    )

    print(f"Schedule generation time: {exec_time:.4f} seconds for {days} days")
    print(f"Generated {len(result.get('schedule', []))} schedule entries")
    print(f"Average time per day: {exec_time / days:.4f} seconds")

    return exec_time, result


def main():
    """Run the performance benchmark"""
    print("=" * 50)
    print("SCHEDULER PERFORMANCE BENCHMARK")
    print("=" * 50)

    app = create_app()
    with app.app_context():
        # Test resource loading
        print("\n1. Testing resource loading...")
        resources = test_resource_loading()

        # Test daily coverage retrieval
        print("\n2. Testing daily coverage retrieval...")
        test_daily_coverage(resources)

        # Test schedule generation
        print("\n3. Testing schedule generation...")
        days = 7
        exec_time, _ = test_schedule_generation(days)

        # Estimate time for a full month
        month_estimate = exec_time * (30 / days)
        print(
            f"\nEstimated time for a full month (30 days): {month_estimate:.4f} seconds"
        )

        print("\nBenchmark complete!")


if __name__ == "__main__":
    main()
