"""
Example file showing how to update imports from schedule_generator.py to the new scheduler package.
"""

# Old imports:
# from services.schedule_generator import ScheduleGenerator, ScheduleGenerationError
# from services.schedule_generator import is_early_shift, is_late_shift, requires_keyholder

# New imports:
from services.scheduler import (
    ScheduleGenerator,
    ScheduleResources,
    ScheduleValidator,
    ScheduleConfig,
    is_early_shift,
    is_late_shift,
    requires_keyholder,
)


# Example usage:
def example_function():
    generator = ScheduleGenerator()

    # Example of using utility functions
    def check_shift_type(shift):
        if is_early_shift(shift):
            print("This is an early shift")
        elif is_late_shift(shift):
            print("This is a late shift")

        if requires_keyholder(shift):
            print("This shift requires a keyholder")

    # Example of direct resource manipulation
    resources = ScheduleResources()
    resources.load()

    # Example of validation
    validator = ScheduleValidator(resources)
    config = ScheduleConfig(enforce_min_coverage=True, enforce_contracted_hours=True)

    return "Example complete"
