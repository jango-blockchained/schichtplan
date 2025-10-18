#!/usr/bin/env python3
"""
Test Output Summarizer for Schichtplan Project

This script runs pytest and provides a concise summary of test results,
focusing on failures and key issues to reduce token consumption when
sharing with AI assistants.
"""

import re
import subprocess
import sys
from pathlib import Path
from typing import Dict, Tuple


def run_pytest() -> Tuple[str, int]:
    """Run pytest and return output and exit code."""
    try:
        result = subprocess.run(
            [sys.executable, "-m", "pytest", "-v"],
            capture_output=True,
            text=True,
            cwd=Path(__file__).parent,
        )
        return result.stdout + result.stderr, result.returncode
    except Exception as e:
        return f"Error running pytest: {e}", 1


def parse_test_output(output: str) -> Dict:
    """Parse pytest output and extract key information."""
    summary = {
        "total_tests": 0,
        "passed": 0,
        "failed": 0,
        "skipped": 0,
        "errors": 0,
        "warnings": 0,
        "failed_tests": [],
        "error_tests": [],
        "key_warnings": [],
        "deprecation_warnings": [],
        "runtime_warnings": [],
        "sqlalchemy_warnings": [],
        "pydantic_warnings": [],
    }

    lines = output.split("\n")

    # Parse final summary line
    for line in reversed(lines):
        if "failed," in line and "passed" in line:
            match = re.search(
                r"(\d+)\s+failed,\s+(\d+)\s+passed,\s+(\d+)\s+skipped", line
            )
            if match:
                summary["failed"] = int(match.group(1))
                summary["passed"] = int(match.group(2))
                summary["skipped"] = int(match.group(3))
                summary["total_tests"] = (
                    summary["failed"] + summary["passed"] + summary["skipped"]
                )
            break

    # Count errors separately
    error_count = 0
    for line in lines:
        if line.startswith("ERROR "):
            error_count += 1
    summary["errors"] = error_count

    # Extract failed tests
    current_test = None
    current_error = []
    in_error = False

    for line in lines:
        # Start of a failed test
        if line.startswith("FAILED ") or line.startswith("ERROR "):
            if current_test and current_error:
                summary["failed_tests"].append(
                    {"test": current_test, "error": "\n".join(current_error)}
                )
            current_test = line.strip()
            current_error = []
            in_error = True
        elif in_error and (
            line.startswith(" ") or line.startswith("\t") or not line.strip()
        ):
            current_error.append(line)
        elif in_error and (
            line.startswith("PASSED")
            or line.startswith("SKIPPED")
            or line.startswith("=")
        ):
            in_error = False
            if current_test and current_error:
                summary["failed_tests"].append(
                    {"test": current_test, "error": "\n".join(current_error)}
                )
            current_test = None
            current_error = []

    # Handle last test if still in error
    if current_test and current_error:
        summary["failed_tests"].append(
            {"test": current_test, "error": "\n".join(current_error)}
        )

    # Extract warnings
    warning_patterns = [
        (
            "deprecation_warnings",
            r"PydanticDeprecatedSince20|DeprecationWarning|LegacyAPIWarning",
        ),
        ("runtime_warnings", r"RuntimeWarning"),
        ("sqlalchemy_warnings", r"SAWarning|LegacyAPIWarning.*SQLAlchemy"),
        ("pydantic_warnings", r"PydanticDeprecatedSince20|PydanticV1|PydanticV2"),
    ]

    for line in lines:
        if "warnings" in line.lower():
            summary["warnings"] += 1

        for warning_type, pattern in warning_patterns:
            if re.search(pattern, line):
                if line not in summary[warning_type]:
                    summary[warning_type].append(line.strip())

    return summary


def print_summary(summary: Dict):
    """Print a concise summary of test results."""
    print("=" * 60)
    print("PYTEST SUMMARY")
    print("=" * 60)

    print(f"Total Tests: {summary['total_tests']}")
    print(f"Passed: {summary['passed']}")
    print(f"Failed: {summary['failed']}")
    print(f"Skipped: {summary['skipped']}")
    print(f"Errors: {summary['errors']}")
    print(f"Warnings: {summary['warnings']}")
    print()

    if summary["failed_tests"]:
        print("FAILED TESTS:")
        print("-" * 40)
        for i, test_info in enumerate(
            summary["failed_tests"][:10], 1
        ):  # Limit to first 10
            print(f"{i}. {test_info['test']}")
            # Print first few lines of error
            error_lines = test_info["error"].split("\n")[:5]
            for line in error_lines:
                if line.strip():
                    print(f"   {line}")
            print()
        if len(summary["failed_tests"]) > 10:
            print(f"... and {len(summary['failed_tests']) - 10} more failed tests")
        print()

    if summary["deprecation_warnings"]:
        print("KEY DEPRECATION WARNINGS:")
        print("-" * 40)
        for warning in summary["deprecation_warnings"][:5]:
            print(f"• {warning}")
        if len(summary["deprecation_warnings"]) > 5:
            print(f"... and {len(summary['deprecation_warnings']) - 5} more")
        print()

    if summary["runtime_warnings"]:
        print("RUNTIME WARNINGS:")
        print("-" * 40)
        for warning in summary["runtime_warnings"][:5]:
            print(f"• {warning}")
        if len(summary["runtime_warnings"]) > 5:
            print(f"... and {len(summary['runtime_warnings']) - 5} more")
        print()

    if summary["sqlalchemy_warnings"]:
        print("SQLALCHEMY ISSUES:")
        print("-" * 40)
        for warning in summary["sqlalchemy_warnings"][:5]:
            print(f"• {warning}")
        if len(summary["sqlalchemy_warnings"]) > 5:
            print(f"... and {len(summary['sqlalchemy_warnings']) - 5} more")
        print()

    if summary["pydantic_warnings"]:
        print("PYDANTIC ISSUES:")
        print("-" * 40)
        for warning in summary["pydantic_warnings"][:5]:
            print(f"• {warning}")
        if len(summary["pydantic_warnings"]) > 5:
            print(f"... and {len(summary['pydantic_warnings']) - 5} more")
        print()


def main():
    """Main function."""
    print("Running pytest and generating summary...")
    print()

    output, exit_code = run_pytest()
    summary = parse_test_output(output)

    print_summary(summary)

    print("=" * 60)
    print(f"Exit Code: {exit_code}")
    print("=" * 60)

    return exit_code


if __name__ == "__main__":
    sys.exit(main())
