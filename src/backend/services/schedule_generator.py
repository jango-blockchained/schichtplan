from datetime import datetime, timedelta, date
from typing import List, Dict, Any
from models import (
    Employee,
    ShiftTemplate,
    Schedule,
    Settings,
    EmployeeAvailability,
    Coverage,
    db,
    Absence,
)
from models.employee import AvailabilityType, EmployeeGroup
from flask import current_app
from utils.logger import logger
import os
from collections import defaultdict
import uuid


class ScheduleGenerationError(Exception):
    """Custom exception for schedule generation errors"""

    pass


def is_early_shift(shift):
    """Check if a shift starts early in the morning (before 8:00)"""
    start_hour = int(shift.start_time.split(":")[0])
    return start_hour < 8


def is_late_shift(shift):
    """Check if a shift ends late in the evening (after 18:00)"""
    end_hour = int(shift.end_time.split(":")[0])
    return end_hour >= 18


def requires_keyholder(shift):
    """Check if a shift requires a keyholder (early or late shifts)"""
    return is_early_shift(shift) or is_late_shift(shift)


class ScheduleResources:
    """Container for all resources needed in schedule generation"""

    def __init__(self):
        logger.app_logger.info("Initializing schedule resources")
        self.settings = None
        self.opening_days_hours = None
        self.coverage_data = None
        self.employees = None
        self.absence_data = None
        self.availability_data = None
        self.shifts = None

    def load_resources(self):
        """Load all resources from the database. Must be called within app context."""
        if not current_app:
            raise ScheduleGenerationError("No Flask application context")

        logger.app_logger.info("Loading schedule resources")

        # Load settings
        self.settings = Settings.query.first()
        if not self.settings:
            logger.error_logger.error("No settings found")
            raise ScheduleGenerationError("No settings found")

        # Store opening hours
        self.opening_days_hours = {
            "opening_time": self.settings.store_opening,
            "closing_time": self.settings.store_closing,
            "opening_days": self.settings.opening_days,
        }

        # Load coverage requirements
        self.coverage_data = Coverage.query.all()
        logger.schedule_logger.debug(
            f"Loaded {len(self.coverage_data)} coverage requirements"
        )

        # Load shifts
        self.shifts = ShiftTemplate.query.all()
        logger.schedule_logger.debug(f"Loaded {len(self.shifts)} shifts")

        # Load employees ordered by type: TL, VZ, TZ, GFB
        self.employees = (
            Employee.query.filter_by(is_active=True)
            .order_by(
                db.case(
                    (Employee.employee_group == EmployeeGroup.TL.value, 1),
                    (Employee.employee_group == EmployeeGroup.VZ.value, 2),
                    (Employee.employee_group == EmployeeGroup.TZ.value, 3),
                    (Employee.employee_group == EmployeeGroup.GFB.value, 4),
                )
            )
            .all()
        )
        logger.schedule_logger.debug(f"Loaded {len(self.employees)} active employees")

        # Load absence data
        self.absence_data = EmployeeAvailability.query.filter_by(
            availability_type=AvailabilityType.UNAVAILABLE.value
        ).all()
        logger.schedule_logger.debug(f"Loaded {len(self.absence_data)} absence records")

        # Load availability data
        self.availability_data = EmployeeAvailability.query.filter(
            EmployeeAvailability.availability_type.in_(
                [
                    AvailabilityType.AVAILABLE.value,
                    AvailabilityType.FIXED.value,
                    AvailabilityType.PROMISE.value,
                ]
            )
        ).all()
        logger.schedule_logger.debug(
            f"Loaded {len(self.availability_data)} availability records"
        )


class ScheduleGenerator:
    """Service for generating work schedules following the defined hierarchy"""

    def __init__(self):
        logger.schedule_logger.info("Initializing ScheduleGenerator")
        self.resources = ScheduleResources()
        self.schedule_cache: Dict[str, List[Schedule]] = {}
        self.generation_errors: List[Dict[str, Any]] = []

    def process_absences(self):
        """Process all absences and mark employees as unavailable"""
        logger.schedule_logger.debug("Processing absences")
        for absence in self.resources.absence_data:
            logger.schedule_logger.debug(
                f"Processing absence for employee {absence.employee_id} "
                f"from {absence.start_date} to {absence.end_date}"
            )
            self._add_absence(
                employee_id=absence.employee_id,
                start_date=absence.start_date,
                end_date=absence.end_date,
            )

    def process_fix_availability(self):
        """Process fixed availability slots"""
        logger.schedule_logger.debug("Processing fixed availabilities")
        for employee in self.resources.employees:
            fix_slots = [
                a
                for a in self.resources.availability_data
                if a.employee_id == employee.id
                and a.availability_type == AvailabilityType.FIXED
            ]
            logger.schedule_logger.debug(
                f"Processing {len(fix_slots)} fixed slots for employee {employee.id}"
            )
            for slot in fix_slots:
                self._add_availability(
                    employee_id=employee.id,
                    start_date=slot.start_date,
                    end_date=slot.end_date,
                    start_time=f"{slot.hour:02d}:00",
                    end_time=f"{(slot.hour + 1):02d}:00",
                )

    def fill_open_slots(self, start_date: date, end_date: date):
        """Fill open slots based on coverage requirements with enhanced logging"""
        logger.schedule_logger.info(
            f"Starting slot filling for period {start_date} to {end_date}",
            extra={
                "action": "fill_slots_start",
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
            },
        )

        current_date = start_date
        while current_date <= end_date:
            if not self._is_store_open(current_date):
                logger.schedule_logger.debug(
                    f"Skipping closed day: {current_date}",
                    extra={
                        "action": "skip_closed_day",
                        "date": current_date.isoformat(),
                    },
                )
                current_date += timedelta(days=1)
                continue

            logger.schedule_logger.info(
                f"Processing date: {current_date}",
                extra={"action": "process_date", "date": current_date.isoformat()},
            )

            for coverage in self.resources.coverage_data:
                logger.schedule_logger.debug(
                    f"Processing coverage requirement: {coverage.start_time}-{coverage.end_time} "
                    f"(min: {coverage.min_employees}, max: {coverage.max_employees})",
                    extra={
                        "action": "process_coverage",
                        "start_time": coverage.start_time,
                        "end_time": coverage.end_time,
                        "min_employees": coverage.min_employees,
                        "max_employees": coverage.max_employees,
                        "requires_keyholder": coverage.requires_keyholder,
                    },
                )

                candidates = self._get_available_employees(
                    date=current_date,
                    start_time=coverage.start_time,
                    end_time=coverage.end_time,
                )

                logger.schedule_logger.debug(
                    f"Found {len(candidates)} potential candidates for {coverage.start_time}-{coverage.end_time}",
                    extra={
                        "action": "candidates_found",
                        "candidate_count": len(candidates),
                        "candidates": [
                            f"{c.first_name} {c.last_name}" for c in candidates
                        ],
                    },
                )

                # Special handling for TZ and GFB employees
                filtered_candidates = []
                for employee in candidates:
                    if employee.employee_group in [EmployeeGroup.TZ, EmployeeGroup.GFB]:
                        if self._check_tz_gfb_constraints(
                            employee, current_date, coverage
                        ):
                            filtered_candidates.append(employee)
                            logger.schedule_logger.debug(
                                f"TZ/GFB employee {employee.first_name} {employee.last_name} passed constraints"
                            )
                        else:
                            logger.schedule_logger.debug(
                                f"TZ/GFB employee {employee.first_name} {employee.last_name} failed constraints"
                            )
                    else:
                        filtered_candidates.append(employee)

                logger.schedule_logger.debug(
                    f"After TZ/GFB filtering: {len(filtered_candidates)} candidates remain"
                )

                self._assign_employees_to_slot(
                    date=current_date, coverage=coverage, candidates=filtered_candidates
                )

            current_date += timedelta(days=1)

        logger.schedule_logger.info(
            "Slot filling completed", extra={"action": "fill_slots_complete"}
        )

    def _check_tz_gfb_constraints(
        self, employee: Employee, date: date, coverage
    ) -> bool:
        """Check constraints for TZ and GFB employees"""
        # Max 6 hours per day
        daily_hours = self._get_employee_hours(employee, date)
        if daily_hours + coverage.duration > 6:
            return False

        # Only morning (08:30-14:00) or day/evening (14:00-20:00) shifts
        start_hour = int(coverage.start_time.split(":")[0])
        start_min = int(coverage.start_time.split(":")[1])
        end_hour = int(coverage.end_time.split(":")[0])

        is_morning_shift = (
            (start_hour == 8 and start_min >= 30) or start_hour == 9
        ) and end_hour == 14
        is_evening_shift = start_hour == 14 and end_hour == 20

        return is_morning_shift or is_evening_shift

    def verify_goals(self):
        """Verify that all scheduling goals are met"""
        logger.schedule_logger.info("=== Verifying Scheduling Goals ===")

        # 1. Verify minimum coverage
        logger.schedule_logger.info("Checking minimum coverage requirements...")
        coverage_issues = self._verify_minimum_coverage()
        if coverage_issues:
            for issue in coverage_issues:
                self.generation_errors.append(
                    {
                        "type": "error",
                        "message": f"Coverage requirement not met: {issue['message']}",
                        "date": issue["date"].strftime("%Y-%m-%d"),
                        "time": f"{issue['start_time']}-{issue['end_time']}",
                        "required": issue["required"],
                        "assigned": issue["assigned"],
                    }
                )
                logger.schedule_logger.warning(
                    f"Coverage issue on {issue['date']}: {issue['message']}"
                )

        # 2. Verify exact hours for VZ and TZ
        logger.schedule_logger.info("Checking contracted hours...")
        hours_issues = self._verify_exact_hours()
        if hours_issues:
            for issue in hours_issues:
                self.generation_errors.append(
                    {
                        "type": "warning",
                        "message": f"Hours requirement not met: {issue['message']}",
                        "employee": issue["employee_name"],
                        "employee_group": issue["employee_group"],
                        "required_hours": issue["required_hours"],
                        "actual_hours": issue["actual_hours"],
                    }
                )
                logger.schedule_logger.warning(
                    f"Hours issue for {issue['employee_name']}: {issue['message']}"
                )

        # 3. Verify keyholder coverage
        logger.schedule_logger.info("Checking keyholder coverage...")
        keyholder_issues = self._verify_keyholder_coverage()
        if keyholder_issues:
            for issue in keyholder_issues:
                self.generation_errors.append(
                    {
                        "type": "error",
                        "message": f"Keyholder requirement not met: {issue['message']}",
                        "date": issue["date"].strftime("%Y-%m-%d"),
                        "time": f"{issue['start_time']}-{issue['end_time']}",
                    }
                )
                logger.schedule_logger.warning(
                    f"Keyholder issue on {issue['date']}: {issue['message']}"
                )

        # 4. Verify rest periods
        logger.schedule_logger.info("Checking rest periods...")
        rest_issues = self._verify_rest_periods()
        if rest_issues:
            for issue in rest_issues:
                self.generation_errors.append(
                    {
                        "type": "error",
                        "message": f"Rest period violation: {issue['message']}",
                        "employee": issue["employee_name"],
                        "date": issue["date"].strftime("%Y-%m-%d"),
                    }
                )
                logger.schedule_logger.warning(
                    f"Rest period issue for {issue['employee_name']} on {issue['date']}: {issue['message']}"
                )

        # Log verification summary
        error_count = len([e for e in self.generation_errors if e["type"] == "error"])
        warning_count = len(
            [e for e in self.generation_errors if e["type"] == "warning"]
        )

        if error_count == 0 and warning_count == 0:
            logger.schedule_logger.info("All scheduling goals verified successfully!")
        else:
            logger.schedule_logger.warning(
                f"Schedule verification completed with {error_count} errors and {warning_count} warnings"
            )

    def generate_schedule(
        self, start_date, end_date, create_empty_schedules=False, session_id=None
    ):
        """Generate a schedule for a date range"""
        schedules = []
        errors = []

        # Start logging with session ID for tracking
        if session_id is None:
            session_id = str(uuid.uuid4())

        # Store the session ID as an instance variable for use in other methods
        self.session_id = session_id

        # Create a session-specific logger and store it as an instance variable
        self.session_logger = logger.create_session_logger(session_id)

        # Log the start of the generation process
        self._log_detailed_info(
            f"Starting schedule generation session {session_id}",
            "generation_start",
            session_id,
            start_date=start_date.isoformat(),
            end_date=end_date.isoformat(),
            create_empty_schedules=create_empty_schedules,
        )

        try:
            # Get all employees
            employees = Employee.query.filter_by(is_active=True).all()
            if not employees:
                error_msg = "No active employees found"
                self._log_detailed_error(
                    error_msg,
                    "generation_error",
                    session_id,
                    error_type="no_employees",
                )
                errors.append({"type": "critical", "message": error_msg})
                return [], errors

            self._log_detailed_info(
                f"Found {len(employees)} active employees",
                "employees_found",
                session_id,
                employee_count=len(employees),
                employee_ids=[e.id for e in employees],
            )

            # Get the placeholder shift for empty schedules
            placeholder_shift = ShiftTemplate.query.filter_by(
                start_time="00:00", end_time="00:00"
            ).first()
            if not placeholder_shift and create_empty_schedules:
                self._log_detailed_info(
                    "Creating placeholder shift for empty schedules",
                    "create_placeholder",
                    session_id,
                )
                placeholder_shift = ShiftTemplate(
                    name="Empty",
                    start_time="00:00",
                    end_time="00:00",
                    color="#FFFFFF",
                    description="Placeholder for empty schedules",
                )
                db.session.add(placeholder_shift)
                db.session.commit()

            # Get all absences for the period
            absences = Absence.query.filter(
                Absence.start_date <= end_date, Absence.end_date >= start_date
            ).all()

            self._log_detailed_info(
                f"Found {len(absences)} absences in the period",
                "absences_found",
                session_id,
                absence_count=len(absences),
            )

            # Create a dict of employee absences for quick lookup
            employee_absences = defaultdict(list)
            for absence in absences:
                employee_absences[absence.employee_id].append(absence)

            # Process each day in the date range
            current_date = start_date
            day_count = 0

            while current_date <= end_date:
                day_count += 1
                self._log_detailed_info(
                    f"Processing day {day_count}: {current_date.isoformat()}",
                    "process_day",
                    session_id,
                    day=current_date.isoformat(),
                    day_count=day_count,
                )

                # For each employee
                for employee in employees:
                    # Check if employee is absent
                    is_absent = False
                    for absence in employee_absences[employee.id]:
                        if absence.start_date <= current_date <= absence.end_date:
                            is_absent = True
                            break

                    if is_absent:
                        self._log_detailed_debug(
                            f"Employee {employee.id} is absent on {current_date.isoformat()}",
                            "employee_absent",
                            session_id,
                            employee_id=employee.id,
                            date=current_date.isoformat(),
                        )
                        if create_empty_schedules:
                            # Create an empty schedule for absent employees
                            schedule = Schedule(
                                employee_id=employee.id,
                                shift_id=placeholder_shift.id,
                                date=current_date,
                                notes="Absent",
                            )
                            schedules.append(schedule)
                        continue

                    # Get employee's preferred shifts for this day
                    preferred_shifts = self._get_preferred_shifts(
                        employee, current_date
                    )

                    if not preferred_shifts:
                        self._log_detailed_debug(
                            f"No preferred shifts for employee {employee.id} on {current_date.isoformat()}",
                            "no_preferred_shifts",
                            session_id,
                            employee_id=employee.id,
                            date=current_date.isoformat(),
                        )
                        if create_empty_schedules:
                            # Create an empty schedule when no preferred shifts
                            schedule = Schedule(
                                employee_id=employee.id,
                                shift_id=placeholder_shift.id,
                                date=current_date,
                                notes="No preferred shifts",
                            )
                            schedules.append(schedule)
                        continue

                    # Create schedule with first preferred shift
                    self._log_detailed_info(
                        f"Assigning employee {employee.id} to shift {preferred_shifts[0].id} on {current_date.isoformat()}",
                        "assign_shift",
                        session_id,
                        employee_id=employee.id,
                        shift_id=preferred_shifts[0].id,
                        date=current_date.isoformat(),
                        shift_start=preferred_shifts[0].start_time,
                        shift_end=preferred_shifts[0].end_time,
                    )
                    schedule = Schedule(
                        employee_id=employee.id,
                        shift_id=preferred_shifts[0].id,
                        date=current_date,
                    )
                    schedules.append(schedule)

                current_date += timedelta(days=1)

            self._log_detailed_info(
                f"Schedule generation completed successfully. Created {len(schedules)} schedules",
                "generation_complete",
                session_id,
                schedule_count=len(schedules),
                error_count=len(errors),
            )

            return schedules, errors

        except Exception as e:
            import traceback

            tb = traceback.format_exc()

            error_msg = f"Schedule generation error: {str(e)}"
            self._log_detailed_error(
                error_msg,
                "generation_error",
                session_id,
                error=str(e),
                error_type=type(e).__name__,
                traceback=tb,
            )
            errors.append({"type": "critical", "message": error_msg})
            return [], errors

    # Helper methods (implementation details) below...
    def _add_absence(self, employee_id: int, start_date: date, end_date: date):
        """Mark an employee as absent for the given timespan"""
        pass  # Implementation details...

    def _add_availability(
        self,
        employee_id: int,
        start_date: date,
        end_date: date,
        start_time: str,
        end_time: str,
    ):
        """Add an availability slot for an employee"""
        pass  # Implementation details...

    def _has_valid_duration(self, shift):
        """
        Check if a shift has a valid duration (greater than 0).

        Args:
            shift: The shift to check

        Returns:
            bool: True if the shift has a valid duration, False otherwise
        """
        if shift.duration_hours <= 0:
            logger.schedule_logger.warning(
                f"Filtering out shift {shift.id} ({shift.start_time}-{shift.end_time}) with invalid duration: {shift.duration_hours}h"
            )
            logger.schedule_logger.warning(
                f"Shift details - min_employees: {shift.min_employees}, max_employees: {shift.max_employees}"
            )
            return False
        return True

    def _get_available_employees(
        self, date: date, start_time: str, end_time: str
    ) -> List[Employee]:
        """Get list of available employees for a given time slot"""
        available_employees = []

        logger.schedule_logger.debug(
            f"Finding available employees for {date} {start_time}-{end_time}"
        )

        # Get the shift template for this time slot
        shift = next(
            (
                s
                for s in self.resources.shifts
                if s.start_time == start_time and s.end_time == end_time
            ),
            None,
        )

        if not shift:
            logger.error_logger.error(
                f"No shift template found for {start_time}-{end_time}"
            )
            return []

        logger.schedule_logger.debug(
            f"Found shift template: {shift.id} ({shift.start_time}-{shift.end_time}, duration: {shift.duration_hours}h)"
        )

        # Check if shift has valid duration
        if not self._has_valid_duration(shift):
            logger.schedule_logger.error(
                f"Skipping employee assignment for shift with invalid duration: {shift.id}"
            )
            return []

        for employee in self.resources.employees:
            logger.schedule_logger.debug(
                f"Checking employee {employee.id} ({employee.first_name} {employee.last_name})"
            )

            # Skip if employee has exceeded weekly hours
            week_start = date - timedelta(days=date.weekday())
            current_hours = self._get_employee_hours(employee, week_start)

            logger.schedule_logger.debug(
                f"Employee {employee.id} current hours: {current_hours}, contracted: {employee.contracted_hours}"
            )

            if current_hours is not None and shift.duration_hours is not None:
                if current_hours + shift.duration_hours > employee.contracted_hours:
                    logger.schedule_logger.debug(
                        f"Employee {employee.id} would exceed contracted hours, skipping"
                    )
                    continue

            # Check if employee is available for this time slot
            is_available = self._check_availability(
                employee, date, start_time, end_time
            )
            logger.schedule_logger.debug(
                f"Employee {employee.id} availability check: {is_available}"
            )

            if is_available:
                # Check if employee has enough rest time
                has_rest = self._has_enough_rest_time(employee, shift, date)
                logger.schedule_logger.debug(
                    f"Employee {employee.id} rest time check: {has_rest}"
                )

                if has_rest:
                    # Check if employee hasn't exceeded max shifts per week
                    exceeds_shifts = self._exceeds_max_shifts(employee, date)
                    logger.schedule_logger.debug(
                        f"Employee {employee.id} max shifts check: {not exceeds_shifts}"
                    )

                    if not exceeds_shifts:
                        available_employees.append(employee)
                        logger.schedule_logger.debug(
                            f"Employee {employee.id} is available and added to candidates"
                        )

        logger.schedule_logger.debug(
            f"Found {len(available_employees)} available employees for {date} {start_time}-{end_time}"
        )
        return available_employees

    def _assign_employees_to_slot(
        self, date: date, coverage: Coverage, candidates: List[Employee]
    ):
        """Assign employees to a coverage slot"""
        logger.schedule_logger.debug(
            f"Assigning employees for {date} {coverage.start_time}-{coverage.end_time}"
        )

        # Get the shift template for this coverage
        shift = next(
            (s for s in self.resources.shifts if s.id == coverage.shift_id),
            None,
        )
        if not shift:
            logger.error_logger.error(f"No shift found for coverage {coverage.id}")
            return

        # Sort candidates by priority (keyholders first if required)
        if coverage.requires_keyholder:
            candidates.sort(key=lambda e: not e.is_keyholder)

        # Filter out candidates who already have shifts this day
        filtered_candidates = []
        for candidate in candidates:
            existing_schedule = Schedule.query.filter(
                Schedule.employee_id == candidate.id,
                Schedule.date == date,
            ).first()
            if not existing_schedule or (
                existing_schedule.shift
                and existing_schedule.shift.start_time == "00:00"
            ):
                filtered_candidates.append(candidate)
                if (
                    existing_schedule
                    and existing_schedule.shift
                    and existing_schedule.shift.start_time == "00:00"
                ):
                    # Delete the placeholder schedule
                    db.session.delete(existing_schedule)
                    try:
                        db.session.commit()
                        logger.schedule_logger.debug(
                            f"Deleted placeholder schedule for {candidate.first_name} {candidate.last_name} on {date}"
                        )
                    except Exception as e:
                        logger.error_logger.error(
                            f"Failed to delete placeholder schedule: {str(e)}"
                        )
                        db.session.rollback()
        candidates = filtered_candidates

        # Filter out candidates who would exceed their weekly hours
        week_start = date - timedelta(days=date.weekday())
        filtered_candidates = []
        for candidate in candidates:
            current_hours = self._get_employee_hours(candidate, week_start)
            if current_hours is not None and shift.duration_hours is not None:
                if current_hours + shift.duration_hours <= candidate.contracted_hours:
                    filtered_candidates.append(candidate)
        candidates = filtered_candidates

        # Filter out candidates who don't have enough rest time
        filtered_candidates = []
        for candidate in candidates:
            if self._has_enough_rest_time(candidate, shift, date):
                filtered_candidates.append(candidate)
        candidates = filtered_candidates

        # Try to assign required number of employees
        assigned_count = 0
        for candidate in candidates:
            if assigned_count >= coverage.max_employees:
                break

            # Create the schedule
            schedule = Schedule(
                employee_id=candidate.id, date=date, shift_id=shift.id, version=1
            )
            db.session.add(schedule)
            try:
                db.session.commit()
                assigned_count += 1
                logger.schedule_logger.info(
                    f"Assigned {candidate.first_name} {candidate.last_name} to shift on {date}"
                )
            except Exception as e:
                logger.error_logger.error(
                    f"Failed to assign {candidate.first_name} {candidate.last_name}: {str(e)}"
                )
                db.session.rollback()

        # Log if minimum coverage not met
        if assigned_count < coverage.min_employees:
            self.generation_errors.append(
                {
                    "type": "error",
                    "message": f"Coverage requirement not met: Need {coverage.min_employees} employees, only {assigned_count} assigned",
                    "date": date.strftime("%Y-%m-%d"),
                    "time": f"{coverage.start_time}-{coverage.end_time}",
                    "required": coverage.min_employees,
                    "assigned": assigned_count,
                }
            )

    def _verify_minimum_coverage(self) -> List[Dict[str, Any]]:
        """Verify that minimum coverage requirements are met"""
        issues = []
        for date in self._get_date_range():
            for coverage in self.resources.coverage_data:
                assigned = len(
                    self._get_employees_for_time(
                        date, coverage.start_time, coverage.end_time
                    )
                )
                if assigned < coverage.min_employees:
                    issues.append(
                        {
                            "date": date,
                            "start_time": coverage.start_time,
                            "end_time": coverage.end_time,
                            "required": coverage.min_employees,
                            "assigned": assigned,
                            "message": f"Need {coverage.min_employees} employees, only {assigned} assigned",
                        }
                    )
        return issues

    def _verify_exact_hours(self) -> List[Dict[str, Any]]:
        """Verify that VZ and TZ employees have exact required hours"""
        issues = []
        for employee in self.resources.employees:
            if employee.employee_group in [EmployeeGroup.VZ, EmployeeGroup.TZ]:
                total_hours = self._get_employee_total_hours(employee)
                if (
                    abs(total_hours - employee.contracted_hours) > 0.5
                ):  # 30 minutes tolerance
                    issues.append(
                        {
                            "employee_name": f"{employee.first_name} {employee.last_name}",
                            "employee_group": employee.employee_group,
                            "required_hours": employee.contracted_hours,
                            "actual_hours": total_hours,
                            "message": f"Scheduled {total_hours:.1f}h vs contracted {employee.contracted_hours}h",
                        }
                    )
        return issues

    def _verify_keyholder_coverage(self) -> List[Dict[str, Any]]:
        """Verify that all early/late shifts have a keyholder"""
        issues = []
        for date in self._get_date_range():
            schedules = Schedule.query.filter_by(date=date).all()
            for schedule in schedules:
                if schedule.shift and requires_keyholder(schedule.shift):
                    has_keyholder = any(
                        s.employee.is_keyholder
                        for s in schedules
                        if s.shift_id == schedule.shift_id
                    )
                    if not has_keyholder:
                        issues.append(
                            {
                                "date": date,
                                "start_time": schedule.shift.start_time,
                                "end_time": schedule.shift.end_time,
                                "message": f"No keyholder assigned for {schedule.shift.start_time}-{schedule.shift.end_time}",
                            }
                        )
        return issues

    def _verify_rest_periods(self) -> List[Dict[str, Any]]:
        """Verify minimum rest periods between shifts"""
        issues = []
        for employee in self.resources.employees:
            schedules = (
                Schedule.query.filter_by(employee_id=employee.id)
                .order_by(Schedule.date)
                .all()
            )
            for i in range(len(schedules) - 1):
                if schedules[i].shift and schedules[i + 1].shift:
                    rest_hours = self._calculate_rest_hours(
                        schedules[i].date,
                        schedules[i].shift.end_time,
                        schedules[i + 1].date,
                        schedules[i + 1].shift.start_time,
                    )
                    if rest_hours < 11:
                        issues.append(
                            {
                                "employee_name": f"{employee.first_name} {employee.last_name}",
                                "date": schedules[i].date,
                                "message": f"Only {rest_hours:.1f}h rest between shifts (minimum 11h required)",
                            }
                        )
        return issues

    def _get_date_range(self) -> List[date]:
        """Get all dates in the current schedule period"""
        schedules = Schedule.query.order_by(Schedule.date).all()
        if not schedules:
            return []
        start_date = schedules[0].date
        end_date = schedules[-1].date
        dates = []
        current = start_date
        while current <= end_date:
            dates.append(current)
            current += timedelta(days=1)
        return dates

    def _get_employees_for_time(
        self, date: date, start_time: str, end_time: str
    ) -> List[Employee]:
        """Get all employees scheduled for a specific time slot"""
        schedules = Schedule.query.filter_by(date=date).all()
        return [
            schedule.employee
            for schedule in schedules
            if schedule.shift
            and self._shifts_overlap(
                schedule.shift.start_time, schedule.shift.end_time, start_time, end_time
            )
        ]

    def _get_employee_total_hours(self, employee: Employee) -> float:
        """Calculate total scheduled hours for an employee"""
        schedules = Schedule.query.filter_by(employee_id=employee.id).all()
        return sum(
            schedule.shift.duration_hours
            for schedule in schedules
            if schedule.shift and schedule.shift.duration_hours
        )

    def _calculate_rest_hours(self, end_time_str: str, start_time_str: str) -> float:
        """
        Calculate the number of rest hours between two shifts

        Args:
            end_time_str: The end time of the first shift (format: "HH:MM")
            start_time_str: The start time of the second shift (format: "HH:MM")

        Returns:
            float: The number of rest hours between the shifts
        """
        session_id = getattr(self, "session_id", None)

        try:
            # Handle None values
            if end_time_str is None or start_time_str is None:
                self._log_detailed_debug(
                    f"Cannot calculate rest hours with None values: end_time={end_time_str}, start_time={start_time_str}",
                    "rest_hours_none_values",
                    session_id,
                    end_time=end_time_str,
                    start_time=start_time_str,
                )
                return 24.0  # Default to 24 hours if times are None

            # Parse the time strings
            end_time = datetime.strptime(end_time_str, "%H:%M")
            start_time = datetime.strptime(start_time_str, "%H:%M")

            # Create datetime objects for today
            base_date = datetime.now().date()
            end_datetime = datetime.combine(base_date, end_time.time())
            start_datetime = datetime.combine(base_date, start_time.time())

            # If start time is earlier than end time, add a day to start time
            if start_datetime <= end_datetime:
                start_datetime = datetime.combine(
                    base_date + timedelta(days=1), start_time.time()
                )

            # Calculate the difference in hours
            rest_hours = (start_datetime - end_datetime).total_seconds() / 3600

            self._log_detailed_debug(
                f"Calculated rest hours: {rest_hours} (from {end_time_str} to {start_time_str})",
                "rest_hours_calculation",
                session_id,
                end_time=end_time_str,
                start_time=start_time_str,
                rest_hours=rest_hours,
                end_datetime=end_datetime.isoformat(),
                start_datetime=start_datetime.isoformat(),
            )

            return rest_hours

        except (ValueError, TypeError) as e:
            self._log_detailed_error(
                f"Error calculating rest hours: {str(e)}",
                "rest_hours_error",
                session_id,
                end_time=end_time_str,
                start_time=start_time_str,
                error=str(e),
                error_type=type(e).__name__,
            )
            return 24.0  # Default to 24 hours on error

    def _shifts_overlap(self, start1: str, end1: str, start2: str, end2: str) -> bool:
        """
        Check if two shifts overlap in time

        Args:
            start1: Start time of first shift (format: "HH:MM")
            end1: End time of first shift (format: "HH:MM")
            start2: Start time of second shift (format: "HH:MM")
            end2: End time of second shift (format: "HH:MM")

        Returns:
            bool: True if the shifts overlap, False otherwise
        """
        session_id = getattr(self, "session_id", None)

        # Handle None values
        if start1 is None or end1 is None or start2 is None or end2 is None:
            self._log_detailed_debug(
                f"Cannot check overlap with None values: shift1={start1}-{end1}, shift2={start2}-{end2}",
                "shifts_overlap_none_values",
                session_id,
                shift1_start=start1,
                shift1_end=end1,
                shift2_start=start2,
                shift2_end=end2,
            )
            return False

        try:
            # Convert times to datetime objects for comparison
            base_date = datetime.now().date()

            # Parse times
            dt_start1 = datetime.strptime(start1, "%H:%M")
            dt_end1 = datetime.strptime(end1, "%H:%M")
            dt_start2 = datetime.strptime(start2, "%H:%M")
            dt_end2 = datetime.strptime(end2, "%H:%M")

            # Combine with base date
            start1_dt = datetime.combine(base_date, dt_start1.time())
            end1_dt = datetime.combine(base_date, dt_end1.time())
            start2_dt = datetime.combine(base_date, dt_start2.time())
            end2_dt = datetime.combine(base_date, dt_end2.time())

            # Handle overnight shifts
            if end1_dt <= start1_dt:
                end1_dt = datetime.combine(
                    base_date + timedelta(days=1), dt_end1.time()
                )
            if end2_dt <= start2_dt:
                end2_dt = datetime.combine(
                    base_date + timedelta(days=1), dt_end2.time()
                )

            # Check for overlap
            overlap = (start1_dt < end2_dt) and (start2_dt < end1_dt)

            self._log_detailed_debug(
                f"Checking shift overlap: {start1}-{end1} and {start2}-{end2} -> {'Overlap' if overlap else 'No overlap'}",
                "shifts_overlap_check",
                session_id,
                shift1_start=start1,
                shift1_end=end1,
                shift2_start=start2,
                shift2_end=end2,
                overlap=overlap,
            )

            return overlap

        except (ValueError, TypeError) as e:
            self._log_detailed_error(
                f"Error checking shift overlap: {str(e)}",
                "shifts_overlap_error",
                session_id,
                shift1_start=start1,
                shift1_end=end1,
                shift2_start=start2,
                shift2_end=end2,
                error=str(e),
                error_type=type(e).__name__,
            )
            return False  # Default to no overlap on error

    def _time_overlaps(self, start1: str, end1: str, start2: str, end2: str) -> bool:
        """Check if two time ranges overlap"""
        return self._shifts_overlap(start1, end1, start2, end2)

    def _is_store_open(self, date: date) -> bool:
        """Check if the store is open on a given date"""
        # Implementation details...
        pass

    def _create_availability_lookup(
        self, availabilities: List[EmployeeAvailability]
    ) -> Dict[str, List[EmployeeAvailability]]:
        """Create a lookup dictionary for employee availabilities"""
        lookup = {}
        for availability in availabilities:
            key = f"{availability.employee_id}_{availability.start_date.strftime('%Y-%m-%d')}"
            if key not in lookup:
                lookup[key] = []
            lookup[key].append(availability)
        return lookup

    def _assign_employees_to_shift(
        self,
        shift: ShiftTemplate,
        employees: List[Employee],
        date: datetime,
        availability_lookup: Dict[str, List[EmployeeAvailability]],
    ) -> List[Employee]:
        """Assign employees to a shift based on availability and constraints"""
        logger.debug(
            f"Assigning employees to shift {shift.start_time}-{shift.end_time} on {date}"
        )
        available_employees = []

        for employee in employees:
            # Check employee availability
            key = f"{employee.id}_{date.strftime('%Y-%m-%d')}"
            if key in availability_lookup:
                availabilities = availability_lookup[key]
                if any(
                    a.availability_type != AvailabilityType.UNAVAILABLE
                    and a.is_available_for_date(
                        date.date(), shift.start_time, shift.end_time
                    )
                    for a in availabilities
                ):
                    logger.debug(f"Employee {employee.id} is available for shift")
                    available_employees.append(employee)
            else:
                logger.debug(
                    f"No availability record found for employee {employee.id} on {date}"
                )

        logger.debug(f"Found {len(available_employees)} available employees for shift")

        # Sort employees by contracted hours (higher first)
        available_employees.sort(key=lambda e: e.contracted_hours or 0, reverse=True)
        logger.debug("Sorted employees by contracted hours")

        assigned_employees = available_employees[: shift.max_employees]
        logger.debug(
            f"Assigned {len(assigned_employees)} employees to shift (max allowed: {shift.max_employees})"
        )

        return assigned_employees

    def _validate_shift_requirements(self, shift, current_date, assigned_employees):
        """Validate shift-specific requirements"""
        # Get coverage requirements for this time slot
        coverage = next(
            (
                c
                for c in self.resources.coverage_data
                if c.day_index == current_date.weekday()
                and c.start_time == shift.start_time
                and c.end_time == shift.end_time
            ),
            None,
        )

        # Check if keyholder is required and assigned
        if coverage and coverage.requires_keyholder:
            keyholder_assigned = any(e.is_keyholder for e in assigned_employees)
            if not keyholder_assigned:
                return False
        return True

    def _get_shift_priority(self, shift, current_date):
        """Get priority for shift scheduling (keyholder shifts first)"""
        # Get coverage requirements for this time slot
        coverage = next(
            (
                c
                for c in self.resources.coverage_data
                if c.day_index == current_date.weekday()
                and c.start_time == shift.start_time
                and c.end_time == shift.end_time
            ),
            None,
        )

        # Prioritize shifts that require keyholders
        if coverage and coverage.requires_keyholder:
            return 0
        return 1

    def _get_employee_priority(self, employee, shift):
        """Get priority for employee assignment"""
        if requires_keyholder(shift) and employee.is_keyholder:
            return 0
        return 1

    def _check_early_late_conflict(self, employee, shift, date):
        """Check for conflicts between early and late shifts"""
        if is_late_shift(shift):
            # Check if employee has early shift next day
            next_day = date + timedelta(days=1)
            early_next_day = (
                Schedule.query.join(ShiftTemplate)
                .filter(
                    Schedule.employee_id == employee.id,
                    Schedule.date == next_day,
                    Schedule.shift.has(ShiftTemplate.start_time < "08:00"),
                )
                .first()
            )
            if early_next_day:
                return True

        if is_early_shift(shift):
            # Check if employee had late shift previous day
            prev_day = date - timedelta(days=1)
            late_prev_day = (
                Schedule.query.join(ShiftTemplate)
                .filter(
                    Schedule.employee_id == employee.id,
                    Schedule.date == prev_day,
                    Schedule.shift.has(ShiftTemplate.end_time >= "18:00"),
                )
                .first()
            )
            if late_prev_day:
                return True

        return False

    def _validate_schedule(self, schedule, current_date):
        """Validate the generated schedule"""
        for shift in schedule:
            assigned_count = len(shift.assigned_employees)
            keyholder_assigned = any(e.is_keyholder for e in shift.assigned_employees)

            error_msg = []
            if assigned_count < shift.min_employees:
                error_msg.append(f"minimum {shift.min_employees} employees")

            if requires_keyholder(shift) and not keyholder_assigned:
                error_msg.append("keyholder")

            if error_msg:
                shift_time = f"{shift.start_time}-{shift.end_time}"
                raise ScheduleGenerationError(
                    f"Could not satisfy {' and '.join(error_msg)} for {shift_time} shift on {current_date.strftime('%Y-%m-%d')}"
                )

    def _is_employee_absent(self, employee: Employee, date: date) -> bool:
        """
        Check if an employee is absent on a given date

        Args:
            employee: The employee to check
            date: The date to check

        Returns:
            bool: True if the employee is absent, False otherwise
        """
        session_id = getattr(self, "session_id", None)

        self._log_detailed_debug(
            f"Checking if employee {employee.id} is absent on {date}",
            "check_absence",
            session_id,
            employee_id=employee.id,
            date=date.isoformat(),
        )

        # Check for absences in the database
        absence = Absence.query.filter(
            Absence.employee_id == employee.id,
            Absence.start_date <= date,
            Absence.end_date >= date,
        ).first()

        # Also check for unavailable availability records
        unavailable = EmployeeAvailability.query.filter(
            EmployeeAvailability.employee_id == employee.id,
            EmployeeAvailability.start_date <= date,
            EmployeeAvailability.end_date >= date,
            EmployeeAvailability.availability_type
            == AvailabilityType.UNAVAILABLE.value,
            # Check if it's a full-day unavailability (all hours)
            EmployeeAvailability.all_day == True,
        ).first()

        is_absent = absence is not None or unavailable is not None

        if is_absent:
            reason = "absence record" if absence else "unavailability record"
            self._log_detailed_debug(
                f"Employee {employee.id} is absent on {date} due to {reason}",
                "employee_absent",
                session_id,
                employee_id=employee.id,
                date=date.isoformat(),
                reason=reason,
                absence_id=absence.id if absence else None,
                unavailable_id=unavailable.id if unavailable else None,
            )
        else:
            self._log_detailed_debug(
                f"Employee {employee.id} is not absent on {date}",
                "employee_not_absent",
                session_id,
                employee_id=employee.id,
                date=date.isoformat(),
            )

        return is_absent

    def _create_test_data(self):
        """Create test data for debugging purposes"""
        logger.schedule_logger.info("Creating test data for debugging")

        # Create test employees
        test_employees = [
            Employee(
                id=1,
                first_name="TEST1",
                last_name="KEYHOLDER",
                is_keyholder=True,
                employee_group=EmployeeGroup.TL,
                contracted_hours=40,
                is_active=True,
            ),
            Employee(
                id=2,
                first_name="TEST2",
                last_name="REGULAR",
                is_keyholder=False,
                employee_group=EmployeeGroup.VZ,
                contracted_hours=40,
                is_active=True,
            ),
            Employee(
                id=3,
                first_name="TEST3",
                last_name="PARTTIME",
                is_keyholder=False,
                employee_group=EmployeeGroup.TZ,
                contracted_hours=20,
                is_active=True,
            ),
        ]

        # Create test shifts
        test_shifts = [
            ShiftTemplate(
                id=1,
                start_time="09:00",
                end_time="17:00",
                min_employees=1,
                max_employees=2,
                requires_break=True,
                duration_hours=8.0,
            ),
            ShiftTemplate(
                id=2,
                start_time="06:00",
                end_time="14:00",
                min_employees=1,
                max_employees=1,
                requires_break=True,
                duration_hours=8.0,
            ),
            ShiftTemplate(
                id=3,
                start_time="14:00",
                end_time="22:00",
                min_employees=1,
                max_employees=1,
                requires_break=True,
                duration_hours=8.0,
            ),
        ]

        # Create test coverage requirements
        test_coverage = [
            Coverage(
                id=1,
                day_index=0,  # Monday
                start_time="09:00",
                end_time="17:00",
                min_employees=1,
                max_employees=2,
                requires_keyholder=False,
                shift_id=1,
            ),
            Coverage(
                id=2,
                day_index=0,  # Monday
                start_time="06:00",
                end_time="14:00",
                min_employees=1,
                max_employees=1,
                requires_keyholder=True,
                shift_id=2,
            ),
            Coverage(
                id=3,
                day_index=0,  # Monday
                start_time="14:00",
                end_time="22:00",
                min_employees=1,
                max_employees=1,
                requires_keyholder=True,
                shift_id=3,
            ),
        ]

        logger.schedule_logger.debug(
            "Test data created",
            extra={
                "employees": len(test_employees),
                "shifts": len(test_shifts),
                "coverage": len(test_coverage),
            },
        )

        return test_employees, test_shifts, test_coverage

    def use_test_data(self):
        """Switch to using test data for debugging"""
        if os.getenv("DEBUG_MODE"):
            logger.schedule_logger.info("DEBUG_MODE enabled - using test data")
            test_employees, test_shifts, test_coverage = self._create_test_data()
            self.resources.employees = test_employees
            self.resources.shifts = test_shifts
            self.resources.coverage_data = test_coverage
            return True
        return False

    def _get_preferred_shifts(
        self, employee: Employee, date: date
    ) -> List[ShiftTemplate]:
        """Get preferred shifts for an employee on a given date"""
        # Get all shifts
        all_shifts = ShiftTemplate.query.all()
        preferred_shifts = []

        for shift in all_shifts:
            # Skip shifts with invalid duration
            if not self._has_valid_duration(shift):
                continue

            # Check if employee can work this shift
            if self._can_assign_shift(employee, shift, date):
                preferred_shifts.append(shift)

        return preferred_shifts

    def _log_detailed_info(self, message, action, session_id=None, **kwargs):
        """
        Log detailed information with consistent format.

        Args:
            message: The log message
            action: The action being performed
            session_id: Optional session ID for tracking
            **kwargs: Additional context data to include in the log
        """
        extra = {"action": action}
        if session_id:
            extra["session_id"] = session_id
        extra.update(kwargs)

        # Log to both loggers if session_id is provided
        logger.schedule_logger.info(message, extra=extra)

        # If we have a session logger in the current context, use it
        if hasattr(self, "session_logger") and self.session_logger:
            self.session_logger.info(
                message, extra={k: v for k, v in extra.items() if k != "session_id"}
            )

    def _log_detailed_debug(self, message, action, session_id=None, **kwargs):
        """
        Log detailed debug information with consistent format.

        Args:
            message: The log message
            action: The action being performed
            session_id: Optional session ID for tracking
            **kwargs: Additional context data to include in the log
        """
        extra = {"action": action}
        if session_id:
            extra["session_id"] = session_id
        extra.update(kwargs)

        # Log to both loggers if session_id is provided
        logger.schedule_logger.debug(message, extra=extra)

        # If we have a session logger in the current context, use it
        if hasattr(self, "session_logger") and self.session_logger:
            self.session_logger.debug(
                message, extra={k: v for k, v in extra.items() if k != "session_id"}
            )

    def _log_detailed_error(self, message, action, session_id=None, **kwargs):
        """
        Log detailed error information with consistent format.

        Args:
            message: The log message
            action: The action being performed
            session_id: Optional session ID for tracking
            **kwargs: Additional context data to include in the log
        """
        extra = {"action": action}
        if session_id:
            extra["session_id"] = session_id
        extra.update(kwargs)

        # Log to both loggers if session_id is provided
        logger.schedule_logger.error(message, extra=extra)
        logger.error_logger.error(message, extra=extra)

        # If we have a session logger in the current context, use it
        if hasattr(self, "session_logger") and self.session_logger:
            self.session_logger.error(
                message, extra={k: v for k, v in extra.items() if k != "session_id"}
            )

    def _calculate_duration(self, start_time: str, end_time: str) -> float:
        """
        Calculate the duration between two time points in hours

        Args:
            start_time: Start time in format "HH:MM"
            end_time: End time in format "HH:MM"

        Returns:
            float: Duration in hours
        """
        session_id = getattr(self, "session_id", None)

        try:
            # Handle None values
            if start_time is None or end_time is None:
                self._log_detailed_debug(
                    f"Cannot calculate duration with None values: start_time={start_time}, end_time={end_time}",
                    "duration_none_values",
                    session_id,
                    start_time=start_time,
                    end_time=end_time,
                )
                return 0.0

            # Convert times to minutes for easier calculation
            start_parts = start_time.split(":")
            end_parts = end_time.split(":")

            start_minutes = int(start_parts[0]) * 60 + int(start_parts[1])
            end_minutes = int(end_parts[0]) * 60 + int(end_parts[1])

            # Handle overnight shifts
            if end_minutes < start_minutes:
                end_minutes += 24 * 60  # Add 24 hours

            # Calculate duration in hours
            duration = (end_minutes - start_minutes) / 60.0

            self._log_detailed_debug(
                f"Calculated duration: {duration} hours (from {start_time} to {end_time})",
                "duration_calculation",
                session_id,
                start_time=start_time,
                end_time=end_time,
                duration=duration,
                start_minutes=start_minutes,
                end_minutes=end_minutes,
            )

            return duration

        except (ValueError, TypeError, IndexError) as e:
            self._log_detailed_error(
                f"Error calculating duration: {str(e)}",
                "duration_error",
                session_id,
                start_time=start_time,
                end_time=end_time,
                error=str(e),
                error_type=type(e).__name__,
            )
            return 0.0  # Default to 0 hours on error

    def _can_assign_shift(
        self, employee: Employee, shift: ShiftTemplate, date: date
    ) -> bool:
        """
        Check if an employee can be assigned to a shift on a given date

        Args:
            employee: The employee to check
            shift: The shift template to check
            date: The date to check

        Returns:
            bool: True if the employee can be assigned to the shift, False otherwise
        """
        session_id = getattr(self, "session_id", None)

        self._log_detailed_debug(
            f"Checking if employee {employee.id} can be assigned to shift {shift.id} on {date}",
            "check_shift_assignment",
            session_id,
            employee_id=employee.id,
            shift_id=shift.id,
            date=date.isoformat(),
            shift_start=shift.start_time,
            shift_end=shift.end_time,
        )

        # Check if employee is absent
        if self._is_employee_absent(employee, date):
            self._log_detailed_debug(
                f"Employee {employee.id} cannot be assigned to shift {shift.id} - employee is absent",
                "assignment_failed_absent",
                session_id,
                employee_id=employee.id,
                shift_id=shift.id,
                date=date.isoformat(),
                reason="employee_absent",
            )
            return False

        # Check if employee is available for this shift
        if not self._check_availability(
            employee, date, shift.start_time, shift.end_time
        ):
            self._log_detailed_debug(
                f"Employee {employee.id} cannot be assigned to shift {shift.id} - not available",
                "assignment_failed_unavailable",
                session_id,
                employee_id=employee.id,
                shift_id=shift.id,
                date=date.isoformat(),
                shift_start=shift.start_time,
                shift_end=shift.end_time,
                reason="not_available",
            )
            return False

        # Check daily hours
        if not self._check_daily_hours(employee, date, shift):
            self._log_detailed_debug(
                f"Employee {employee.id} cannot be assigned to shift {shift.id} - daily hours exceeded",
                "assignment_failed_daily_hours",
                session_id,
                employee_id=employee.id,
                shift_id=shift.id,
                date=date.isoformat(),
                reason="daily_hours_exceeded",
            )
            return False

        # Check weekly hours
        week_start = date - timedelta(days=date.weekday())  # Monday of the week
        if not self._check_weekly_hours(employee, week_start, shift.duration_hours):
            self._log_detailed_debug(
                f"Employee {employee.id} cannot be assigned to shift {shift.id} - weekly hours exceeded",
                "assignment_failed_weekly_hours",
                session_id,
                employee_id=employee.id,
                shift_id=shift.id,
                date=date.isoformat(),
                week_start=week_start.isoformat(),
                reason="weekly_hours_exceeded",
            )
            return False

        # Check rest period
        if not self._check_rest_period(employee, date, shift):
            self._log_detailed_debug(
                f"Employee {employee.id} cannot be assigned to shift {shift.id} - insufficient rest period",
                "assignment_failed_rest_period",
                session_id,
                employee_id=employee.id,
                shift_id=shift.id,
                date=date.isoformat(),
                reason="insufficient_rest",
            )
            return False

        # Check consecutive days
        if not self._check_consecutive_days(employee, date):
            self._log_detailed_debug(
                f"Employee {employee.id} cannot be assigned to shift {shift.id} - too many consecutive days",
                "assignment_failed_consecutive_days",
                session_id,
                employee_id=employee.id,
                shift_id=shift.id,
                date=date.isoformat(),
                reason="consecutive_days_exceeded",
            )
            return False

        # Check if employee has required skills for this shift
        if hasattr(shift, "required_skills") and shift.required_skills:
            has_skills = all(
                skill in employee.skills for skill in shift.required_skills
            )
            if not has_skills:
                self._log_detailed_debug(
                    f"Employee {employee.id} cannot be assigned to shift {shift.id} - missing required skills",
                    "assignment_failed_skills",
                    session_id,
                    employee_id=employee.id,
                    shift_id=shift.id,
                    date=date.isoformat(),
                    required_skills=shift.required_skills,
                    employee_skills=employee.skills,
                    reason="missing_skills",
                )
                return False

        # Check if employee is a keyholder for early/late shifts
        if requires_keyholder(shift) and not employee.is_keyholder:
            self._log_detailed_debug(
                f"Employee {employee.id} cannot be assigned to shift {shift.id} - not a keyholder",
                "assignment_failed_keyholder",
                session_id,
                employee_id=employee.id,
                shift_id=shift.id,
                date=date.isoformat(),
                shift_start=shift.start_time,
                shift_end=shift.end_time,
                reason="not_keyholder",
            )
            return False

        # All checks passed
        self._log_detailed_debug(
            f"Employee {employee.id} can be assigned to shift {shift.id} on {date}",
            "assignment_possible",
            session_id,
            employee_id=employee.id,
            shift_id=shift.id,
            date=date.isoformat(),
            shift_start=shift.start_time,
            shift_end=shift.end_time,
        )
        return True

    def _check_daily_hours(
        self, employee: Employee, date: date, shift: ShiftTemplate
    ) -> bool:
        """
        Check if adding a shift would exceed the employee's daily hour limit

        Args:
            employee: The employee to check
            date: The date to check
            shift: The shift template to check

        Returns:
            bool: True if the employee can work the shift, False otherwise
        """
        session_id = getattr(self, "session_id", None)

        # Get existing schedules for this day
        existing_schedules = Schedule.query.filter_by(
            employee_id=employee.id, date=date
        ).all()

        # Calculate current hours for this day
        current_hours = 0.0
        for schedule in existing_schedules:
            existing_shift = ShiftTemplate.query.get(schedule.shift_id)
            if existing_shift and existing_shift.duration_hours:
                current_hours += existing_shift.duration_hours

        # Calculate new total
        new_total = current_hours + shift.duration_hours

        # Maximum daily hours (German labor law: 10 hours max)
        max_daily_hours = 10.0

        self._log_detailed_debug(
            f"Checking daily hours for employee {employee.id} on {date}: current={current_hours}, adding={shift.duration_hours}, new_total={new_total}, max={max_daily_hours}",
            "check_daily_hours",
            session_id,
            employee_id=employee.id,
            date=date.isoformat(),
            current_hours=current_hours,
            shift_duration=shift.duration_hours,
            new_total=new_total,
            max_hours=max_daily_hours,
            existing_schedules_count=len(existing_schedules),
        )

        # Check if new total exceeds max
        if new_total > max_daily_hours:
            self._log_detailed_debug(
                f"Employee {employee.id} would exceed daily hours on {date}: {new_total} > {max_daily_hours}",
                "daily_hours_exceeded",
                session_id,
                employee_id=employee.id,
                date=date.isoformat(),
                current_hours=current_hours,
                shift_duration=shift.duration_hours,
                new_total=new_total,
                max_hours=max_daily_hours,
            )
            return False

        # Check for overlapping shifts
        for schedule in existing_schedules:
            existing_shift = ShiftTemplate.query.get(schedule.shift_id)
            if existing_shift and self._shifts_overlap(
                existing_shift.start_time,
                existing_shift.end_time,
                shift.start_time,
                shift.end_time,
            ):
                self._log_detailed_debug(
                    f"Employee {employee.id} has overlapping shift on {date}: {existing_shift.start_time}-{existing_shift.end_time} overlaps with {shift.start_time}-{shift.end_time}",
                    "overlapping_shifts",
                    session_id,
                    employee_id=employee.id,
                    date=date.isoformat(),
                    existing_shift_id=existing_shift.id,
                    existing_shift_start=existing_shift.start_time,
                    existing_shift_end=existing_shift.end_time,
                    new_shift_id=shift.id,
                    new_shift_start=shift.start_time,
                    new_shift_end=shift.end_time,
                )
                return False

        self._log_detailed_debug(
            f"Employee {employee.id} can work additional {shift.duration_hours} hours on {date} (new total: {new_total})",
            "daily_hours_ok",
            session_id,
            employee_id=employee.id,
            date=date.isoformat(),
            current_hours=current_hours,
            shift_duration=shift.duration_hours,
            new_total=new_total,
            max_hours=max_daily_hours,
        )
        return True

    def _check_consecutive_days(self, employee: Employee, date: date) -> bool:
        """
        Check if assigning a shift would exceed the maximum consecutive working days

        Args:
            employee: The employee to check
            date: The date to check

        Returns:
            bool: True if the employee can work on this day, False otherwise
        """
        session_id = getattr(self, "session_id", None)

        # Maximum consecutive working days (German labor law: 6 days max)
        max_consecutive_days = 6

        # Check previous days
        consecutive_days = 0
        check_date = date - timedelta(days=1)

        # Check up to max_consecutive_days previous days
        for i in range(max_consecutive_days):
            # Check if there's a schedule for this day
            schedule = Schedule.query.filter_by(
                employee_id=employee.id, date=check_date
            ).first()

            if schedule:
                consecutive_days += 1
                check_date -= timedelta(days=1)
            else:
                # Break the streak if no schedule found
                break

        self._log_detailed_debug(
            f"Checking consecutive days for employee {employee.id}: {consecutive_days} consecutive days before {date}",
            "check_consecutive_days",
            session_id,
            employee_id=employee.id,
            date=date.isoformat(),
            consecutive_days=consecutive_days,
            max_consecutive_days=max_consecutive_days,
        )

        # If already at max consecutive days, employee cannot work another day
        if consecutive_days >= max_consecutive_days:
            self._log_detailed_debug(
                f"Employee {employee.id} would exceed maximum consecutive days ({max_consecutive_days}) if assigned on {date}",
                "consecutive_days_exceeded",
                session_id,
                employee_id=employee.id,
                date=date.isoformat(),
                consecutive_days=consecutive_days,
                max_consecutive_days=max_consecutive_days,
            )
            return False

        self._log_detailed_debug(
            f"Employee {employee.id} can work on {date} (consecutive days: {consecutive_days})",
            "consecutive_days_ok",
            session_id,
            employee_id=employee.id,
            date=date.isoformat(),
            consecutive_days=consecutive_days,
            max_consecutive_days=max_consecutive_days,
        )
        return True
