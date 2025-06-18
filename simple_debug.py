#!/usr/bin/env python3
"""
Simple diagnostic script to debug schedule generation issues.
"""

import sys
import logging
from datetime import date, timedelta

# Add the backend directory to the path
sys.path.insert(0, '/home/jango/Git/maike2/schichtplan/src/backend')

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

def main():
    """Main diagnostic function"""
    try:
        from app import create_app
        
        app = create_app()
        
        with app.app_context():
            logger.info("=== DATABASE CONTENT CHECK ===")
            
            # Import models inside app context
            from models import Employee, ShiftTemplate, Coverage, Settings
            
            # Check basic data
            employees = Employee.query.filter_by(is_active=True).all()
            logger.info(f"Active employees: {len(employees)}")
            if employees:
                for emp in employees[:3]:
                    logger.info(f"  Employee: {emp.first_name} {emp.last_name} (Keyholder: {emp.is_keyholder})")
            
            shifts = ShiftTemplate.query.all()
            logger.info(f"Shift templates: {len(shifts)}")
            if shifts:
                for shift in shifts[:3]:
                    logger.info(f"  Shift: {shift.start_time}-{shift.end_time}, Active days: {shift.active_days}")
            
            coverage = Coverage.query.all()
            logger.info(f"Coverage blocks: {len(coverage)}")
            if coverage:
                for cov in coverage[:3]:
                    logger.info(f"  Coverage: Day {cov.day_index}, {cov.start_time}-{cov.end_time}, Min: {cov.min_employees}")
            
            if not employees:
                logger.error("NO EMPLOYEES FOUND! This explains why no assignments are created.")
                return
            
            if not shifts:
                logger.error("NO SHIFT TEMPLATES FOUND! This explains why no assignments are created.")
                return
                
            if not coverage:
                logger.error("NO COVERAGE BLOCKS FOUND! This explains why no assignments are created.")
                return
            
            logger.info("\n=== TESTING SCHEDULE GENERATION ===")
            
            # Test schedule generation
            from services.scheduler.generator import ScheduleGenerator
            
            today = date.today()
            start_date = today - timedelta(days=today.weekday())  # Monday
            end_date = start_date + timedelta(days=6)  # Sunday
            
            logger.info(f"Testing generation for {start_date} to {end_date}")
            
            generator = ScheduleGenerator()
            logger.info(f"Generator created with session: {generator.session_id}")
            
            # Load resources
            generator.resources.load()
            logger.info("Resources loaded")
            
            logger.info(f"Resource counts:")
            logger.info(f"  Employees: {len(generator.resources.employees) if generator.resources.employees else 0}")
            logger.info(f"  Shifts: {len(generator.resources.shifts) if generator.resources.shifts else 0}")
            logger.info(f"  Coverage: {len(generator.resources.coverage) if generator.resources.coverage else 0}")
            logger.info(f"  Availabilities: {len(generator.resources.availabilities) if generator.resources.availabilities else 0}")
            
            # Test one day
            test_date = start_date
            logger.info(f"\nTesting single day: {test_date} (weekday {test_date.weekday()})")
            
            # Test coverage processing
            coverage_intervals = generator._process_coverage(test_date)
            logger.info(f"Coverage intervals for {test_date}: {len(coverage_intervals)}")
            for interval, reqs in coverage_intervals.items():
                logger.info(f"  {interval}: {len(reqs)} requirements")
            
            # Test shift creation
            date_shifts = generator._create_date_shifts(test_date)
            logger.info(f"Date shifts created: {len(date_shifts)}")
            for shift in date_shifts[:2]:
                logger.info(f"  Shift: {shift.get('id')}, {shift.get('start_time')}-{shift.get('end_time')}")
            
            # Test assignments
            assignments = generator._generate_assignments_for_date(test_date)
            logger.info(f"Assignments created: {len(assignments)}")
            for assign in assignments[:2]:
                logger.info(f"  Assignment: Employee {assign.get('employee_id')}, Shift {assign.get('shift_id')}")
            
            if len(assignments) == 0:
                logger.error("NO ASSIGNMENTS CREATED! Let's debug further...")
                
                # Check distribution manager
                dm = generator.distribution_manager
                if date_shifts and generator.resources.employees:
                    logger.info("Testing distribution manager directly...")
                    direct_assignments = dm.generate_assignments_for_day(
                        test_date, date_shifts, generator.resources.employees
                    )
                    logger.info(f"Distribution manager direct result: {len(direct_assignments)}")
                else:
                    logger.error("Missing shifts or employees for distribution manager test")
            
            logger.info("\n=== SUMMARY ===")
            logger.info(f"Employees: {len(employees)}")
            logger.info(f"Shifts: {len(shifts)}")
            logger.info(f"Coverage: {len(coverage)}")
            logger.info(f"Assignments created: {len(assignments) if 'assignments' in locals() else 'ERROR'}")
            
    except Exception as e:
        logger.error(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
