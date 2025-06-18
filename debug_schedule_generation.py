#!/usr/bin/env python3
"""
Diagnostic script to debug why schedule generation is not creating any shift assignments.
This script will check each step of the schedule generation process to identify where it's failing.
"""

import sys
from datetime import date, timedelta
import logging

# Add the backend directory to the path
sys.path.insert(0, '/home/jango/Git/maike2/schichtplan/src/backend')

def setup_logging():
    """Setup logging to see detailed output"""
    logging.basicConfig(
        level=logging.DEBUG,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    return logging.getLogger(__name__)

def check_database_data():
    """Check if basic data exists in the database"""
    logger = logging.getLogger(__name__)
    
    try:
        from flask import Flask
        from models import Employee, ShiftTemplate, Coverage, Settings
        from app import create_app
        
        # Create Flask app context
        app = create_app()
        
        with app.app_context():
            logger.info("=== CHECKING DATABASE DATA ===")
            
            # Check employees
            employees = Employee.query.filter_by(is_active=True).all()
            logger.info(f"Active employees: {len(employees)}")
            for emp in employees[:5]:  # Show first 5
                logger.info(f"  - {emp.first_name} {emp.last_name} (ID: {emp.id}, Group: {emp.employee_group}, Keyholder: {emp.is_keyholder})")
            
            # Check shift templates
            shift_templates = ShiftTemplate.query.all()
            logger.info(f"Shift templates: {len(shift_templates)}")
            for shift in shift_templates[:5]:  # Show first 5
                logger.info(f"  - Shift {shift.id}: {shift.start_time}-{shift.end_time}, Type: {shift.shift_type}, Active Days: {shift.active_days}")
            
            # Check coverage
            coverage_blocks = Coverage.query.all()
            logger.info(f"Coverage blocks: {len(coverage_blocks)}")
            for cov in coverage_blocks[:5]:  # Show first 5
                logger.info(f"  - Coverage {cov.id}: Day {cov.day_index}, {cov.start_time}-{cov.end_time}, Min: {cov.min_employees}, Keyholder: {cov.requires_keyholder}")
            
            # Check settings
            settings = Settings.query.first()
            if settings:
                logger.info(f"Settings exist: General={settings.general is not None}, Scheduling={settings.scheduling is not None}")
                if settings.general:
                    logger.info(f"  Store hours: {settings.general.get('store_opening', 'NOT SET')} - {settings.general.get('store_closing', 'NOT SET')}")
            else:
                logger.warning("No settings found in database!")
            
            return {
                'employees': len(employees),
                'shifts': len(shift_templates),
                'coverage': len(coverage_blocks),
                'settings': settings is not None
            }
            
    except Exception as e:
        logger.error(f"Error checking database data: {e}")
        return None

def test_schedule_generation():
    """Test the schedule generation process step by step"""
    logger = logging.getLogger(__name__)
    
    try:
        from services.scheduler.generator import ScheduleGenerator
        from app import create_app
        
        app = create_app()
        
        with app.app_context():
            logger.info("=== TESTING SCHEDULE GENERATION ===")
            
            # Test with current week
            today = date.today()
            start_date = today - timedelta(days=today.weekday())  # Monday
            end_date = start_date + timedelta(days=6)  # Sunday
            
            logger.info(f"Testing schedule generation for {start_date} to {end_date}")
            
            # Create generator
            generator = ScheduleGenerator()
            logger.info(f"Created generator with session ID: {generator.session_id}")
            
            # Test resource loading
            logger.info("Loading resources...")
            generator.resources.load()
            verification = generator.resources.verify_loaded_resources()
            logger.info(f"Resource verification result: {verification}")
            
            logger.info("Loaded resources:")
            logger.info(f"  - Employees: {len(generator.resources.employees) if generator.resources.employees else 0}")
            logger.info(f"  - Shifts: {len(generator.resources.shifts) if generator.resources.shifts else 0}")
            logger.info(f"  - Coverage: {len(generator.resources.coverage) if generator.resources.coverage else 0}")
            logger.info(f"  - Availabilities: {len(generator.resources.availabilities) if generator.resources.availabilities else 0}")
            
            # Test coverage processing for a single date
            test_date = start_date
            logger.info(f"\nTesting coverage processing for {test_date} (weekday {test_date.weekday()})")
            
            coverage_by_interval = generator._process_coverage(test_date)
            logger.info(f"Coverage intervals found: {len(coverage_by_interval)}")
            for interval, requirements in coverage_by_interval.items():
                logger.info(f"  - {interval}: {len(requirements)} requirement(s)")
                for req in requirements:
                    logger.info(f"    - Min: {req['min_employees']}, Max: {req.get('max_employees', 'N/A')}, Keyholder: {req['requires_keyholder']}")
            
            # Test shift creation for the date
            logger.info(f"\nTesting shift creation for {test_date}")
            date_shifts = generator._create_date_shifts(test_date)
            logger.info(f"Created {len(date_shifts)} shift instances")
            for shift in date_shifts[:3]:  # Show first 3
                logger.info(f"  - Shift {shift['id']}: {shift['start_time']}-{shift['end_time']}, Type: {shift['shift_type']}, Min employees: {shift['min_employees']}")
            
            # Test assignment generation for the date
            logger.info(f"\nTesting assignment generation for {test_date}")
            assignments = generator._generate_assignments_for_date(test_date)
            logger.info(f"Generated {len(assignments)} assignments")
            for assignment in assignments[:3]:  # Show first 3
                logger.info(f"  - Employee {assignment.get('employee_id')}, Shift {assignment.get('shift_id')}, Date {assignment.get('date')}")
            
            # Test full generation
            logger.info("Testing full schedule generation...")
            try:
                result = generator.generate(
                    start_date=start_date,
                    end_date=end_date,
                    create_empty_schedules=True,
                    version=1
                )
                
                logger.info(f"Full generation completed. Result keys: {list(result.keys())}")
                if 'schedules' in result:
                    schedules = result['schedules']
                    logger.info(f"Generated {len(schedules)} total schedule entries")
                    assigned_schedules = [s for s in schedules if s.get('shift_id') is not None]
                    logger.info(f"  - {len(assigned_schedules)} with actual shift assignments")
                    empty_schedules = [s for s in schedules if s.get('shift_id') is None]
                    logger.info(f"  - {len(empty_schedules)} empty schedule entries")
                
            except Exception as e:
                logger.error(f"Error in full generation: {e}", exc_info=True)
            
    except Exception as e:
        logger.error(f"Error in schedule generation test: {e}", exc_info=True)

def test_distribution_manager():
    """Test the distribution manager specifically"""
    logger = logging.getLogger(__name__)
    
    try:
        from services.scheduler.generator import ScheduleGenerator
        from app import create_app
        
        app = create_app()
        
        with app.app_context():
            logger.info("=== TESTING DISTRIBUTION MANAGER ===")
            
            generator = ScheduleGenerator()
            generator.resources.load()
            
            test_date = date.today()
            logger.info(f"Testing distribution manager for {test_date}")
            
            # Get available employees
            available_employees = generator.resources.employees if generator.resources.employees else []
            logger.info(f"Available employees: {len(available_employees)}")
            
            # Get date shifts
            date_shifts = generator._create_date_shifts(test_date)
            logger.info(f"Date shifts: {len(date_shifts)}")
            
            if date_shifts and available_employees:
                # Test distribution manager directly
                dm = generator.distribution_manager
                logger.info(f"Distribution manager: {dm}")
                
                assignments = dm.generate_assignments_for_day(test_date, date_shifts, available_employees)
                logger.info(f"Distribution manager generated {len(assignments)} assignments")
                
                for assignment in assignments[:3]:
                    logger.info(f"  - {assignment}")
            else:
                logger.warning("No shifts or employees available for distribution testing")
                
    except Exception as e:
        logger.error(f"Error testing distribution manager: {e}", exc_info=True)

def main():
    """Main diagnostic function"""
    logger = setup_logging()
    logger.info("Starting schedule generation diagnostics...")
    
    # Check database data first
    data_status = check_database_data()
    if not data_status:
        logger.error("Failed to check database data. Cannot continue.")
        return
    
    # If we have basic data, test the generation process
    if data_status['employees'] > 0 and data_status['shifts'] > 0:
        test_schedule_generation()
        test_distribution_manager()
    else:
        logger.error("Insufficient data in database:")
        logger.error(f"  - Employees: {data_status['employees']}")
        logger.error(f"  - Shift templates: {data_status['shifts']}")
        logger.error(f"  - Coverage blocks: {data_status['coverage']}")
        logger.error("Please ensure demo data is created first.")

if __name__ == "__main__":
    main()
