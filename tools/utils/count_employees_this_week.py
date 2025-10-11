#!/usr/bin/env python3
"""Print the number of employees scheduled to work this week (latest version).

This uses the app's configured week start (Monday/Sunday) and counts distinct
employees with a non-empty shift in the current week's latest schedule version.
"""

from datetime import date

from src.backend.api.schedules import _calc_week_bounds
from src.backend.app import create_app
from src.backend.models import Schedule, db


def main() -> None:
    app = create_app()
    with app.app_context():
        today = date.today()
        start, end = _calc_week_bounds(today)

        # Find latest version within this week
        versions = (
            db.session.query(Schedule.version)
            .filter(Schedule.date >= start, Schedule.date <= end)
            .distinct()
            .order_by(Schedule.version.desc())
            .all()
        )
        if not versions:
            print(0)
            return
        latest_version = versions[0][0]

        # Count distinct employees with an actual shift (shift_id not null)
        emp_ids = (
            db.session.query(Schedule.employee_id)
            .filter(
                Schedule.version == latest_version,
                Schedule.date >= start,
                Schedule.date <= end,
                Schedule.shift_id.isnot(None),
            )
            .distinct()
            .all()
        )
        print(len(emp_ids))


if __name__ == "__main__":
    main()
