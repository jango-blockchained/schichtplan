#!/usr/bin/env python3
"""
Fix Shift Distribution

This script modifies the distribution algorithm to ensure a better balance of EARLY, MIDDLE, and LATE shifts.
The main issue is that the current algorithm processes all EARLY shifts first, then MIDDLE, then LATE.
By the time it gets to MIDDLE and LATE shifts, employees have reached their maximum shift limits.
"""

import os
import sys
import logging
import importlib
import inspect

# Add parent directories to path
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.abspath(os.path.join(current_dir, "..", ".."))
root_dir = os.path.abspath(os.path.join(backend_dir, ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

# Configure basic logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("fix_shift_distribution")


def print_section(title):
    """Print a section title with formatting"""
    print("\n" + "=" * 80)
    print(f" {title} ".center(80, "="))
    print("=" * 80 + "\n")


def create_improved_distribution_algorithm():
    """Create an improved version of the distribution algorithm

    This function creates a modified version of assign_employees_with_distribution
    that interleaves shifts by type instead of processing all EARLY shifts first.
    """
    import_path = "src.backend.services.scheduler.distribution"
    distribution_module = importlib.import_module(import_path)
    original_code = inspect.getsource(
        distribution_module.DistributionManager.assign_employees_with_distribution
    )

    # Create the improved implementation
    improved_code = '''
    def assign_employees_with_distribution(
        self, current_date: date, shifts: List[Any], coverage: Dict[str, int]
    ) -> List[Dict]:
        """Assign employees to shifts using distribution metrics"""
        try:
            self.logger.info(f"Starting employee assignment for date {current_date}")
            self.logger.info(f"Available shifts: {len(shifts)}")
            self.logger.info(f"Coverage requirements: {coverage}")

            assignments = []

            # First assign keyholders if needed
            try:
                self.logger.info("Attempting to assign keyholders")
                keyholder_assignments = self.assign_keyholders(current_date, shifts)
                if keyholder_assignments:
                    self.logger.info(
                        f"Assigned {len(keyholder_assignments)} keyholders"
                    )
                    assignments.extend(keyholder_assignments)
                else:
                    self.logger.warning("No keyholder assignments made")
            except Exception as e:
                self.logger.error(f"Error assigning keyholders: {str(e)}")
                self.logger.error("Stack trace:", exc_info=True)

            # Group remaining shifts by type
            shifts_by_type = {}
            for shift in shifts:
                if not self.is_shift_assigned(shift, assignments):
                    # Get shift type using various fallbacks
                    shift_type = self.extract_shift_type(shift)
                    self.logger.info(f"Categorized shift as type {shift_type}")

                    if shift_type not in shifts_by_type:
                        shifts_by_type[shift_type] = []
                    shifts_by_type[shift_type].append(shift)

            self.logger.info(
                f"Remaining shifts by type: {[(t, len(s)) for t, s in shifts_by_type.items()]}"
            )

            # If we have no shift types categorized, try a fallback approach
            if not shifts_by_type:
                self.logger.warning("No shifts categorized by type. Using fallback approach.")
                # Fallback: Just put all shifts in a GENERAL category
                shifts_by_type["GENERAL"] = [s for s in shifts if not self.is_shift_assigned(s, assignments)]
                self.logger.info(f"Fallback - Assigned {len(shifts_by_type['GENERAL'])} shifts to GENERAL type")

            # === IMPROVED ASSIGNMENT APPROACH ===
            # Instead of processing all shifts of one type before moving to the next,
            # we'll interleave them to ensure a balanced mix of shift types
            
            # Create a prioritized list of shift types
            # Put MIDDLE shifts first since we need more of these
            prioritized_types = []
            
            # Add MIDDLE first if available
            if "MIDDLE" in shifts_by_type:
                prioritized_types.append("MIDDLE")
            
            # Add LATE next if available
            if "LATE" in shifts_by_type:
                prioritized_types.append("LATE")
                
            # Add EARLY last if available (since we tend to over-assign these)
            if "EARLY" in shifts_by_type:
                prioritized_types.append("EARLY")
                
            # Add any other types
            for shift_type in shifts_by_type:
                if shift_type not in prioritized_types:
                    prioritized_types.append(shift_type)
                    
            self.logger.info(f"Prioritized shift types: {prioritized_types}")
            
            # Get all available employees
            all_available_employees = self.get_available_employees(current_date, shifts)
            self.logger.info(f"Total available employees: {len(all_available_employees)}")
            if not all_available_employees:
                self.logger.warning("No available employees!")
                return assignments
                
            # Initialize counters for each shift type
            assigned_by_type = {shift_type: 0 for shift_type in shifts_by_type}
            
            # Process shifts in a round-robin fashion by type
            max_iterations = sum(len(type_shifts) for type_shifts in shifts_by_type.values())
            iteration = 0
            
            while iteration < max_iterations:
                # Process one shift of each type before moving to the next
                for shift_type in prioritized_types:
                    if shift_type not in shifts_by_type or not shifts_by_type[shift_type]:
                        continue
                        
                    # Get the next shift of this type
                    current_shift = shifts_by_type[shift_type].pop(0)
                    
                    # Try to assign this shift
                    self.logger.info(f"Processing shift of type {shift_type}")
                    
                    # Get available employees for this specific shift
                    shift_template = None
                    shift_id = self.get_id(current_shift, ["id", "shift_id"])
                    
                    if isinstance(current_shift, dict):
                        shift_template = self.resources.get_shift(current_shift.get("shift_id", current_shift.get("id")))
                    else:
                        shift_template = self.resources.get_shift(shift_id)
                        
                    # Get employees specifically available for this shift
                    available_employees = []
                    if shift_template and self.availability_checker:
                        for employee in all_available_employees:
                            employee_id = self.get_id(employee, ["id", "employee_id"])
                            is_available, _ = self.availability_checker.is_employee_available(
                                employee_id, current_date, shift_template
                            )
                            if is_available:
                                available_employees.append(employee)
                    else:
                        # Fallback to all available employees
                        available_employees = all_available_employees
                    
                    self.logger.info(
                        f"Available employees for this {shift_type} shift: {len(available_employees)}"
                    )
                    
                    # Assign this shift
                    shift_assignments = self.assign_employees_by_type(
                        current_date, [current_shift], available_employees, shift_type
                    )
                    
                    # Track assignments
                    if shift_assignments:
                        self.logger.info(f"Assigned shift of type {shift_type}")
                        assignments.extend(shift_assignments)
                        assigned_by_type[shift_type] += 1
                    else:
                        self.logger.warning(f"No assignment made for this {shift_type} shift")
                        
                # Move to the next iteration
                iteration += 1
                
                # Check if we've assigned all shifts
                if all(len(shifts) == 0 for shifts in shifts_by_type.values()):
                    break
            
            self.logger.info(f"Total assignments made: {len(assignments)}")
            self.logger.info(f"Assignments by type: {assigned_by_type}")
            
            # Generate diagnostic information
            diagnostics = self.generate_diagnostic_report(current_date, shifts, assignments)
            
            # Log diagnostic information 
            self.logger.info(f"Assignment success rate: {diagnostics['success_rate']}%")
            
            if diagnostics['warnings']:
                for warning in diagnostics['warnings']:
                    self.logger.warning(f"Diagnostic warning: {warning}")
                
            # Log detailed info if we have problems
            if diagnostics['success_rate'] < 100:
                self.logger.warning("Incomplete assignment - detailed diagnostic information follows:")
                self.logger.warning(f"Unassigned shifts: {len(diagnostics['unassigned_shifts'])}")
                for shift in diagnostics['unassigned_shifts']:
                    self.logger.warning(f"  Shift {shift['shift_id']} ({shift['shift_type']}): {', '.join(shift['reasons'])}")
            
            return assignments

        except Exception as e:
            self.logger.error(f"Error in assign_employees_with_distribution: {str(e)}")
            self.logger.error("Stack trace:", exc_info=True)
            raise
    '''

    return original_code, improved_code


def modify_distribution_file():
    """Create a backup of the original distribution.py and apply the improved algorithm"""

    # Get the paths
    distribution_file = os.path.join(
        backend_dir, "services", "scheduler", "distribution.py"
    )
    backup_file = os.path.join(
        backend_dir, "services", "scheduler", "distribution.py.bak"
    )

    # Check if the file exists
    if not os.path.exists(distribution_file):
        print(f"Error: Distribution file not found at {distribution_file}")
        return False

    # Create a backup if it doesn't exist
    if not os.path.exists(backup_file):
        print(f"Creating backup of original file to {backup_file}")
        with open(distribution_file, "r") as src:
            with open(backup_file, "w") as dst:
                dst.write(src.read())

    try:
        # Get the original and improved algorithm code
        original_code, improved_code = create_improved_distribution_algorithm()

        # Read the current file content
        with open(distribution_file, "r") as file:
            content = file.read()

        # Replace the old implementation with the new one
        updated_content = content.replace(original_code, improved_code)

        # Write the updated content back to the file
        with open(distribution_file, "w") as file:
            file.write(updated_content)

        print(f"Successfully updated {distribution_file} with improved algorithm")
        return True
    except Exception as e:
        print(f"Error modifying distribution file: {e}")
        return False


def restore_distribution_file():
    """Restore the original distribution.py from backup"""

    # Get the paths
    distribution_file = os.path.join(
        backend_dir, "services", "scheduler", "distribution.py"
    )
    backup_file = os.path.join(
        backend_dir, "services", "scheduler", "distribution.py.bak"
    )

    # Check if backup exists
    if not os.path.exists(backup_file):
        print(f"Error: Backup file not found at {backup_file}")
        return False

    # Restore the backup
    with open(backup_file, "r") as src:
        with open(distribution_file, "w") as dst:
            dst.write(src.read())

    print(f"Successfully restored {distribution_file} from backup")
    return True


def main():
    print_section("SHIFT DISTRIBUTION FIXER")
    print(
        "This tool improves the distribution algorithm to ensure a balanced mix of shift types."
    )

    # Get action from command line
    import argparse

    parser = argparse.ArgumentParser(description="Fix shift distribution algorithm")
    parser.add_argument(
        "--action",
        choices=["apply", "restore"],
        default="apply",
        help="Apply the fix or restore from backup",
    )

    args = parser.parse_args()

    if args.action == "apply":
        print("Applying improved distribution algorithm...")
        success = modify_distribution_file()
    else:
        print("Restoring original distribution algorithm...")
        success = restore_distribution_file()

    if success:
        print("\nAction completed successfully.")
        print("\nTo test the changes, run the scheduler diagnostic:")
        print(
            "  python -m src.backend.tools.debug.scheduler_diagnostic --start 2024-11-01 --end 2024-11-07"
        )
    else:
        print("\nAction failed. See error messages above.")

    print("\n" + "=" * 80)
    print(" PROCESS COMPLETE ".center(80, "="))
    print("=" * 80)


if __name__ == "__main__":
    main()
