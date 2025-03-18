#!/usr/bin/env python
"""
Script to check the current shifts in the database
"""

import os
import sys

# Add current directory to path
sys.path.insert(0, os.path.abspath("."))

from src.backend.app import create_app
from src.backend.models import ShiftTemplate, Coverage


def main():
    app = create_app()
    with app.app_context():
        print("\n=== Current Shifts in Database ===")
        shifts = ShiftTemplate.query.all()
        for shift in shifts:
            print(
                f"ID: {shift.id}, Time: {shift.start_time}-{shift.end_time}, Type: {shift.shift_type.value if shift.shift_type else None}"
            )

        print("\n=== Coverage Requirements ===")
        coverage = Coverage.query.all()
        for cov in coverage:
            print(
                f"Day {cov.day_index}, Time: {cov.start_time}-{cov.end_time}, Min: {cov.min_employees}, Keyholder: {cov.requires_keyholder}"
            )


if __name__ == "__main__":
    main()
