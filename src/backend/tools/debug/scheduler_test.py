#!/usr/bin/env python3
"""
Scheduler Distribution Test Script
Used to verify the fixes for the distribution algorithm
"""

import sys
import os
import logging
from datetime import date, datetime, timedelta
from collections import defaultdict

# Add parent directories to path
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.abspath(os.path.join(current_dir, "..", ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(os.path.join(current_dir, 'scheduler_test.log'))
    ]
)

logger = logging.getLogger(__name__)
logger.info("Starting scheduler distribution test")

# Define mock model classes directly to avoid import issues
class Employee:
    """Mock Employee class for testing"""
    def __init__(self):
        self.id = None
        self.first_name = ""
        self.last_name = ""
        self.is_active = True
        self.is_keyholder = False
        self.preferred_shift_types = []
        self.skills = []
        self.contracted_hours = 40.0
        
    def __str__(self):
        return f"{self.first_name} {self.last_name} (ID: {self.id})"

class ShiftTemplate:
    """Mock ShiftTemplate class for testing"""
    def __init__(self):
        self.id = None
        self.start_time = "00:00"
        self.end_time = "00:00"
        self.shift_type = ""
        self.shift_type_id = ""
        self.duration_hours = 0.0
        self.required_skills = []
        
    def __str__(self):
        return f"Shift {self.id} ({self.start_time}-{self.end_time} {self.shift_type})"

# Import the distribution manager - this should work with our mock classes
try:
    from services.scheduler.distribution import DistributionManager
except ImportError as e:
    logger.error(f"Import error: {e}")
    sys.exit(1)

class MockResources:
    """Mock resources for testing the distribution manager"""
    
    def __init__(self):
        # Create test employees
        self.employees = [
            self._create_employee(1, "John", "Smith", True, True, ["EARLY"]),
            self._create_employee(2, "Jane", "Doe", True, False, ["MIDDLE"]),
            self._create_employee(3, "Bob", "Johnson", True, False, ["LATE"]),
            self._create_employee(4, "Alice", "Williams", True, False, ["EARLY", "MIDDLE"]),
            self._create_employee(5, "Charlie", "Brown", True, True, ["MIDDLE", "LATE"]),
        ]
        
        # Create test shifts
        self.shifts = {
            1: self._create_shift(1, "06:00", "14:00", "EARLY"),
            2: self._create_shift(2, "10:00", "18:00", "MIDDLE"),
            3: self._create_shift(3, "14:00", "22:00", "LATE"),
            4: self._create_shift(4, "08:00", "16:00", "EARLY"),
            5: self._create_shift(5, "12:00", "20:00", "LATE"),
        }
        
        self.shift_instances = []
        
    def _create_employee(self, id, first_name, last_name, is_active, is_keyholder, preferred_shifts):
        """Create a mock employee"""
        employee = Employee()
        employee.id = id
        employee.first_name = first_name
        employee.last_name = last_name
        employee.is_active = is_active
        employee.is_keyholder = is_keyholder
        employee.preferred_shift_types = preferred_shifts
        employee.skills = []
        employee.contracted_hours = 40.0
        return employee
        
    def _create_shift(self, id, start_time, end_time, shift_type):
        """Create a mock shift template"""
        shift = ShiftTemplate()
        shift.id = id
        shift.start_time = start_time
        shift.end_time = end_time
        shift.shift_type = shift_type
        shift.shift_type_id = shift_type
        shift.duration_hours = self._calculate_duration(start_time, end_time)
        shift.required_skills = []
        return shift
        
    def _calculate_duration(self, start_time, end_time):
        """Calculate shift duration in hours"""
        start_h, start_m = map(int, start_time.split(':'))
        end_h, end_m = map(int, end_time.split(':'))
        
        start_minutes = start_h * 60 + start_m
        end_minutes = end_h * 60 + end_m
        
        # Handle shifts crossing midnight
        if end_minutes < start_minutes:
            end_minutes += 24 * 60
            
        duration_minutes = end_minutes - start_minutes
        return duration_minutes / 60.0
        
    def get_shift(self, shift_id):
        """Get a shift template by ID"""
        if not shift_id:
            return None
        return self.shifts.get(shift_id)
        
    def create_shift_instance(self, shift_template_id, shift_date):
        """Create a shift instance for testing"""
        shift_template = self.get_shift(shift_template_id)
        if not shift_template:
            return None
            
        shift_instance = {
            "id": len(self.shift_instances) + 1,
            "shift_id": shift_template_id,
            "date": shift_date,
            "start_time": shift_template.start_time,
            "end_time": shift_template.end_time,
            "shift_type": shift_template.shift_type,
            "shift_type_id": shift_template.shift_type_id
        }
        
        self.shift_instances.append(shift_instance)
        return shift_instance

class MockAvailabilityChecker:
    """Mock availability checker for testing"""
    
    def is_employee_on_leave(self, employee_id, date_to_check):
        """Check if employee is on leave - for testing, employee 3 is on leave on odd days"""
        if employee_id == 3 and date_to_check.day % 2 == 1:
            return True
        return False
        
    def is_employee_available(self, employee_id, date_to_check, shift_template):
        """Check if employee is available for a shift"""
        # Skip if employee is on leave
        if self.is_employee_on_leave(employee_id, date_to_check):
            return False, "UNAVAILABLE"
            
        # For testing, employees are only available for their preferred shift types
        shift_type = getattr(shift_template, "shift_type_id", None) or getattr(shift_template, "shift_type", None)
        
        # Find the employee to check their preferences
        for employee in mock_resources.employees:
            if employee.id == employee_id:
                if shift_type in employee.preferred_shift_types:
                    return True, "PREFERRED"
                # Still available for non-preferred shifts but at lower priority
                return True, "AVAILABLE"
                
        return False, "UNAVAILABLE"

class MockConstraintChecker:
    """Mock constraint checker for testing"""
    
    def __init__(self):
        self.assignments = {}
        self.schedule_by_date = {}
        
    def set_schedule(self, assignments, schedule_by_date):
        """Set the current assignments and schedule"""
        self.assignments = assignments
        self.schedule_by_date = schedule_by_date
        
    def exceeds_constraints(self, employee, date_to_check, shift_template):
        """Check if employee would exceed constraints with this shift"""
        # For testing, no constraints are exceeded
        return False

def run_distribution_test():
    """Run a test of the distribution algorithm"""
    logger.info("Initializing test resources")
    
    # Initialize components
    global mock_resources
    mock_resources = MockResources()
    availability_checker = MockAvailabilityChecker()
    constraint_checker = MockConstraintChecker()
    
    # Create the distribution manager
    distribution_manager = DistributionManager(
        resources=mock_resources,
        availability_checker=availability_checker,
        constraint_checker=constraint_checker,
        logger=logger
    )
    
    # Create test data for one day
    test_date = date.today()
    logger.info(f"Testing distribution for date: {test_date}")
    
    # Create shift instances for the test date
    shifts = []
    for shift_id in range(1, 6):
        shift_instance = mock_resources.create_shift_instance(shift_id, test_date)
        shifts.append(shift_instance)
        
    logger.info(f"Created {len(shifts)} shift instances for testing")
    
    # Run the distribution algorithm
    logger.info("Running distribution algorithm")
    coverage = {"EARLY": 2, "MIDDLE": 1, "LATE": 2}
    
    try:
        assignments = distribution_manager.assign_employees_with_distribution(
            test_date, shifts, coverage
        )
        
        # Log the results
        logger.info(f"Distribution complete - {len(assignments)} assignments created")
        
        if assignments:
            logger.info("Assignments created:")
            for idx, assignment in enumerate(assignments, 1):
                shift_id = assignment.get("shift_id")
                employee_id = assignment.get("employee_id")
                shift_type = assignment.get("shift_type")
                
                logger.info(f"  {idx}. Employee {employee_id} assigned to shift {shift_id} ({shift_type})")
                
            # Check for unassigned shifts
            assigned_shift_ids = [a.get("shift_id") for a in assignments]
            for shift in shifts:
                shift_id = shift.get("shift_id") or shift.get("id")
                if shift_id not in assigned_shift_ids:
                    logger.warning(f"Shift {shift_id} ({shift.get('shift_type')}) was not assigned")
        else:
            logger.error("No assignments were created by the distribution algorithm")
            
    except Exception as e:
        logger.error(f"Error in distribution test: {str(e)}")
        logger.exception("Stack trace:")
        
    return assignments

def run_multi_day_test():
    """Run a test over multiple days to verify proper distribution over time"""
    logger.info("Starting multi-day distribution test")
    
    # Initialize components
    global mock_resources
    mock_resources = MockResources()
    availability_checker = MockAvailabilityChecker()
    constraint_checker = MockConstraintChecker()
    
    # Create the distribution manager
    distribution_manager = DistributionManager(
        resources=mock_resources,
        availability_checker=availability_checker,
        constraint_checker=constraint_checker,
        logger=logger
    )
    
    # Test over 5 consecutive days
    today = date.today()
    test_dates = [today + timedelta(days=i) for i in range(5)]
    
    # Track all assignments across all days
    all_assignments = []
    daily_assignments = {}
    
    # Create and run schedule for each day
    for test_date in test_dates:
        logger.info(f"\n--- Testing distribution for date: {test_date} ---")
        
        # Create shift instances for the test date (5 shifts per day)
        shifts = []
        for shift_id in range(1, 6):
            shift_instance = mock_resources.create_shift_instance(shift_id, test_date)
            shifts.append(shift_instance)
            
        logger.info(f"Created {len(shifts)} shift instances for {test_date}")
        
        # Define coverage requirements
        coverage = {"EARLY": 2, "MIDDLE": 1, "LATE": 2}
        
        # Run the distribution algorithm
        try:
            assignments = distribution_manager.assign_employees_with_distribution(
                test_date, shifts, coverage
            )
            
            # Store the results
            daily_assignments[test_date] = assignments
            all_assignments.extend(assignments)
            
            # Log the results for this day
            logger.info(f"Day {test_date} - {len(assignments)}/{len(shifts)} shifts assigned")
            
            if assignments:
                # Count assignments by employee
                employee_counts = defaultdict(int)
                for assignment in assignments:
                    employee_id = assignment.get("employee_id")
                    employee_counts[employee_id] += 1
                
                # Log employee assignment counts for this day
                logger.info("Assignments per employee:")
                for emp_id, count in employee_counts.items():
                    logger.info(f"  Employee {emp_id}: {count} shifts")
                    
                # Check for unassigned shifts
                assigned_shift_ids = [a.get("shift_id") for a in assignments]
                for shift in shifts:
                    shift_id = shift.get("shift_id") or shift.get("id")
                    if shift_id not in assigned_shift_ids:
                        logger.warning(f"Shift {shift_id} ({shift.get('shift_type')}) was not assigned")
            else:
                logger.error(f"No assignments were created for {test_date}")
                
        except Exception as e:
            logger.error(f"Error in distribution test for {test_date}: {str(e)}")
            logger.exception("Stack trace:")
    
    # Analyze the entire test period
    logger.info("\n--- Multi-day test summary ---")
    logger.info(f"Test period: {test_dates[0]} to {test_dates[-1]}")
    logger.info(f"Total shifts: {len(test_dates) * 5}")
    logger.info(f"Total assignments made: {len(all_assignments)}")
    
    # Analyze assignments per employee over the whole period
    employee_totals = defaultdict(int)
    employee_by_day = defaultdict(lambda: defaultdict(int))
    
    for assignment in all_assignments:
        employee_id = assignment.get("employee_id")
        assignment_date = assignment.get("date")
        
        employee_totals[employee_id] += 1
        employee_by_day[employee_id][assignment_date] += 1
    
    # Log employee assignment totals for the whole period
    logger.info("Assignments per employee (entire period):")
    for emp_id, count in sorted(employee_totals.items()):
        logger.info(f"  Employee {emp_id}: {count} shifts total")
        
        # Check daily assignments
        daily_counts = []
        for test_date in test_dates:
            daily_count = employee_by_day[emp_id][test_date]
            daily_counts.append(daily_count)
            
        logger.info(f"    Daily pattern: {daily_counts}")
        
        # Check for multiple shifts on the same day
        multiple_shifts_days = [
            date for date, count in employee_by_day[emp_id].items() 
            if count > 1
        ]
        if multiple_shifts_days:
            logger.warning(f"  Employee {emp_id} has multiple shifts on: {multiple_shifts_days}")
    
    # Check for fair distribution
    if employee_totals:
        min_shifts = min(employee_totals.values())
        max_shifts = max(employee_totals.values())
        avg_shifts = sum(employee_totals.values()) / len(employee_totals)
        
        logger.info(f"Distribution stats - Min: {min_shifts}, Max: {max_shifts}, Avg: {avg_shifts:.2f}")
        logger.info(f"Max-Min difference: {max_shifts - min_shifts}")
        
        # Flag unfair distribution if max-min > 3
        if max_shifts - min_shifts > 3:
            logger.warning("Potentially unfair distribution detected - high variance between employees")
    
    # Return all assignments for further analysis
    return all_assignments, daily_assignments

if __name__ == "__main__":
    try:
        # Run the single-day test first
        logger.info("Running single-day distribution test")
        single_day_assignments = run_distribution_test()
        
        if not single_day_assignments:
            logger.error("SINGLE-DAY TEST FAILED: Distribution algorithm did not generate any assignments")
            sys.exit(1)
        else:
            logger.info(f"SINGLE-DAY TEST PASSED: Distribution algorithm generated {len(single_day_assignments)} assignments")
            
        # Then run the multi-day test
        logger.info("\nRunning multi-day distribution test")
        multi_day_assignments, daily_assignments = run_multi_day_test()
        
        if not multi_day_assignments:
            logger.error("MULTI-DAY TEST FAILED: Distribution algorithm did not generate any assignments")
            sys.exit(1)
        else:
            logger.info(f"MULTI-DAY TEST PASSED: Distribution algorithm generated {len(multi_day_assignments)} assignments")
            
        # Final success message
        logger.info("\nAll tests passed successfully!")
        
    except Exception as e:
        logger.error(f"Test failed with exception: {e}")
        logger.exception("Stack trace:")
        sys.exit(1)
    
    sys.exit(0) 