"""Configuration module for the scheduler."""

from typing import Dict, Any


class SchedulerConfig:
    """
    Configuration class for the scheduler.
    Contains all settings and constraints for schedule generation.
    """

    # Constants
    MAX_GROUP_UTILIZATION = 0.9  # Maximum utilization of employees in a group (90%)
    SHIFT_TYPE_CAPS = {
        "NIGHT": 3,  # Max 3 night shifts per week
        "EVENING": 4,  # Max 4 evening shifts per week
        "DAY": 5,  # Max 5 day shifts per week
    }

    def __init__(self, config_dict=None):
        # Default values
        self.max_consecutive_days = 5
        self.min_rest_hours = 11
        self.enforce_rest_periods = True
        self.max_hours_per_group = {
            "FULL_TIME": 40,
            "PART_TIME": 25,
            "STUDENT": 20,
            "INTERN": 15,
        }
        self.max_consecutive_night_shifts = 3
        self.employee_types = [
            {
                "id": "FULL_TIME",
                "max_weekly_hours": 40,
                "min_weekly_hours": 35,
                "max_daily_hours": 8,
                "priority": 1,
            },
            {
                "id": "PART_TIME",
                "max_weekly_hours": 25,
                "min_weekly_hours": 15,
                "max_daily_hours": 8,
                "priority": 2,
            },
            {
                "id": "STUDENT",
                "max_weekly_hours": 20,
                "min_weekly_hours": 8,
                "max_daily_hours": 8,
                "priority": 3,
            },
            {
                "id": "INTERN",
                "max_weekly_hours": 15,
                "min_weekly_hours": 10,
                "max_daily_hours": 6,
                "priority": 4,
            },
        ]
        self.keyholder_requirements = {
            "DAY": 1,
            "EVENING": 1,
            "NIGHT": 1,
        }
        self.max_shifts_per_day = 2  # Maximum number of shifts per day for any employee

        # Update with provided config if any
        if config_dict:
            self.update_from_dict(config_dict)

    def update_from_dict(self, config_dict: Dict[str, Any]):
        """Update configuration from a dictionary"""
        for key, value in config_dict.items():
            if hasattr(self, key):
                setattr(self, key, value)

    def get_max_hours(self, employee_group: str) -> int:
        """Get maximum weekly hours for an employee group"""
        if employee_group in self.max_hours_per_group:
            return self.max_hours_per_group[employee_group]

        # Default to full-time hours if group not found
        return self.max_hours_per_group.get("FULL_TIME", 40)

    def get_employee_type_config(self, employee_group: str) -> Dict[str, Any]:
        """Get configuration for a specific employee type"""
        for employee_type in self.employee_types:
            if employee_type["id"] == employee_group:
                return employee_type

        # Return default full-time config if not found
        return next(
            (et for et in self.employee_types if et["id"] == "FULL_TIME"),
            self.employee_types[0] if self.employee_types else {},
        )

    def get_shift_cap(self, shift_type: str) -> int:
        """Get the maximum number of shifts of a specific type per week"""
        return self.SHIFT_TYPE_CAPS.get(shift_type, 5)  # Default to 5 if not specified

    def to_dict(self) -> Dict[str, Any]:
        """Convert configuration to dictionary"""
        return {
            "max_consecutive_days": self.max_consecutive_days,
            "min_rest_hours": self.min_rest_hours,
            "enforce_rest_periods": self.enforce_rest_periods,
            "max_hours_per_group": self.max_hours_per_group,
            "max_consecutive_night_shifts": self.max_consecutive_night_shifts,
            "employee_types": self.employee_types,
            "keyholder_requirements": self.keyholder_requirements,
            "max_shifts_per_day": self.max_shifts_per_day,
        }
