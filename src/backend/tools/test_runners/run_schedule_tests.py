#!/usr/bin/env python
"""
Script to run all schedule generation tests.
This script runs all the schedule generation tests and provides a summary of the results.
"""

import sys
import logging
import time
import importlib
from datetime import datetime

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)s: %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger(__name__)

# List of test modules to run
TEST_MODULES = [
    "src.backend.tests.schedule.test_schedule_generation_extended",
    "src.backend.tests.schedule.test_schedule_constraints",
    "src.backend.tests.api.test_schedule_generation_api",
]


def run_tests():
    """Run all schedule generation tests."""
    logger.info("=" * 80)
    logger.info("SCHEDULE GENERATION TEST SUITE")
    logger.info("=" * 80)
    logger.info(f"Starting tests at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    logger.info("-" * 80)

    results = {}
    total_time = 0

    for module_name in TEST_MODULES:
        logger.info(f"\nRunning tests from module: {module_name}")
        try:
            # Import the module
            module = importlib.import_module(module_name)

            # Check if the module has a run_all_tests function
            if hasattr(module, "run_all_tests"):
                start_time = time.time()
                module_results = module.run_all_tests()
                end_time = time.time()

                execution_time = end_time - start_time
                total_time += execution_time

                results[module_name] = {
                    "status": "Success",
                    "results": module_results,
                    "time": execution_time,
                }

                logger.info(
                    f"Module '{module_name}' completed in {execution_time:.2f} seconds"
                )
            else:
                # For pytest modules, we'll need to run them differently
                logger.info(
                    f"Module '{module_name}' does not have a run_all_tests function. Skipping."
                )
                results[module_name] = {
                    "status": "Skipped",
                    "reason": "No run_all_tests function",
                }
        except Exception as e:
            logger.error(f"Error running tests from module '{module_name}': {str(e)}")
            results[module_name] = {"status": "Failed", "error": str(e)}

    # Print summary
    logger.info("\n" + "=" * 80)
    logger.info("TEST SUMMARY")
    logger.info("=" * 80)

    success_count = 0
    failed_count = 0
    skipped_count = 0

    for module_name, result in results.items():
        status = result["status"]
        logger.info(f"{module_name}: {status}")

        if status == "Success":
            success_count += 1
        elif status == "Failed":
            failed_count += 1
        elif status == "Skipped":
            skipped_count += 1

    logger.info("-" * 80)
    logger.info(f"Total modules: {len(TEST_MODULES)}")
    logger.info(f"Successful: {success_count}")
    logger.info(f"Failed: {failed_count}")
    logger.info(f"Skipped: {skipped_count}")
    logger.info(f"Total execution time: {total_time:.2f} seconds")
    logger.info(f"Tests completed at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    logger.info("=" * 80)

    return results


if __name__ == "__main__":
    run_tests()
