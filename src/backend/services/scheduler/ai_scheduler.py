from src.backend.models.employee import Employee, EmployeeAvailability
from src.backend.models.coverage import Coverage
from src.backend.models.settings import Settings
from src.backend.models.schedule import Schedule
from src.backend.models.absence import Absence
from src.backend.models.fixed_shift import ShiftTemplate, ShiftType # Import ShiftType
from datetime import date, time, timedelta, datetime, timezone  # Import timezone
from typing import Dict, Any  # Import List
from src.backend.models.enums import AvailabilityType  # Import AvailabilityType enum

# Assuming Skill model exists and ShiftTemplate has required_skills attribute
# from src.backend.models.skill import Skill # TODO: Import Skill model if it exists


class AIScheduler:
    def __init__(self):
        pass

    def collect_data(self) -> Dict[str, Any]:
        """
        Gathers all necessary data for AI scheduling from the database.
        """
        print("Collecting data for AI scheduling...")
        data = {
            "employees": Employee.query.filter_by(is_active=True).all(),
            "availabilities": EmployeeAvailability.query.all(),
            "coverage": Coverage.query.all(),
            "settings": Settings.query.first(),  # Assuming a single settings record
            "schedules": Schedule.query.all(),  # For historical data/context
            "absences": Absence.query.all(),
            "shift_templates": ShiftTemplate.query.all(),
            # TODO: Include Skill data if a Skill model exists
            # "skills": Skill.query.all(),
        }
        print("Data collection complete.")
        return data

    def process_constraints(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Models hard and soft constraints for the scheduling problem.
        """
        print("Processing constraints...")

        constraints = {"hard": {}, "soft": {}}

        # Determine the scheduling period (start_date, end_date) - this should be an input
        # For now, using a placeholder week for implementation
        scheduling_start_date = date.today()  # Placeholder: Should be passed as input
        scheduling_end_date = date.today() + timedelta(
            days=6
        )  # Placeholder: Should be passed as input

        # Determine the scheduling granularity (e.g., 15 minutes, 60 minutes) - this might be in settings
        scheduling_interval_minutes = (
            60  # Placeholder: Should be from settings or input
        )
        scheduling_interval_timedelta = timedelta(minutes=scheduling_interval_minutes)

        # Define the full time range for intervals (e.g., from midnight to midnight the next day to handle overnight shifts/availability)
        # This might need adjustment based on actual shift times or store hours
        full_day_start_time = time(0, 0)
        full_day_end_time = time(23, 59, 59)

        # --- Hard Constraints ---
        # Availability Constraints
        # Structure: {employee_id: {date: {time_interval: is_available}}}
        availability_constraints = {}  # Dictionary to store availability constraints per date and time interval
        for employee in data["employees"]:
            availability_constraints[employee.id] = {}  # Initialize for each employee

        # Implement logic to handle recurring and date-specific availability over the scheduling period
        # Iterate through the scheduling dates
        delta = scheduling_end_date - scheduling_start_date
        for i in range(delta.days + 1):
            current_date = scheduling_start_date + timedelta(days=i)
            day_of_week = current_date.weekday()  # Monday=0, Sunday=6

            # Iterate through time intervals for the full day to capture all availability periods
            current_interval_start_dt = datetime.combine(
                current_date, full_day_start_time
            )
            end_of_day_dt = datetime.combine(current_date, full_day_end_time)

            while current_interval_start_dt <= end_of_day_dt:
                interval_start_time = current_interval_start_dt.time()
                interval_end_time_dt = (
                    current_interval_start_dt + scheduling_interval_timedelta
                )
                interval_end_time = interval_end_time_dt.time()

                for employee in data["employees"]:
                    is_available_in_interval = True  # Assume available unless marked otherwise
                    is_preferred_in_interval = False # Initialize is_preferred_in_interval

                    # Check all availabilities for the employee
                    for availability in data["availabilities"]:
                        if availability.employee_id == employee.id:
                            # Check if the availability record is applicable to the current date
                            is_applicable_date = False
                            if (
                                availability.is_recurring
                                and availability.day_of_week == day_of_week
                            ):
                                is_applicable_date = True
                            elif (
                                not availability.is_recurring
                                and availability.start_date
                                <= current_date
                                <= availability.end_date
                            ):
                                is_applicable_date = True

                            if is_applicable_date:
                                # Check if the availability time range overlaps with the current interval
                                # Assuming availability has start_time and end_time attributes
                                # Need to handle overnight availabilities spanning across midnight
                                availability_start_time = availability.start_time
                                availability_end_time = availability.end_time

                                # Simple overlap check: Interval starts before availability ends AND Interval ends after availability starts
                                # This doesn\'t handle overnight intervals/availabilities perfectly yet, needs refinement.
                                # TODO: Refine time overlap logic to handle overnight cases.
                                overlap = (
                                    interval_start_time < availability_end_time
                                ) and (interval_end_time > availability_start_time)

                                try:
                                    if overlap:
                                        # Use actual AvailabilityType enum
                                        if availability.availability_type == AvailabilityType.UNAVAILABLE:
                                            is_available_in_interval = False
                                            break # Found an unavailability, no need to check further for this interval
                                        elif availability.availability_type == AvailabilityType.PREFERRED:
                                            is_preferred_in_interval = True # Note preferred, but don\'t break yet
                                        # For FIXED and AVAILABLE, is_available_in_interval remains True
                                except AttributeError as e:
                                     print(f"AttributeError processing availability for employee {employee.id}: {e}")
                                     # Assume not available if availability data is malformed
                                     is_available_in_interval = False
                                except Exception as e:
                                     print(f"Unexpected error processing availability for employee {employee.id}: {e}")
                                     # Assume not available for any other errors
                                     is_available_in_interval = False

                    # Store the availability status for this employee, date, and interval
                    # Ensure the nested dictionary structure exists
                    if employee.id not in availability_constraints:
                        availability_constraints[employee.id] = {}
                    if current_date not in availability_constraints[employee.id]:
                        availability_constraints[employee.id][current_date] = {}
                    # Store a tuple of (is_available, is_preferred) or a more detailed status/score
                    # For now, just storing is_available_in_interval and is_preferred_in_interval
                    availability_constraints[employee.id][current_date][
                        interval_start_time
                    ] = {
                        "is_available": is_available_in_interval,
                        "is_preferred": is_preferred_in_interval,
                    }

                current_interval_start_dt += scheduling_interval_timedelta

        constraints["hard"]["availability"] = availability_constraints
        print("Processed availability constraints for scheduling period.")

        # Absence Constraints
        # Structure: {employee_id: [(start_date, end_date), ...]}
        absence_constraints = {}  # Dictionary to store absence constraints
        for employee in data["employees"]:
            absence_constraints[employee.id] = []  # Initialize for each employee

        for absence in data["absences"]:
            employee_id = absence.employee_id
            start_date = absence.start_date
            end_date = absence.end_date
            # Store absence as a tuple of start and end dates
            absence_constraints[employee.id].append((start_date, end_date))

        constraints["hard"]["absence"] = absence_constraints
        print(
            f"Processed absence constraints for {len(absence_constraints)} employees."
        )

        # Coverage Requirements
        # Structure: {date: {time_interval: {min_employees: N, required_groups: [], requires_keyholder: bool}}}
        coverage_constraints = {}  # Dictionary to store coverage constraints per time interval

        # Determine the scheduling period (start_date, end_date) - this should be an input to run_scheduler/process_constraints
        # For now, using a placeholder week
        # scheduling_start_date = date.today() # Placeholder: Should be passed as input
        # scheduling_end_date = date.today() + timedelta(days=6) # Placeholder: Should be passed as input

        # Determine the scheduling granularity (e.g., 15 minutes, 60 minutes) - this might be in settings
        # scheduling_interval_minutes = 60 # Placeholder: Should be from settings or input

        # Iterate through the scheduling period and intervals, applying coverage requirements
        delta = scheduling_end_date - scheduling_start_date
        for i in range(delta.days + 1):
            current_date = scheduling_start_date + timedelta(days=i)
            day_of_week = current_date.weekday()  # Monday=0, Sunday=6
            coverage_constraints[current_date] = {}

            # Get store opening and closing hours from settings for the current date
            if data["settings"] and data["settings"].is_store_open(current_date):
                open_time_str, close_time_str = data["settings"].get_store_hours(current_date)
                store_open_time = time.fromisoformat(open_time_str)
                store_close_time = time.fromisoformat(close_time_str)
            else:
                # If store is closed, skip coverage processing for this day
                print(f"Store is closed on {current_date}. Skipping coverage processing.")
                continue

            current_interval_start = datetime.combine(current_date, store_open_time)
            end_of_day_dt = datetime.combine(current_date, store_close_time)

            while current_interval_start < end_of_day_dt:
                interval_end = current_interval_start + timedelta(
                    minutes=scheduling_interval_minutes
                )
                current_interval_end_time = interval_end.time()

                # Find applicable coverage requirements for this day and interval
                # Filter data["coverage"] by day of week and time overlap
                applicable_coverages = [
                    coverage
                    for coverage in data["coverage"]
                    if coverage.day_of_week == day_of_week
                    and coverage.start_time
                    <= current_interval_start.time()
                    < coverage.end_time
                ]

                # Aggregate requirements from applicable coverages (max min_employees, union of groups, etc.)
                aggregated_requirements = {
                    "min_employees": 0,
                    "required_groups": set(),
                    "requires_keyholder": False,
                }
                for coverage in applicable_coverages:
                    aggregated_requirements["min_employees"] = max(
                        aggregated_requirements["min_employees"], coverage.min_employees
                    )
                    # Assuming employee_types and allowed_employee_groups in Coverage model are lists of strings or similar iterable
                    if coverage.employee_types:
                        aggregated_requirements["required_groups"].update(
                            coverage.employee_types
                        )
                    if coverage.allowed_employee_groups:
                        aggregated_requirements["required_groups"].update(
                            coverage.allowed_employee_groups
                        )
                    if coverage.requires_keyholder:
                        aggregated_requirements["requires_keyholder"] = True

                # Convert set to list for JSON compatibility if needed later, but set is fine for processing
                # aggregated_requirements["required_groups"] = list(aggregated_requirements["required_groups"])

                # Store the aggregated requirements for this interval
                coverage_constraints[current_date][current_interval_start.time()] = (
                    aggregated_requirements
                )

                current_interval_start = interval_end

        constraints["hard"]["coverage"] = coverage_constraints
        print("Processed coverage constraints for scheduling period.")

        # Keyholder Requirements
        # Structure: {date: {time_interval: requires_keyholder: bool}}
        keyholder_constraints = {}  # Dictionary to store keyholder requirements per time interval

        # Implement logic to process keyholder requirements based on coverage constraints and shift templates
        # Iterate through coverage_constraints and employees
        for current_date, intervals in coverage_constraints.items():
            keyholder_constraints[current_date] = {}
            for interval_time, requirements in intervals.items():
                keyholder_constraints[current_date][interval_time] = requirements.get(
                    "requires_keyholder", False
                )

        constraints["hard"]["keyholder"] = keyholder_constraints
        print("Processed initial structure for keyholder requirements.")

        # Working Hours Limits (Daily/Weekly)
        # Structure: {employee_id: {limit_type: value}}
        working_hours_limits_constraints = {}  # Dictionary to store working hours limits per employee

        # Implement logic to define daily and weekly hour limits based on employee contracts (data["employees"])
        # This should also consider legal limits and settings
        for employee in data["employees"]:
            working_hours_limits_constraints[employee.id] = {
                "max_daily": employee.get_max_daily_hours(),  # Assuming method exists in Employee model
                "max_weekly": employee.get_max_weekly_hours(),  # Assuming method exists in Employee model
                # TODO: Add other relevant limits like max consecutive days, etc.
            }

        constraints["hard"]["working_hours_limits"] = working_hours_limits_constraints
        print(
            f"Processed working hours limits for {len(working_hours_limits_constraints)} employees."
        )

        # Rest Period Requirements
        # Structure: {employee_id: {date: min_rest_start_time_next_shift}}
        rest_period_constraints = {}  # Dictionary to store the earliest start time for a shift on a given day for each employee

        # Implement logic to define rest period requirements (e.g., 11 hours between shifts)
        # This requires looking at the end time of a potential shift on the previous day.
        min_rest_hours = data["settings"].min_rest_between_shifts if data["settings"] else 11.0 # Get from settings or default
        min_rest_timedelta = timedelta(hours=min_rest_hours)

        for employee in data["employees"]:
            rest_period_constraints[employee.id] = {}  # Initialize for each employee

            # Iterate through scheduling dates (starting from the second day to check rest from the previous day)
            delta_rest = scheduling_end_date - scheduling_start_date # Use a different variable name
            for i in range(delta_rest.days + 1):
                current_date_rest = scheduling_start_date + timedelta(days=i) # Use a different variable name
                previous_date_rest = current_date_rest - timedelta(days=1)

                last_shift_end_time_prev_day = None
                # Check historical/existing schedules for this employee on the previous day
                for schedule_entry in data["schedules"]:
                    if schedule_entry.employee_id == employee.id and schedule_entry.date == previous_date_rest:
                        if schedule_entry.shift and schedule_entry.shift.end_time:
                            # Assuming shift.end_time is a string like "HH:MM"
                            try:
                                current_entry_end_time = time.fromisoformat(schedule_entry.shift.end_time)
                                if last_shift_end_time_prev_day is None or current_entry_end_time > last_shift_end_time_prev_day:
                                    last_shift_end_time_prev_day = current_entry_end_time
                            except ValueError:
                                print(f"Warning: Could not parse shift end_time '{schedule_entry.shift.end_time}' for employee {employee.id} on {previous_date_rest}")
                                continue

                min_rest_start_time = time(0, 0)  # Default to start of the day

                if last_shift_end_time_prev_day:
                    last_shift_end_datetime = datetime.combine(
                        previous_date_rest, last_shift_end_time_prev_day
                    )
                    min_start_datetime_current_day = (
                        last_shift_end_datetime + min_rest_timedelta
                    )

                    if min_start_datetime_current_day.date() == current_date_rest:
                        min_rest_start_time = min_start_datetime_current_day.time()
                    elif min_start_datetime_current_day.date() > current_date_rest:
                        # If rest period pushes into the next day entirely, effectively unavailable for the whole current_date_rest
                        # This logic might need refinement - perhaps mark all intervals as non-startable
                        min_rest_start_time = time(23, 59, 59) # Effectively makes the whole day non-startable

                rest_period_constraints[employee.id][current_date_rest] = min_rest_start_time

        constraints["hard"]["rest_periods"] = rest_period_constraints
        print("Processed initial structure for rest period requirements.")

        # --- Soft Constraints (Optimization Criteria) ---
        # Preference Satisfaction
        # Structure: {employee_id: {date: {time_interval: preference_score}}}
        preference_constraints = {}  # Dictionary to store preference scores per time interval

        # Determine the scheduling period (start_date, end_date) - using same as hard constraints for consistency
        # scheduling_start_date and scheduling_end_date are already defined
        # scheduling_interval_timedelta is already defined

        # Implement logic to model employee preferences based on availability types
        # Iterate through the scheduling dates and time intervals
        delta_pref = scheduling_end_date - scheduling_start_date # Use a different variable name for delta
        for i in range(delta_pref.days + 1):
            current_date_pref = scheduling_start_date + timedelta(days=i) # Use a different variable name for current_date
            day_of_week_pref = current_date_pref.weekday()  # Monday=0, Sunday=6

            # Iterate through time intervals for the full day
            # Get store opening and closing hours from settings for the current date
            if data["settings"] and data["settings"].is_store_open(current_date_pref):
                open_time_str, close_time_str = data["settings"].get_store_hours(current_date_pref)
                # store_open_time = time.fromisoformat(open_time_str) # Not needed here, using full_day_start_time
                # store_close_time = time.fromisoformat(close_time_str) # Not needed here, using full_day_end_time
            else:
                # If store is closed, skip preference processing for this day
                print(f"Store is closed on {current_date_pref}. Skipping preference processing.")
                continue

            current_interval_start_dt = datetime.combine(
                current_date_pref, full_day_start_time
            )  # Use full_day_start_time from above
            end_of_day_dt = datetime.combine(
                current_date_pref, full_day_end_time
            )  # Use full_day_end_time from above

            while current_interval_start_dt <= end_of_day_dt:
                interval_start_time = current_interval_start_dt.time()
                interval_end_time_dt = (
                    current_interval_start_dt + scheduling_interval_timedelta
                )
                interval_end_time = interval_end_time_dt.time()

                for employee in data["employees"]:
                    preference_score = 0  # Default score

                    # Find applicable availability records for this employee, date, and interval
                    applicable_availabilities = [
                        avail
                        for avail in data["availabilities"]
                        if avail.employee_id == employee.id
                        and (
                            (
                                avail.is_recurring
                                and avail.day_of_week == day_of_week_pref  # Check recurring
                                and (
                                    (
                                        avail.start_time
                                        <= interval_start_time
                                        < avail.end_time
                                    )  # Simple overlap check
                                    or (
                                        avail.start_time
                                        < interval_end_time
                                        <= avail.end_time
                                    )
                                )
                            )
                            or (
                                not avail.is_recurring
                                and avail.start_date
                                <= current_date_pref
                                <= avail.end_date  # Check date-specific
                                and (
                                    (
                                        avail.start_time
                                        <= interval_start_time
                                        < avail.end_time
                                    )  # Simple overlap check
                                    or (
                                        avail.start_time
                                        < interval_end_time
                                        <= avail.end_time
                                    )
                                )
                            )
                        )
                    ]

                    # Assign preference score based on AvailabilityType
                    # Assuming AvailabilityType enum exists with members like PREFERRED, AVAILABLE, UNAVAILABLE
                    # TODO: Use actual AvailabilityType enum once imported/defined
                    # Assign higher scores for PREFERRED, medium for AVAILABLE, low/negative for UNAVAILABLE

                    for avail in applicable_availabilities:
                        if avail.availability_type == AvailabilityType.PREFERRED:
                            preference_score += 5 # Higher score for preferred
                        elif avail.availability_type == AvailabilityType.AVAILABLE:
                            preference_score += 2 # Medium score for available
                        elif avail.availability_type == AvailabilityType.FIXED:
                            preference_score += 2 # Medium score for fixed (treat similar to available for preference)
                        elif avail.availability_type == AvailabilityType.UNAVAILABLE:
                            preference_score -= 10 # Penalty if somehow considered

                    # Store the preference score for this employee, date, and interval
                    if employee.id not in preference_constraints:
                        preference_constraints[employee.id] = {}
                    if current_date_pref not in preference_constraints[employee.id]:
                        preference_constraints[employee.id][current_date_pref] = {}
                    preference_constraints[employee.id][current_date_pref][
                        interval_start_time
                    ] = preference_score

                current_interval_start_dt += scheduling_interval_timedelta

        constraints["soft"]["preference_satisfaction"] = preference_constraints
        print("Processed preference satisfaction for scheduling period.")

        # Fair Distribution
        # Structure: {employee_id: {shift_type: assigned_count}} or similar, aggregated over time
        fair_distribution_constraints = {}  # Dictionary to track distribution metrics
        for employee in data["employees"]:
            fair_distribution_constraints[
                employee.id
            ] = {}  # Initialize for each employee

        # TODO: Define fairness criteria (e.g., equal distribution of undesirable shifts)
        # TODO: Implement logic to track distribution of shifts (e.g., evenings, weekends) per employee
        # This will likely involve analyzing historical schedules and potentially shift template attributes

        constraints["soft"]["fair_distribution"] = fair_distribution_constraints
        print("Processed initial structure for fair distribution.")

        # Skill Matching
        # Structure: {employee_id: [skill1, skill2, ...], shift_template_id: [required_skill1, ...]}
        skill_matching_constraints = {}  # Dictionary to store skill requirements and employee skills

        # Implement logic to model skill requirements for shifts and skills of employees
        # This will require adding skill information to the Employee and ShiftTemplate models or fetching it from elsewhere
        # Structure: {employee_id: [skill_ids], shift_template_id: [required_skill_ids]}
        skill_matching_constraints[
            "employee_skills"
        ] = {}  # Map employee_id to list of skill_ids
        skill_matching_constraints[
            "shift_requirements"
        ] = {}  # Map shift_template_id to list of required_skill_ids

        # Skills are not currently part of the Employee or ShiftTemplate models.
        # This section will remain a placeholder until Skill model is implemented and integrated.

        constraints["soft"]["skill_matching"] = skill_matching_constraints
        print("Processed initial structure for skill matching (Skills not yet implemented in models).")

        # Shift Continuity
        # Structure: {employee_id: {pattern_type: score}} or similar, based on historical schedules
        shift_continuity_constraints = {}  # Dictionary to store shift continuity preferences

        # Implement logic to model preferences for consistent shift patterns
        # This will likely involve analyzing historical schedules (data["schedules"]) to identify patterns
        for employee in data["employees"]:
            shift_continuity_constraints[employee.id] = {}
            # Sort historical schedules by date for this employee
            employee_schedules = sorted(
                [s for s in data["schedules"] if s.employee_id == employee.id],
                key=lambda s: s.date
            )

            for i in range(delta_pref.days + 1): # Iterate through the scheduling period
                current_eval_date = scheduling_start_date + timedelta(days=i)
                shift_continuity_constraints[employee.id][current_eval_date] = {
                    "penalty_early_after_late": 0,
                    "penalty_late_after_early": 0,
                }

                # Find last worked shift type before current_eval_date
                last_worked_shift_type = None
                for sched_idx in range(len(employee_schedules) - 1, -1, -1):
                    hist_schedule = employee_schedules[sched_idx]
                    if hist_schedule.date < current_eval_date:
                        if hist_schedule.shift:
                            last_worked_shift_type = hist_schedule.shift.shift_type # Enum (EARLY, MIDDLE, LATE)
                        break
                
                if last_worked_shift_type:
                    # This score will be used by the optimization phase when considering assigning a shift type
                    # on current_eval_date. A high penalty means it's undesirable.
                    # Example: If last was LATE, penalize assigning EARLY today.
                    # The actual shift being considered for current_eval_date is not known here,
                    # so we store potential penalties.
                    if last_worked_shift_type == ShiftType.LATE:
                        shift_continuity_constraints[employee.id][current_eval_date]["penalty_early_after_late"] = 10 # Arbitrary penalty score
                    elif last_worked_shift_type == ShiftType.EARLY:
                        shift_continuity_constraints[employee.id][current_eval_date]["penalty_late_after_early"] = 10 # Arbitrary penalty score

        constraints["soft"]["shift_continuity"] = shift_continuity_constraints
        print(
            f"Processed initial structure for shift continuity for {len(shift_continuity_constraints)} employees."
        )

        # Seniority Consideration
        # Structure: {employee_id: seniority_score} or similar
        seniority_constraints = {}  # Dictionary to store seniority scores

        # Implement logic to model seniority as a factor in shift assignment preferences
        # This could be based on hire date, a dedicated seniority value in the Employee model, or other criteria
        # The current placeholder uses days since creation date.
        # TODO: Refine seniority scoring based on project requirements (e.g., hire date, specific seniority value, tiers).
        for employee in data["employees"]:
            # Assuming Employee model has a 'created_at' field or similar for hire date
            # A simple scoring could be based on inverse of time since hire, or tiers
            seniority_score = (
                datetime.now(timezone.utc) - employee.created_at
            ).days  # Example: days since creation
            seniority_constraints[employee.id] = seniority_score

        constraints["soft"]["seniority_consideration"] = seniority_constraints
        print(
            f"Processed initial structure for seniority consideration for {len(seniority_constraints)} employees."
        )

        print("Constraint processing complete.")
        return constraints

    def generate_schedule(
        self, processed_data: Dict[str, Any], data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Generates an initial schedule and iteratively improves it based on constraints.
        """
        print("Generating schedule...")
        # TODO: Implement schedule generation algorithm using processed_data (constraints)
        # Referencing TASK003_define_ai_scheduling_algorithm_completed.md -> Algorithm Flow
        # 1. Initial Assignment Phase
        # 2. Constraint Validation Phase
        # 3. Optimization Phase (potentially using AI model)

        generated_schedule = {}  # Dictionary to store the generated schedule: {date: {time_interval: [employee_ids]}}

        # Determine the scheduling period and interval from processed data or settings
        # For now, using placeholders consistent with process_constraints
        scheduling_start_date = date.today()  # Placeholder
        scheduling_end_date = date.today() + timedelta(days=6)  # Placeholder
        scheduling_interval_minutes = 60  # Placeholder
        scheduling_interval_timedelta = timedelta(minutes=scheduling_interval_minutes)

        # --- 1. Initial Assignment Phase ---
        # Goal: Create a basic valid schedule respecting hard constraints as much as possible.
        # This could involve a greedy approach or a simple assignment based on availability.

        print("Initial Assignment Phase...")

        delta_assign = scheduling_end_date - scheduling_start_date # Use a different variable name for delta
        for i in range(delta_assign.days + 1):
            current_date_assign = scheduling_start_date + timedelta(days=i) # Use a different variable name for current_date
            generated_schedule[current_date_assign] = {}  # Initialize for the current date

            # Get store opening and closing hours from settings for the current date
            if data["settings"] and data["settings"].is_store_open(current_date_assign):
                open_time_str, close_time_str = data["settings"].get_store_hours(current_date_assign)
                store_open_time = time.fromisoformat(open_time_str)
                store_close_time = time.fromisoformat(close_time_str)
            else:
                # If store is closed, skip assignment for this day
                print(f"Store is closed on {current_date_assign}. Skipping assignment processing.")
                continue

            current_time = datetime.combine(current_date_assign, store_open_time)
            end_of_day = datetime.combine(current_date_assign, store_close_time)

            while current_time < end_of_day:
                interval_start_time = current_time.time()
                generated_schedule[current_date_assign][
                    interval_start_time
                ] = []  # Initialize list of assigned employees for this interval

                # Get required coverage for this interval
                coverage_requirements = (
                    processed_data["hard"]["coverage"]
                    .get(current_date_assign, {})
                    .get(interval_start_time, {})
                )
                required_count = coverage_requirements.get("min_employees", 0)
                requires_keyholder = coverage_requirements.get(
                    "requires_keyholder", False
                )
                required_groups = coverage_requirements.get("required_groups", set())

                assigned_count = 0
                assigned_keyholder = False

                # Identify eligible employees for this interval
                eligible_employees = []
                for employee in data["employees"]:
                    employee_id = employee.id
                    # Check basic hard constraints
                    is_available = (
                        processed_data["hard"]["availability"]
                        .get(employee_id, {})
                        .get(current_date_assign, {})
                        .get(interval_start_time, {})
                        .get("is_available", False) # Check the 'is_available' field
                    )

                    is_absent = False
                    for start_date_abs, end_date_abs in processed_data["hard"]["absence"].get(employee_id, []): # Use different variable names
                        if start_date_abs <= current_date_assign <= end_date_abs:
                            is_absent = True
                            break

                    # TODO: Add check for Rest Period Requirements (min_rest_start_time_next_shift)
                    # min_start_time = processed_data["hard"]["rest_periods"].get(employee_id, {}).get(current_date_assign, time(0,0))
                    # if interval_start_time < min_start_time:
                    #     is_available = False # Or mark as unavailable due to rest period
                    # This check is now implicitly handled if is_available is derived from a time-slotted availability structure
                    # that considers rest periods. Or, it needs to be an explicit check here against min_rest_start_time.

                    # Explicit check for rest period constraint for the current interval_start_time:
                    min_allowed_start_for_day = processed_data["hard"]["rest_periods"].get(employee_id, {}).get(current_date_assign, time(0,0))
                    if interval_start_time < min_allowed_start_for_day:
                        continue # Employee cannot start at this interval due to rest period

                    # TODO: Add check for Working Hours Limits (This is harder to check in initial assignment without tracking hours)
                    # This might be better as a validation/optimization step.

                    # Check if employee meets required group skills if applicable
                    meets_group_requirements = True  # Assume true if no required_groups or employee groups match
                    if required_groups:
                        # TODO: Implement logic to check if employee belongs to any of the required_groups
                        # This requires employee group information in the data.
                        meets_group_requirements = False  # Placeholder

                    if is_available and not is_absent and meets_group_requirements:
                        eligible_employees.append(employee)

                # Simple Greedy Assignment: Assign eligible employees until required coverage is met
                # Prioritize keyholder if required

                if requires_keyholder and not assigned_keyholder:
                    # TODO: Find an eligible employee who is also a keyholder
                    keyholder_candidates = [emp for emp in eligible_employees if emp.is_keyholder]
                    if keyholder_candidates:
                        keyholder_employee = keyholder_candidates[0] # Simplistic: take the first one
                        generated_schedule[current_date_assign][interval_start_time].append(
                            keyholder_employee.id
                        )
                        assigned_count += 1
                        assigned_keyholder = True
                        eligible_employees.remove(
                            keyholder_employee
                        )  # Remove keyholder from general pool

                # Assign remaining required employees from eligible pool
                for employee in eligible_employees:
                    if assigned_count < required_count:
                        generated_schedule[current_date_assign][interval_start_time].append(
                            employee.id
                        )
                        assigned_count += 1
                    else:
                        break  # Required coverage met for this interval

                current_time += scheduling_interval_timedelta

        print("Initial Assignment Phase Complete.")

        # --- 2. Constraint Validation Phase ---
        # Goal: Check if the generated schedule violates any hard constraints.
        # This can also provide metrics on soft constraint violations.
        print("Constraint Validation Phase...")
        violations = self._validate_schedule(generated_schedule, processed_data["hard"], data["employees"], data["settings"])
        if violations:
            print(f"Found {len(violations)} hard constraint violations after initial assignment.")
            # Store violations or handle them. For now, just printing.
            for v in violations:
                print(f"  - {v}")
        # print("Constraint Validation Phase Complete (Placeholder).") # Remove old placeholder message

        # --- 3. Optimization Phase ---
        # Goal: Improve the schedule based on soft constraints to maximize overall score.
        # This could involve iterative adjustments, or using an optimization solver or AI model.
        print("Optimization Phase...")

        # TODO: Implement optimization logic.
        # If there are hard constraint violations (detected in Phase 2), this phase might focus on fixing them first before optimizing for soft constraints.
        # Strategies could include: swapping employees, moving shifts, or removing/adding shifts.
        # If no hard violations, use soft constraints (preference, fairness, skills, continuity, seniority) to guide iterative adjustments.
        # Evaluate potential changes using a scoring function based on the soft constraints.
        # This phase might employ techniques like local search, simulated annealing, or potentially integrate with a dedicated optimization library or AI model.
        # optimized_schedule = self._optimize_schedule(generated_schedule, processed_data["soft"], processed_data["hard"])
        print("Optimization Phase Complete (Placeholder).")

        # For now, just return the generated schedule structure
        print("Schedule generation complete.")
        return generated_schedule

    def _validate_schedule(self, schedule: Dict[str, Any], hard_constraints: Dict[str, Any], employee_data: list, settings_data: Settings) -> list:
        """
        Validates the generated schedule against hard constraints.
        Returns a list of violations.
        """
        violations = []
        # interval_duration is assumed to be 60 minutes as per constraint processing logic
        interval_duration = timedelta(minutes=60) 

        # TODO: Implement detailed validation logic here.
        # Examples:
        # - Check availability: Iterate schedule, for each assignment, check if employee is available in hard_constraints["availability"]
        # - Check absences: Ensure no employee is scheduled during their absence period from hard_constraints["absence"]
        # - Check coverage: Ensure min_employees and keyholder requirements are met for each interval using hard_constraints["coverage"]
        # - Check working hours: Track daily and weekly hours for each employee based on assigned shifts and check against limits.
        # - Check rest periods: Ensure min rest between shifts using hard_constraints["rest_periods"]
        # This will be an iterative process, similar to how constraints were built.

        # Placeholder for employee data access if needed directly (e.g. for keyholder status)
        # employees_dict = {emp.id: emp for emp in employee_data}

        print(f"Starting schedule validation. Schedule has {len(schedule)} dates.")

        # Track working hours for validation
        employee_daily_hours = {emp.id: {dt: timedelta() for dt in schedule.keys()} for emp in employee_data}
        employee_weekly_hours = {emp.id: timedelta() for emp in employee_data}
        # Assuming scheduling_start_date is available or can be derived
        schedule_dates = sorted(schedule.keys())
        if not schedule_dates:
            print("Validation: No dates in schedule to validate weekly hours.")
            return violations # Or handle appropriately
            
        # Determine the start of the first week based on the first schedule date
        first_schedule_date = schedule_dates[0]
        start_of_first_week = first_schedule_date - timedelta(days=first_schedule_date.weekday()) # Monday

        for emp_id in employee_daily_hours.keys(): # Iterate over employees who have daily hours logged
            employee_weekly_hours_check = {emp_id: timedelta() for emp_id in employee_daily_hours.keys()} # Re-init for check
            current_week_start = start_of_first_week

            while current_week_start <= schedule_dates[-1]:
                current_week_end = current_week_start + timedelta(days=6)
                weekly_hours_for_emp = timedelta()

                for day_offset in range(7):
                    check_date = current_week_start + timedelta(days=day_offset)
                    if check_date in schedule: # Ensure the date is in the schedule keys
                        daily_td = employee_daily_hours.get(emp_id, {}).get(check_date, timedelta())
                        weekly_hours_for_emp += daily_td
                
                max_weekly_h = hard_constraints.get("working_hours_limits", {}).get(emp_id, {}).get("max_weekly", 40.0) # Default 40
                weekly_hours_float = weekly_hours_for_emp.total_seconds() / 3600

                if weekly_hours_float > max_weekly_h:
                    violations.append({
                        "type": "max_weekly_hours",
                        "employee_id": emp_id,
                        "week_start": current_week_start.isoformat(),
                        "message": f"Exceeded max weekly hours ({weekly_hours_float:.2f} > {max_weekly_h}) for week starting {current_week_start.isoformat()}"
                    })
                
                current_week_start += timedelta(days=7)

        # Validate Rest Periods between generated shifts
        min_rest_hours_setting = settings_data.min_rest_between_shifts if settings_data else 11.0
        min_rest_timedelta_setting = timedelta(hours=min_rest_hours_setting)

        for emp_id in employee_daily_hours.keys(): # Iterate over employees who have assignments
            employee_shifts = [] # List of (datetime_start, datetime_end)
            for current_date, intervals in schedule.items():
                for interval_start_time, assigned_employee_ids in intervals.items():
                    if emp_id in assigned_employee_ids:
                        # Assuming interval_duration is consistently 1 hour for this example
                        # A more robust way would be to get shift template duration if available
                        # or sum consecutive intervals for the same employee to form a 'block'
                        shift_start_dt = datetime.combine(current_date, interval_start_time)
                        shift_end_dt = shift_start_dt + interval_duration # Use the defined interval_duration
                        employee_shifts.append((shift_start_dt, shift_end_dt))
            
            employee_shifts.sort() # Sort by start time

            for i in range(len(employee_shifts) - 1):
                end_of_current_shift = employee_shifts[i][1]
                start_of_next_shift = employee_shifts[i+1][0]
                rest_duration = start_of_next_shift - end_of_current_shift

                if rest_duration < min_rest_timedelta_setting:
                    violations.append({
                        "type": "min_rest_period",
                        "employee_id": emp_id,
                        "shift1_end": end_of_current_shift.isoformat(),
                        "shift2_start": start_of_next_shift.isoformat(),
                        "message": f"Insufficient rest between shifts ({rest_duration} < {min_rest_timedelta_setting})"
                    })

        if violations:
            print(f"Schedule validation found {len(violations)} violations.")
        else:
            print("Schedule validation passed with no hard constraint violations found.")
        return violations

    def evaluate_schedule(self, generated_schedule: Dict[str, Any]) -> Dict[str, Any]:
        """
        Evaluates the quality of a generated schedule based on scoring metrics.
        """
        print("Evaluating schedule...")
        # TODO: Implement schedule evaluation and scoring based on TASK003
        # The evaluation should assess how well the generated schedule meets hard and soft constraints.
        # Hard constraint violations might result in a very low or zero score.
        # Soft constraint satisfaction should contribute positively to the score.

        # Calculate metrics for schedule quality:
        # - Number of hard constraint violations (categorized by type: availability, absence, coverage, etc.)
        # - Score for soft constraint satisfaction (aggregate scores for preference, fairness, skills, continuity, seniority)
        # - Overall score combining hard and soft constraint evaluation.

        # Implement multi-objective scoring if required by TASK003:
        # This might involve a weighted sum of different soft constraint scores or a more complex Pareto optimization approach.

        final_schedule_evaluation = {}  # Dictionary to store evaluation results and scores

        # Placeholder: For now, just indicate evaluation is happening.
        # actual_evaluation_results = self._perform_evaluation(generated_schedule, processed_data)
        # final_schedule_evaluation["score"] = 0 # Placeholder score
        # final_schedule_evaluation["violations"] = {} # Placeholder violations

        final_schedule = (
            generated_schedule  # Placeholder, just pass through the schedule for now
        )
        print("Schedule evaluation complete.")
        return final_schedule  # TODO: Return evaluation results along with the schedule or separately

    def run_scheduler(self) -> Dict[str, Any]:
        """
        Main method to run the full scheduling process.
        """
        data = self.collect_data()
        processed_data = self.process_constraints(data)
        generated_schedule = self.generate_schedule(processed_data, data)
        final_schedule = self.evaluate_schedule(generated_schedule)
        return final_schedule


if __name__ == "__main__":
    # Example usage (requires app context and settings to be defined)
    # from src.backend.app import create_app
    # app = create_app()
    # with app.app_context():
    #     scheduler = AIScheduler()
    #     schedule = scheduler.run_scheduler()
    #     print("Generated Schedule:", schedule)
    pass
