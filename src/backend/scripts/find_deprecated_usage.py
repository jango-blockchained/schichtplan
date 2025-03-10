#!/usr/bin/env python
"""
Script to search for and report usage of deprecated modules in the application logs.
This helps track which parts of the code are still using modules that are scheduled for removal.
"""

import os
import re
import argparse
from collections import defaultdict
from datetime import datetime, timedelta
import json

# Regular expressions for finding deprecation warnings
PATTERNS = {
    "schedule_generator": re.compile(
        r"DEPRECATED MODULE USED: schedule_generator imported from (?P<file>.+?):(?P<line>\d+)"
    ),
    "general_warning": re.compile(
        r"DeprecationWarning: The schedule_generator module is deprecated"
    ),
}


def scan_log_file(log_file, days=None):
    """Scan a log file for deprecation warnings"""
    results = defaultdict(list)
    count = 0

    if days:
        cutoff_date = datetime.now() - timedelta(days=days)
    else:
        cutoff_date = None

    print(f"Scanning {log_file}...")

    with open(log_file, "r", encoding="utf-8", errors="ignore") as f:
        for line_num, line in enumerate(f, 1):
            # Skip lines that are too old
            if cutoff_date and " - " in line:
                try:
                    parts = line.split(" - ", 1)
                    line_date = datetime.strptime(
                        parts[0].strip(), "%Y-%m-%d %H:%M:%S,%f"
                    )
                    if line_date < cutoff_date:
                        continue
                except (ValueError, IndexError):
                    pass

            # Check for each pattern
            for module, pattern in PATTERNS.items():
                match = pattern.search(line)
                if match:
                    count += 1
                    if "file" in match.groupdict() and "line" in match.groupdict():
                        file_path = match.group("file")
                        line_number = match.group("line")
                        key = f"{file_path}:{line_number}"
                        results[key].append(line_num)
                    else:
                        results["unspecified"].append(line_num)

    return {
        "file": log_file,
        "total_warnings": count,
        "locations": {k: len(v) for k, v in results.items()},
        "details": dict(results),
    }


def main():
    parser = argparse.ArgumentParser(
        description="Find usage of deprecated modules in logs"
    )
    parser.add_argument(
        "--logs-dir", default="src/logs", help="Directory containing log files"
    )
    parser.add_argument(
        "--days", type=int, help="Only consider logs from the last N days"
    )
    parser.add_argument("--output", help="Output file for the report (JSON format)")
    parser.add_argument("--verbose", action="store_true", help="Print detailed results")

    args = parser.parse_args()

    log_files = []
    for root, _, files in os.walk(args.logs_dir):
        for file in files:
            if file.endswith(".log"):
                log_files.append(os.path.join(root, file))

    if not log_files:
        print(f"No log files found in {args.logs_dir}")
        return

    all_results = {}
    total_warnings = 0

    for log_file in log_files:
        result = scan_log_file(log_file, args.days)
        all_results[log_file] = result
        total_warnings += result["total_warnings"]

        if args.verbose:
            print(f"\n{log_file}:")
            print(f"  Total warnings: {result['total_warnings']}")
            for location, count in result["locations"].items():
                print(f"  {location}: {count} occurrences")

    summary = {
        "scanned_files": len(log_files),
        "total_warnings": total_warnings,
        "most_frequent": [],
    }

    # Find the most frequent locations across all logs
    location_counts = defaultdict(int)
    for result in all_results.values():
        for location, count in result["locations"].items():
            location_counts[location] += count

    # Get top 10 most frequent locations
    top_locations = sorted(location_counts.items(), key=lambda x: x[1], reverse=True)[
        :10
    ]
    summary["most_frequent"] = [
        {"location": loc, "count": count} for loc, count in top_locations
    ]

    print("\nSummary:")
    print(f"Scanned {len(log_files)} log files")
    print(f"Found {total_warnings} total deprecation warnings")

    if top_locations:
        print("\nMost frequent usage locations:")
        for loc, count in top_locations:
            print(f"  {loc}: {count} occurrences")

    # Save to output file if specified
    if args.output:
        output = {"summary": summary, "details": all_results}
        with open(args.output, "w") as f:
            json.dump(output, f, indent=2)
        print(f"\nDetailed results saved to {args.output}")


if __name__ == "__main__":
    main()
