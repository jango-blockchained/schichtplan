from datetime import datetime, timedelta, date
from typing import List, Dict, Any, Optional, Tuple
from models import (
    Employee,
    ShiftTemplate,
    Schedule,
    Settings,
    EmployeeAvailability,
    Coverage,
    db,
)
from models.employee import AvailabilityType, EmployeeGroup
from flask import current_app
from utils.logger import logger


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
        """Fill open slots based on coverage requirements"""
        logger.schedule_logger.debug("Filling open slots")
        current_date = start_date
        while current_date <= end_date:
            if not self._is_store_open(current_date):
                current_date += timedelta(days=1)
                continue

            for coverage in self.resources.coverage_data:
                candidates = self._get_available_employees(
                    date=current_date,
                    start_time=coverage.start_time,
                    end_time=coverage.end_time,
                )

                # Special handling for TZ and GFB employees
                filtered_candidates = []
                for employee in candidates:
                    if employee.employee_group in [EmployeeGroup.TZ, EmployeeGroup.GFB]:
                        if self._check_tz_gfb_constraints(
                            employee, current_date, coverage
                        ):
                            filtered_candidates.append(employee)
                    else:
                        filtered_candidates.append(employee)

                self._assign_employees_to_slot(
                    date=current_date, coverage=coverage, candidates=filtered_candidates
                )

            current_date += timedelta(days=1)

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
        self, start_date: date, end_date: date
    ) -> Tuple[List[Schedule], List[Dict[str, Any]]]:
        """Main schedule generation method following the defined hierarchy"""
        if not current_app:
            raise ScheduleGenerationError("No Flask application context")

        logger.schedule_logger.info(
            f"Starting schedule generation for period {start_date} to {end_date}",
            extra={
                "action": "generate_schedule",
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
            },
        )

        try:
            # Load resources first - this must happen within app context
            self.resources.load_resources()
            if not self.resources.employees:
                logger.error_logger.error("No active employees found in database")
                raise ScheduleGenerationError("No active employees found in database")

            logger.schedule_logger.info(
                f"Initialized with {len(self.resources.employees)} employees: "
                + ", ".join(
                    [
                        f"{e.first_name} {e.last_name} ({e.employee_group})"
                        for e in self.resources.employees
                    ]
                )
            )

            # Get or create placeholder shift for empty schedules
            placeholder_shift = ShiftTemplate.query.filter_by(
                start_time="00:00", end_time="00:00"
            ).first()
            if not placeholder_shift:
                logger.schedule_logger.info(
                    "Creating placeholder shift for empty schedules"
                )
                placeholder_shift = ShiftTemplate(
                    start_time="00:00",
                    end_time="00:00",
                    min_employees=0,
                    max_employees=0,
                    requires_break=False,
                )
                db.session.add(placeholder_shift)
                try:
                    db.session.commit()
                    logger.schedule_logger.info(
                        "Successfully created placeholder shift"
                    )
                except Exception as e:
                    logger.error_logger.error(
                        "Failed to create placeholder shift",
                        extra={
                            "action": "create_placeholder_failed",
                            "error_message": str(e),
                            "error_type": type(e).__name__,
                        },
                    )
                    db.session.rollback()
                    raise

            # Create initial empty schedules for all employees
            logger.schedule_logger.info(
                "Creating initial empty schedules for all employees"
            )
            all_schedules = []
            current_date = start_date
            while current_date <= end_date:
                for employee in self.resources.employees:
                    empty_schedule = Schedule(
                        employee_id=employee.id,
                        date=current_date,
                        shift_id=placeholder_shift.id,
                        version=1,
                    )
                    empty_schedule.notes = "No assignments yet"
                    db.session.add(empty_schedule)
                    all_schedules.append(empty_schedule)
                    logger.schedule_logger.debug(
                        f"Created empty schedule for {employee.first_name} {employee.last_name} on {current_date}"
                    )
                current_date += timedelta(days=1)

            try:
                db.session.commit()
                logger.schedule_logger.info(
                    f"Successfully created {len(all_schedules)} initial empty schedules"
                )
            except Exception as e:
                logger.error_logger.error(
                    "Failed to save initial empty schedules",
                    extra={
                        "action": "save_empty_schedules_failed",
                        "error_message": str(e),
                        "error_type": type(e).__name__,
                    },
                )
                db.session.rollback()
                raise

            # Pre-processing steps
            logger.schedule_logger.info("Starting pre-processing steps")

            logger.schedule_logger.info("Processing absences")
            absence_count = (
                len(self.resources.absence_data) if self.resources.absence_data else 0
            )
            logger.schedule_logger.info(
                f"Found {absence_count} absence records to process"
            )
            self.process_absences()

            logger.schedule_logger.info("Processing fixed availabilities")
            availability_count = (
                len(self.resources.availability_data)
                if self.resources.availability_data
                else 0
            )
            logger.schedule_logger.info(
                f"Found {availability_count} availability records to process"
            )
            self.process_fix_availability()

            # Main scheduling step
            logger.schedule_logger.info("Starting main scheduling step")
            coverage_count = (
                len(self.resources.coverage_data) if self.resources.coverage_data else 0
            )
            logger.schedule_logger.info(
                f"Processing {coverage_count} coverage requirements"
            )
            self.fill_open_slots(start_date, end_date)

            # Verify goals
            logger.schedule_logger.info("Verifying scheduling goals")
            self.verify_goals()

            # Get all schedules for the period
            schedules = Schedule.query.filter(
                Schedule.date >= start_date, Schedule.date <= end_date
            ).all()

            # Track assignments per employee for detailed reporting
            employee_assignments = {}
            for schedule in schedules:
                if schedule.employee_id not in employee_assignments:
                    employee_assignments[schedule.employee_id] = []
                if schedule.shift_id != placeholder_shift.id:
                    employee_assignments[schedule.employee_id].append(schedule)

            # Log detailed assignment statistics
            logger.schedule_logger.info("=== Schedule Generation Summary ===")
            for employee in self.resources.employees:
                assignments = employee_assignments.get(employee.id, [])
                logger.schedule_logger.info(
                    f"Employee: {employee.first_name} {employee.last_name} ({employee.employee_group})"
                    f"\n  - Assignments: {len(assignments)}"
                    f"\n  - Total hours: {sum(s.shift.duration_hours for s in assignments if s.shift):.1f}"
                )

            # Log overall statistics
            total_shifts = len(
                [s for s in schedules if s.shift_id != placeholder_shift.id]
            )
            employees_with_shifts = len([e for e in employee_assignments.values() if e])
            total_employees = len(self.resources.employees)
            coverage_percentage = (
                (employees_with_shifts / total_employees) * 100
                if total_employees > 0
                else 0
            )

            logger.schedule_logger.info(
                f"\nSchedule Generation Complete:"
                f"\n- Total employees: {total_employees}"
                f"\n- Employees with shifts: {employees_with_shifts}"
                f"\n- Total shifts assigned: {total_shifts}"
                f"\n- Coverage percentage: {coverage_percentage:.1f}%"
                f"\n- Errors/Warnings: {len(self.generation_errors)}"
            )

            # Log all errors and warnings
            if self.generation_errors:
                logger.schedule_logger.info("\n=== Generation Issues ===")
                for error in self.generation_errors:
                    if error["type"] == "critical":
                        logger.error_logger.error(
                            error["message"],
                            extra={"action": "critical_error", "error_details": error},
                        )
                    elif error["type"] == "warning":
                        logger.schedule_logger.warning(
                            error["message"],
                            extra={
                                "action": "generation_warning",
                                "warning_details": error,
                            },
                        )
                    else:
                        logger.schedule_logger.info(
                            error["message"],
                            extra={"action": "generation_info", "info_details": error},
                        )

            return schedules, self.generation_errors

        except Exception as e:
            logger.error_logger.error(
                "Schedule generation encountered an error",
                extra={
                    "action": "generation_error",
                    "error_type": type(e).__name__,
                    "error_message": str(e),
                    "start_date": start_date.isoformat(),
                    "end_date": end_date.isoformat(),
                    "traceback": str(e.__traceback__),
                },
            )
            self.generation_errors.append(
                {
                    "type": "critical",
                    "message": f"Schedule generation error: {str(e)}",
                    "error_type": type(e).__name__,
                    "traceback": str(e.__traceback__),
                }
            )

            # Try to return any partial schedules that were created
            try:
                partial_schedules = Schedule.query.filter(
                    Schedule.date >= start_date, Schedule.date <= end_date
                ).all()
                if partial_schedules:
                    logger.schedule_logger.warning(
                        f"Returning {len(partial_schedules)} partial schedules despite error",
                        extra={
                            "action": "partial_schedules",
                            "schedule_count": len(partial_schedules),
                        },
                    )
                    return partial_schedules, self.generation_errors
            except Exception as fetch_error:
                logger.error_logger.error(
                    "Failed to fetch partial schedules",
                    extra={
                        "action": "fetch_partial_failed",
                        "error_message": str(fetch_error),
                        "error_type": type(fetch_error).__name__,
                        "traceback": str(fetch_error.__traceback__),
                    },
                )

            # If everything fails, return empty list
            return [], self.generation_errors

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

    def _get_available_employees(
        self, date: date, start_time: str, end_time: str
    ) -> List[Employee]:
        """Get list of available employees for a given time slot"""
        pass  # Implementation details...

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

    def _calculate_rest_hours(
        self, date1: date, time1: str, date2: date, time2: str
    ) -> float:
        """Calculate hours between two shifts"""
        dt1 = datetime.combine(date1, datetime.strptime(time1, "%H:%M").time())
        dt2 = datetime.combine(date2, datetime.strptime(time2, "%H:%M").time())
        return (dt2 - dt1).total_seconds() / 3600

    def _shifts_overlap(self, start1: str, end1: str, start2: str, end2: str) -> bool:
        """Check if two shifts overlap"""
        t1 = datetime.strptime(start1, "%H:%M").time()
        t2 = datetime.strptime(end1, "%H:%M").time()
        t3 = datetime.strptime(start2, "%H:%M").time()
        t4 = datetime.strptime(end2, "%H:%M").time()
        return (t1 <= t4) and (t2 >= t3)

    def _is_store_open(self, date: date) -> bool:
        """Check if the store is open on a given date"""
        # Get store settings
        settings = self.resources.settings
        if not settings:
            return True  # If no settings found, assume store is open

        # Check if this day is in the store's opening days
        day_index = date.weekday()  # 0-6 (Monday-Sunday)
        return day_index in settings.opening_days

    def _get_employee_hours(self, employee: Employee, date: date) -> float:
        """Get total hours for an employee on a given date"""
        schedules = Schedule.query.filter_by(employee_id=employee.id).all()
        return sum(
            schedule.shift.duration_hours
            for schedule in schedules
            if schedule.shift and schedule.shift.duration_hours
        )

    def _get_store_config(self) -> Settings:
        """Get store configuration from database"""
        logger.schedule_logger.debug(
            "Fetching store configuration", extra={"action": "fetch_store_config"}
        )
        config = Settings.query.first()
        if not config:
            logger.error_logger.error(
                "Store configuration not found",
                extra={"action": "store_config_missing"},
            )
            raise ScheduleGenerationError("Store configuration not found")
        logger.schedule_logger.debug(
            "Store config loaded",
            extra={
                "action": "store_config_loaded",
                "opening": config.store_opening,
                "closing": config.store_closing,
            },
        )
        return config

    def _get_shifts(self) -> List[ShiftTemplate]:
        """Get all shifts from database"""
        logger.schedule_logger.debug(
            "Fetching shifts", extra={"action": "fetch_shifts"}
        )
        shifts = ShiftTemplate.query.all()
        if not shifts:
            logger.error_logger.error(
                "No shifts found", extra={"action": "shifts_missing"}
            )
            raise ScheduleGenerationError("No shifts found")
        logger.schedule_logger.debug(
            f"Found {len(shifts)} shifts",
            extra={"action": "shifts_loaded", "shift_count": len(shifts)},
        )
        return shifts

    def _get_coverage(self) -> List[Coverage]:
        """Get coverage requirements from database"""
        logger.schedule_logger.debug(
            "Fetching coverage requirements", extra={"action": "fetch_coverage"}
        )
        coverage = Coverage.query.all()
        logger.schedule_logger.debug(
            f"Found {len(coverage)} coverage requirements",
            extra={"action": "coverage_loaded", "coverage_count": len(coverage)},
        )
        return coverage

    def _get_employee_hours(self, employee: Employee, week_start: date) -> float:
        """Get total scheduled hours for an employee in a given week"""
        week_key = week_start.strftime("%Y-%m-%d")
        if week_key not in self.schedule_cache:
            week_end = week_start + timedelta(days=6)
            schedules = Schedule.query.filter(
                Schedule.employee_id == employee.id,
                Schedule.date >= week_start,
                Schedule.date <= week_end,
            ).all()
            self.schedule_cache[week_key] = schedules

        total_hours = 0.0
        for schedule in self.schedule_cache[week_key]:
            shift = next(s for s in self.resources.shifts if s.id == schedule.shift_id)
            total_hours += shift.duration_hours
        return total_hours

    def _check_availability(
        self, employee: Employee, day: date, shift: ShiftTemplate
    ) -> bool:
        """Check if employee is available for the given shift"""
        # Get all relevant availability records
        availabilities = EmployeeAvailability.query.filter(
            EmployeeAvailability.employee_id == employee.id,
            db.or_(
                db.and_(
                    EmployeeAvailability.start_date.is_(
                        None
                    ),  # Recurring availabilities
                    EmployeeAvailability.end_date.is_(None),
                    EmployeeAvailability.is_recurring.is_(True),
                ),
                db.and_(
                    EmployeeAvailability.start_date <= day,  # Temporary availabilities
                    EmployeeAvailability.end_date >= day,
                ),
            ),
        ).all()

        # If no availability records exist, employee is considered unavailable
        if not availabilities:
            return False

        # Check each availability record
        for availability in availabilities:
            if availability.is_available_for_date(
                day,
                shift.start_time if shift else None,
                shift.end_time if shift else None,
            ):
                return True

        return False

    def _assign_breaks(
        self, schedule: Schedule, shift: ShiftTemplate
    ) -> Tuple[Optional[str], Optional[str]]:
        """Assign break times for a shift based on German labor law"""
        if not shift.requires_break():
            return None, None

        shift_duration = shift.duration_hours
        start_time = datetime.strptime(shift.start_time, "%H:%M")

        # Break rules based on shift duration according to German labor law
        if shift_duration > 9:
            # For shifts > 9 hours: 45 minutes total break
            # Split into two breaks: 30 minutes + 15 minutes
            first_break_start = start_time + timedelta(
                hours=2
            )  # First break after 2 hours
            first_break_end = first_break_start + timedelta(minutes=30)

            second_break_start = start_time + timedelta(
                hours=6
            )  # Second break after 6 hours
            second_break_end = second_break_start + timedelta(minutes=15)

            # Return the first break only in the break fields
            # The second break will be stored in the schedule notes
            schedule.notes = f"Second break: {second_break_start.strftime('%H:%M')}-{second_break_end.strftime('%H:%M')}"
            return first_break_start.strftime("%H:%M"), first_break_end.strftime(
                "%H:%M"
            )

        elif shift_duration > 6:
            # For shifts 6-9 hours: 30 minutes break
            # Must be taken after 2-6 hours of work
            break_start = start_time + timedelta(
                hours=3
            )  # Take break after 3 hours (middle of the allowed window)
            break_end = break_start + timedelta(minutes=30)
            return break_start.strftime("%H:%M"), break_end.strftime("%H:%M")

        return None, None

    def _validate_break_rules(
        self, shift: ShiftTemplate, break_start: Optional[str], break_end: Optional[str]
    ) -> bool:
        """Validate that break times comply with German labor law"""
        if not shift.requires_break():
            return True

        if not break_start or not break_end:
            return False

        shift_start = datetime.strptime(shift.start_time, "%H:%M")
        shift_end = datetime.strptime(shift.end_time, "%H:%M")
        break_start_time = datetime.strptime(break_start, "%H:%M")
        break_end_time = datetime.strptime(break_end, "%H:%M")

        # Break must be within shift hours
        if break_start_time < shift_start or break_end_time > shift_end:
            return False

        # Calculate hours worked before break
        hours_before_break = (break_start_time - shift_start).total_seconds() / 3600

        # Break must be taken after at least 2 hours of work
        if hours_before_break < 2:
            return False

        # For shifts > 6 hours, break must be taken before 6 hours of work
        if shift.duration_hours > 6 and hours_before_break > 6:
            return False

        return True

    def _check_daily_hours(
        self, employee: Employee, day: date, shift: ShiftTemplate
    ) -> bool:
        """Check if adding this shift would exceed daily hour limits"""
        # Get all shifts for this day
        existing_shifts = Schedule.query.filter(
            Schedule.employee_id == employee.id, Schedule.date == day
        ).all()

        total_hours = (
            sum(s.shift.duration_hours for s in existing_shifts) + shift.duration_hours
        )
        return total_hours <= 10  # Max 10 hours per day

    def _check_weekly_hours(
        self, employee: Employee, week_start: date, shift: ShiftTemplate
    ) -> bool:
        """Check if adding this shift would exceed weekly hour limits"""
        week_hours = self._get_employee_hours(employee, week_start)

        # Different limits based on employee group
        if employee.employee_group in [EmployeeGroup.VZ, EmployeeGroup.TL]:
            # For VZ and TL: max 48 hours per week
            return week_hours + shift.duration_hours <= 48
        elif employee.employee_group == EmployeeGroup.TZ:
            # For TZ: respect contracted hours
            return week_hours + shift.duration_hours <= employee.contracted_hours
        else:  # GFB
            # For GFB: Check monthly hours for minijobs
            month_start = date(week_start.year, week_start.month, 1)
            month_hours = (
                Schedule.query.filter(
                    Schedule.employee_id == employee.id,
                    Schedule.date >= month_start,
                    Schedule.date <= week_start + timedelta(days=6),
                )
                .join(ShiftTemplate)
                .with_entities(db.func.sum(ShiftTemplate.duration_hours))
                .scalar()
                or 0
            )

            # Calculate approximate monthly limit based on 556 EUR limit and minimum wage
            # Assuming minimum wage of 12.41 EUR in 2025
            max_monthly_hours = 556 / 12.41
            return month_hours + shift.duration_hours <= max_monthly_hours

    def _check_rest_period(
        self, employee: Employee, day: date, shift: ShiftTemplate
    ) -> bool:
        """Check if minimum rest period between shifts is respected (11 hours)"""
        # Get previous day's shift
        prev_day = day - timedelta(days=1)
        prev_shift = (
            Schedule.query.filter(
                Schedule.employee_id == employee.id, Schedule.date == prev_day
            )
            .join(ShiftTemplate)
            .first()
        )

        if not prev_shift:
            return True

        # Calculate rest period
        prev_end = datetime.combine(prev_day, prev_shift.shift.end_time)
        curr_start = datetime.combine(day, shift.start_time)
        rest_hours = (curr_start - prev_end).total_seconds() / 3600

        return rest_hours >= 11

    def _check_consecutive_days(self, employee: Employee, day: date) -> bool:
        """Check if employee would exceed maximum consecutive working days (6)"""
        # Check previous 6 days
        for i in range(1, 7):
            check_day = day - timedelta(days=i)
            if not Schedule.query.filter(
                Schedule.employee_id == employee.id, Schedule.date == check_day
            ).first():
                return True
        return False

    def _check_shift_distribution(
        self, employee: Employee, day: date, shift: ShiftTemplate
    ) -> bool:
        """Check if shift distribution is fair and follows employee group rules"""
        # Team Leaders and Full-time employees should have priority for Tuesday/Thursday shifts
        if day.weekday() in [1, 3]:  # Tuesday or Thursday
            if employee.employee_group not in [EmployeeGroup.TL, EmployeeGroup.VZ]:
                # Check if any TL/VZ employees are available and not yet scheduled
                available_priority = Employee.query.filter(
                    Employee.employee_group.in_([EmployeeGroup.TL, EmployeeGroup.VZ]),
                    ~Employee.schedules.any(Schedule.date == day),
                ).all()
                if available_priority:
                    return False

        # Ensure fair distribution of weekend shifts
        if day.weekday() == 5:  # Saturday
            # Count weekend shifts in the last 4 weeks
            four_weeks_ago = day - timedelta(weeks=4)
            weekend_shifts = Schedule.query.filter(
                Schedule.employee_id == employee.id,
                Schedule.date >= four_weeks_ago,
                Schedule.date <= day,
                db.extract("dow", Schedule.date) == 5,  # Saturday
            ).count()

            # Maximum 2 weekend shifts per 4 weeks for part-time and minijob employees
            if (
                employee.employee_group in [EmployeeGroup.TZ, EmployeeGroup.GFB]
                and weekend_shifts >= 2
            ):
                return False

        return True

    def _check_keyholder_coverage(
        self, shift: ShiftTemplate, day: date, current_schedules: List[Schedule]
    ) -> bool:
        """Check if keyholder coverage requirements are met for early/late shifts"""
        if shift.shift_type not in [ShiftType.EARLY, ShiftType.LATE]:
            return True

        # Check if any keyholder is already assigned to this shift
        for schedule in current_schedules:
            if schedule.date == day and schedule.shift_id == shift.id:
                employee = next(
                    e for e in self.resources.employees if e.id == schedule.employee_id
                )
                if employee.is_keyholder:
                    return True

        return False

    def _validate_shift_against_store_hours(
        self, shift: ShiftTemplate, store_opening: str, store_closing: str
    ) -> bool:
        """Validate that shift times are within store hours"""

        def time_to_minutes(time_str: str) -> int:
            hours, minutes = map(int, time_str.split(":"))
            return hours * 60 + minutes

        shift_start = time_to_minutes(shift.start_time)
        shift_end = time_to_minutes(shift.end_time)
        store_open = time_to_minutes(store_opening)
        store_close = time_to_minutes(store_closing)

        return shift_start >= store_open and shift_end <= store_close

    def _can_assign_shift(
        self, employee: Employee, shift: ShiftTemplate, date: date
    ) -> bool:
        """Check if an employee can be assigned to a shift on a given date"""
        # Check if employee is available on this day
        if not self._is_employee_available(employee, date):
            return False

        # Get coverage requirements for this time slot
        coverage = next(
            (
                c
                for c in self.resources.coverage_data
                if c.day_index == date.weekday()
                and c.start_time == shift.start_time
                and c.end_time == shift.end_time
            ),
            None,
        )

        # If coverage requires a keyholder and employee is not one, they can't be assigned
        if coverage and coverage.requires_keyholder and not employee.is_keyholder:
            return False

        # Check if employee has enough rest time between shifts
        if not self._has_enough_rest_time(employee, shift, date):
            return False

        # Check if employee has not exceeded max shifts per week
        if self._exceeds_max_shifts(employee, date):
            return False

        return True

    def _has_enough_rest_time(
        self, employee: Employee, shift: ShiftTemplate, date: date
    ) -> bool:
        """Check if employee has enough rest time between shifts"""
        # Get previous day's schedule
        prev_date = date - timedelta(days=1)
        prev_schedule = Schedule.query.filter_by(
            employee_id=employee.id, date=prev_date
        ).first()

        if prev_schedule and prev_schedule.shift:
            # Convert times to datetime for proper comparison
            prev_end = datetime.combine(
                prev_date,
                datetime.strptime(prev_schedule.shift.end_time, "%H:%M").time(),
            )
            curr_start = datetime.combine(
                date, datetime.strptime(shift.start_time, "%H:%M").time()
            )

            # Calculate hours between shifts
            hours_between = (curr_start - prev_end).total_seconds() / 3600

            # Require at least 11 hours rest between shifts
            if hours_between < 11:
                return False

        # Get next day's schedule
        next_date = date + timedelta(days=1)
        next_schedule = Schedule.query.filter_by(
            employee_id=employee.id, date=next_date
        ).first()

        if next_schedule and next_schedule.shift:
            # Convert times to datetime for proper comparison
            curr_end = datetime.combine(
                date, datetime.strptime(shift.end_time, "%H:%M").time()
            )
            next_start = datetime.combine(
                next_date,
                datetime.strptime(next_schedule.shift.start_time, "%H:%M").time(),
            )

            # Calculate hours between shifts
            hours_between = (next_start - curr_end).total_seconds() / 3600

            # Require at least 11 hours rest between shifts
            if hours_between < 11:
                return False

        return True

    def _exceeds_max_shifts(self, employee: Employee, date: date) -> bool:
        """Check if employee has exceeded maximum shifts per week"""
        # Get start of week (Monday)
        week_start = date - timedelta(days=date.weekday())
        week_end = week_start + timedelta(days=6)

        # Count shifts this week
        week_shifts = Schedule.query.filter(
            Schedule.employee_id == employee.id,
            Schedule.date >= week_start,
            Schedule.date <= week_end,
        ).count()

        # Maximum 5 shifts per week
        return week_shifts >= 5

    def _is_employee_available(self, employee: Employee, date: date) -> bool:
        """Check if employee is available on the given date"""
        # Check if the employee is available on the given date
        return self._check_availability(employee, date, None)

    def _calculate_duration(self, start_time: str, end_time: str) -> float:
        """Calculate duration in hours between two time strings (HH:MM format)"""
        start_hour, start_min = map(int, start_time.split(":"))
        end_hour, end_min = map(int, end_time.split(":"))
        return (end_hour - start_hour) + (end_min - start_min) / 60.0

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
