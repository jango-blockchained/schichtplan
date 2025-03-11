#!/usr/bin/env python
"""
Command-line script to run diagnostic tests on the schedule generator.
This script ensures the correct environment is set up before running the diagnostic.
"""

import sys
import os
from pathlib import Path
import argparse
from datetime import timedelta, date

# Set Flask environment variables
os.environ["FLASK_APP"] = "src.backend.app"
os.environ["FLASK_ENV"] = "development"
os.environ["DEBUG_MODE"] = "1"

# Add the project root to the Python path
ROOT_DIR = Path(__file__).resolve().parent.parent.parent
sys.path.insert(
    0, str(ROOT_DIR.parent)
)  # We need to include the parent directory of src

# Now we can import the diagnostic tool
try:
    from src.backend.tools.debug.schedule_generator_diagnostic import run_diagnostic
except ImportError as e:
    print(f"Error importing diagnostic tool: {e}")
    print(
        "Make sure you're running this script from the project root or add the project root to your PYTHONPATH."
    )
    sys.exit(1)


def main():
    """Run the scheduler diagnostic tool"""
    parser = argparse.ArgumentParser(
        description="Run diagnostic tests on the schedule generator process"
    )
    # Date-related arguments
    date_group = parser.add_argument_group("Date Options")
    date_group.add_argument(
        "--start-date", type=str, help="Start date in YYYY-MM-DD format"
    )
    date_group.add_argument(
        "--end-date", type=str, help="End date in YYYY-MM-DD format"
    )
    date_group.add_argument(
        "--days",
        type=int,
        default=7,
        help="Number of days if no dates provided (default: 7)",
    )
    date_group.add_argument(
        "--next-week", action="store_true", help="Use next week for date range"
    )

    # Output options
    output_group = parser.add_argument_group("Output Options")
    output_group.add_argument(
        "--quiet", action="store_true", help="Reduce console output"
    )
    output_group.add_argument(
        "--json", action="store_true", help="Output results in JSON format"
    )

    args = parser.parse_args()

    # Handle date options
    start_date = args.start_date
    end_date = args.end_date
    days = args.days

    if args.next_week:
        today = date.today()
        next_monday = today + timedelta(days=(7 - today.weekday()))
        start_date = next_monday.strftime("%Y-%m-%d")
        end_date = (next_monday + timedelta(days=6)).strftime("%Y-%m-%d")

    # Print diagnostic information
    if not args.quiet:
        print("=" * 80)
        print("SCHEDULER DIAGNOSTIC TOOL")
        print("=" * 80)
        print(f"Date range: {start_date or 'today'} to {end_date or f'+{days} days'}")
        print(f"Project root: {ROOT_DIR}")
        print(f"Flask app: {os.environ.get('FLASK_APP')}")
        print(f"Flask environment: {os.environ.get('FLASK_ENV')}")
        print(f"Python path: {os.environ.get('PYTHONPATH', '(not set)')}")
        print("=" * 80)
        print("Starting diagnostic run...\n")

    # Run the diagnostic
    try:
        result = run_diagnostic(start_date, end_date, days)

        # Output results summary to console
        if not args.quiet and not args.json:
            print("\nDIAGNOSTIC SUMMARY")
            print("=" * 80)
            print(f"Session ID: {result.get('session_id', 'unknown')}")
            print(f"Log file: {result.get('log_file', 'unknown')}")

            if "error" in result:
                print(f"Diagnostic failed with error: {result['error']}")
                return 1

            print("\nStatistics:")
            stats = result.get("stats", {})
            for key, value in stats.items():
                print(f"  {key}: {value}")

            print(f"\nBottlenecks ({len(result.get('bottlenecks', []))}):")
            for i, bottleneck in enumerate(result.get("bottlenecks", [])[:5], 1):
                print(f"  {i}. {bottleneck['step']}: {bottleneck['duration']:.3f}s")

            if len(result.get("bottlenecks", [])) > 5:
                print(f"  ... and {len(result.get('bottlenecks', [])) - 5} more")

            print(f"\nRecommendations ({len(result.get('recommendations', []))}):")
            for i, recommendation in enumerate(result.get("recommendations", []), 1):
                print(f"  {i}. {recommendation}")

            print("\nFor complete details, check the log file.")

        # Output JSON if requested
        if args.json:
            import json

            print(json.dumps(result, indent=2))

        return 0

    except Exception as e:
        print(f"Error running diagnostic: {e}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
