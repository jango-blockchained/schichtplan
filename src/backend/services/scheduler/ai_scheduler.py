from src.backend.app import db
from src.backend.models.employee import Employee, EmployeeAvailability
from src.backend.models.coverage import Coverage
from src.backend.models.settings import Settings
from src.backend.models.schedule import Schedule
from src.backend.models.absence import Absence
from src.backend.models.fixed_shift import ShiftTemplate
from datetime import date, time, timedelta, datetime, timezone  # Import timezone
from typing import Dict, Any, List  # Import List

# Assuming AvailabilityType is an Enum or similar accessible object
# from your_models_or_utils import AvailabilityType # TODO: Import AvailabilityType

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
                    is_available_in_interval = True  # Assume available unless marked otherwise by an UNAVAILABLE availability record
                    is_preferred_in_interval = (
                        False  # Track if preferred availability exists
                    )

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
                                # This doesn't handle overnight intervals/availabilities perfectly yet, needs refinement.
                                # TODO: Refine time overlap logic to handle overnight cases.
                                overlap = (
                                    interval_start_time < availability_end_time
                                ) and (interval_end_time > availability_start_time)

                                if overlap:
                                    # Assuming availability has a 'type' attribute (e.g., AvailabilityType.UNAVAILABLE)
                                    # TODO: Use actual AvailabilityType enum
                                    # if availability.type == AvailabilityType.UNAVAILABLE:
                                    #     is_available_in_interval = False
                                    #     break # Found an unavailability, no need to check further for this interval
                                    # elif availability.type == AvailabilityType.PREFERRED:
                                    #     is_preferred_in_interval = True # Note preferred, but don't break yet
                                    # Placeholder logic based on is_available flag in Availability model
                                    if not availability.is_available:
                                        is_available_in_interval = False
                                        break  # Found an unavailability, no need to check further for this interval
                                    # Assuming is_available=True could be either AVAILABLE or PREFERRED, need type check
                                    # For now, a simple assumption:
                                    # if availability.is_available and hasattr(availability, 'type') and availability.type == 'PREFERRED': # Placeholder type check
                                    #      is_preferred_in_interval = True

                    # Store the availability status for this employee, date, and interval
                    # Ensure the nested dictionary structure exists
                    if employee.id not in availability_constraints:
                        availability_constraints[employee.id] = {}
                    if current_date not in availability_constraints[employee.id]:
                        availability_constraints[employee.id][current_date] = {}
                    # Store a tuple of (is_available, is_preferred) or a more detailed status/score
                    # For now, just storing is_available_in_interval
                    availability_constraints[employee.id][current_date][
                        interval_start_time
                    ] = is_available_in_interval

                current_interval_start_dt += scheduling_interval_timedelta

        constraints["hard"]["availability"] = availability_constraints
        print(f"Processed availability constraints for scheduling period.")

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
            # TODO: Implement logic to get store hours from settings considering special days
            # For now, using placeholders
            store_open_time_str = "09:00"  # Placeholder
            store_close_time_str = "20:00"  # Placeholder
            store_open_time = time(
                int(store_open_time_str.split(":")[0]),
                int(store_open_time_str.split(":")[1]),
            )
            store_close_time = time(
                int(store_close_time_str.split(":")[0]),
                int(store_close_time_str.split(":")[1]),
            )

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
        print(f"Processed coverage constraints for scheduling period.")

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
        # TODO: Get minimum rest period from settings
        min_rest_hours = 11  # Placeholder: Should be from settings
        min_rest_timedelta = timedelta(hours=min_rest_hours)

        for employee in data["employees"]:
            rest_period_constraints[employee.id] = {}  # Initialize for each employee

            # Iterate through scheduling dates (starting from the second day to check rest from the previous day)
            delta = scheduling_end_date - scheduling_start_date
            for i in range(delta.days + 1):
                current_date = scheduling_start_date + timedelta(days=i)
                previous_date = current_date - timedelta(days=1)

                # TODO: Get the end time of the last shift assigned to this employee on the previous_date
                # This will require access to the schedule being generated or historical schedules.
                last_shift_end_time_prev_day = (
                    None  # Placeholder: Get from schedule/historical data
                )

                min_rest_start_time = time(0, 0)  # Default to start of the day

                if last_shift_end_time_prev_day:
                    # Calculate the earliest time a shift can start on the current day
                    last_shift_end_datetime = datetime.combine(
                        previous_date, last_shift_end_time_prev_day
                    )
                    min_start_datetime_current_day = (
                        last_shift_end_datetime + min_rest_timedelta
                    )

                    # If the minimum start time is on the current day, record it
                    if min_start_datetime_current_day.date() == current_date:
                        min_rest_start_time = min_start_datetime_current_day.time()

                # Store the minimum allowed start time for a shift on the current date for this employee
                rest_period_constraints[employee.id][current_date] = min_rest_start_time

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
        delta = scheduling_end_date - scheduling_start_date
        for i in range(delta.days + 1):
            current_date = scheduling_start_date + timedelta(days=i)
            day_of_week = current_date.weekday()  # Monday=0, Sunday=6

            # Iterate through time intervals for the full day
            # TODO: Get store opening and closing hours from settings for the current date
            # For now, using placeholders
            store_open_time_str = "09:00"  # Placeholder
            store_close_time_str = "20:00"  # Placeholder
            store_open_time = time(
                int(store_open_time_str.split(":")[0]),
                int(store_open_time_str.split(":")[1]),
            )
            store_close_time = time(
                int(store_close_time_str.split(":")[0]),
                int(store_close_time_str.split(":")[1]),
            )

            current_interval_start_dt = datetime.combine(
                current_date, full_day_start_time
            )  # Use full_day_start_time from above
            end_of_day_dt = datetime.combine(
                current_date, full_day_end_time
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
                                and avail.day_of_week == day_of_week  # Check recurring
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
                                <= current_date
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
                        # Placeholder logic based on is_available flag
                        if avail.is_available:
                            preference_score += (
                                1  # Simple positive score for available intervals
                            )
                            # TODO: Differentiate between AVAILABLE and PREFERRED based on AvailabilityType
                            # Assuming is_available=True indicates either AVAILABLE or PREFERRED based on another attribute
                            # Need to check AvailabilityType here
                            # Placeholder: Assuming a 'type' attribute in EmployeeAvailability
                            # if avail.type == AvailabilityType.PREFERRED: # TODO: Use actual enum
                            #     preference_score += 5
                            # elif avail.type == AvailabilityType.AVAILABLE: # TODO: Use actual enum
                            #     preference_score += 1
                            # else: # UNAVAILABLE should be handled by hard constraints, but scoring here too for completeness
                            #     preference_score -= 10 # Example penalty

                    # Store the preference score for this employee, date, and interval
                    if employee.id not in preference_constraints:
                        preference_constraints[employee.id] = {}
                    if current_date not in preference_constraints[employee.id]:
                        preference_constraints[employee.id][current_date] = {}
                    preference_constraints[employee.id][current_date][
                        interval_start_time
                    ] = preference_score

                current_interval_start_dt += scheduling_interval_timedelta

        constraints["soft"]["preference_satisfaction"] = preference_constraints
        print(f"Processed preference satisfaction for scheduling period.")

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

        # TODO: Populate these dictionaries based on data["employees"] and data["shift_templates"]
        # Assuming Employee model has a 'skills' attribute (list of Skill objects or skill_ids)
        # Assuming ShiftTemplate model has a 'required_skills' attribute (list of Skill objects or skill_ids)
        for employee in data["employees"]:
            # Placeholder: Assuming employee.skills is a list of skill IDs
            employee_skill_ids = (
                [skill.id for skill in employee.skills]
                if hasattr(employee, "skills") and employee.skills
                else []
            )
            skill_matching_constraints["employee_skills"][employee.id] = (
                employee_skill_ids
            )

        for shift_template in data["shift_templates"]:
            # Placeholder: Assuming shift_template.required_skills is a list of skill IDs
            required_skill_ids = (
                [skill.id for skill in shift_template.required_skills]
                if hasattr(shift_template, "required_skills")
                and shift_template.required_skills
                else []
            )
            skill_matching_constraints["shift_requirements"][shift_template.id] = (
                required_skill_ids
            )

        constraints["soft"]["skill_matching"] = skill_matching_constraints
        print("Processed initial structure for skill matching.")

        # Shift Continuity
        # Structure: {employee_id: {pattern_type: score}} or similar, based on historical schedules
        shift_continuity_constraints = {}  # Dictionary to store shift continuity preferences

        # Implement logic to model preferences for consistent shift patterns
        # This will likely involve analyzing historical schedules (data["schedules"]) to identify patterns (e.g., preferring not to alternate between early/late shifts)
        # TODO: Analyze historical schedules for each employee (data["schedules"]) to identify shift patterns and assign scores/penalties for pattern breaks.
        # Consider patterns like consecutive shifts, alternating shifts (e.g., early to late), and preferred days/times off.
        for employee in data["employees"]:
            shift_continuity_constraints[
                employee.id
            ] = {}  # Initialize for each employee

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

        delta = scheduling_end_date - scheduling_start_date
        for i in range(delta.days + 1):
            current_date = scheduling_start_date + timedelta(days=i)
            generated_schedule[current_date] = {}  # Initialize for the current date

            # Get store opening and closing hours from settings for the current date
            # TODO: Implement logic to get store hours from settings considering special days
            # For now, using placeholders
            store_open_time_str = "09:00"  # Placeholder
            store_close_time_str = "20:00"  # Placeholder
            store_open_time = time(
                int(store_open_time_str.split(":")[0]),
                int(store_open_time_str.split(":")[1]),
            )
            store_close_time = time(
                int(store_close_time_str.split(":")[0]),
                int(store_close_time_str.split(":")[1]),
            )

            current_time = datetime.combine(current_date, store_open_time)
            end_of_day = datetime.combine(current_date, store_close_time)

            while current_time < end_of_day:
                interval_start_time = current_time.time()
                generated_schedule[current_date][
                    interval_start_time
                ] = []  # Initialize list of assigned employees for this interval

                # Get required coverage for this interval
                coverage_requirements = (
                    processed_data["hard"]["coverage"]
                    .get(current_date, {})
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
                        .get(current_date, {})
                        .get(interval_start_time, False)
                    )

                    is_absent = False
                    for start_date, end_date in processed_data["hard"]["absence"].get(
                        employee_id, []
                    ):
                        if start_date <= current_date <= end_date:
                            is_absent = True
                            break

                    # TODO: Add check for Rest Period Requirements (min_rest_start_time_next_shift)
                    # min_start_time = processed_data["hard"]["rest_periods"].get(employee_id, {}).get(current_date, time(0, 0))
                    # if interval_start_time < min_start_time:
                    #     is_available = False # Or mark as unavailable due to rest period

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
                    keyholder_employee = None  # Find from eligible_employees
                    if keyholder_employee:
                        generated_schedule[current_date][interval_start_time].append(
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
                        generated_schedule[current_date][interval_start_time].append(
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

        # TODO: Implement constraint validation logic.
        # Iterate through the generated_schedule and check against all hard constraints (availability, absence, coverage, keyholder, working hours, rest periods).
        # This will involve iterating through each assigned shift in the generated_schedule and verifying it against the corresponding constraints in processed_data["hard"]
        # For Availability and Absence, check if the assigned employee is available/not absent during the shift interval.
        # For Coverage, check if the number of assigned employees meets the minimum required count and if keyholder requirements are met.
        # For Working Hours Limits, track daily and weekly hours for each employee based on assigned shifts and check against limits.
        # For Rest Periods, check the time between consecutive shifts for each employee.

        # violations = self._validate_schedule(generated_schedule, processed_data["hard"])
        # print(f"Hard Constraint Violations: {len(violations)}")
        print("Constraint Validation Phase Complete (Placeholder).")

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
