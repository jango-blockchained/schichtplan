"""Tests for the scheduler logging functionality."""

import logging
import os
import time
import pytest
from pathlib import Path
import shutil  # For directory removal
import traceback # Added import

# Add project root to path to allow imports
import sys
current_dir = Path(__file__).parent
# Go up 4 levels to reach the project root directory
project_root = current_dir.parent.parent.parent.parent
# Add the 'src' directory to the Python path
sys.path.insert(0, str(project_root / "src"))

# Import necessary classes (adjust paths if necessary)
from backend.services.scheduler import ScheduleGenerator, LoggingManager

# Define a temporary directory for test logs relative to this test file
TEST_LOG_DIR_NAME = "test_scheduler_logs"
TEST_LOG_DIR = current_dir / TEST_LOG_DIR_NAME

@pytest.fixture(scope="function")
def test_log_directory():
    """Pytest fixture to create and cleanup the test log directory."""
    # Setup: Create the directory
    TEST_LOG_DIR.mkdir(parents=True, exist_ok=True)
    print(f"\n[Test Fixture] Created test log directory: {TEST_LOG_DIR}")
    yield TEST_LOG_DIR
    # Teardown: Remove the directory and its contents
    try:
        shutil.rmtree(TEST_LOG_DIR)
        print(f"\n[Test Fixture] Removed test log directory: {TEST_LOG_DIR}")
    except OSError as e:
        print(f"\n[Test Fixture] Error removing directory {TEST_LOG_DIR}: {e}")

def test_diagnostic_log_creation_and_content(test_log_directory):
    """
    Tests if the LoggingManager creates the diagnostic log file and
    writes messages at different levels correctly when setup is called.
    """
    try:
        # 1. Instantiate Generator (which creates its own LoggingManager)
        generator = ScheduleGenerator()
        log_manager = generator.logging_manager
        assert log_manager is not None, "LoggingManager should be initialized"

        # 2. Setup logging to use the test directory and DEBUG level
        # We override the default diagnostic path calculation by providing log_dir
        # Note: setup_logging also initializes the diagnostic log internally
        print(f"\n[Test] Setting up logging to: {test_log_directory}")
        log_manager.setup_logging(
            log_level=logging.DEBUG,
            log_to_file=True,
            log_dir=test_log_directory,  # Use test dir for *all* file logs in this test
            app_log_dir=test_log_directory # Keep logs contained
        )

        # 3. Get the expected diagnostic log path
        diagnostic_log_path = log_manager.get_diagnostic_log_path()
        assert diagnostic_log_path is not None, "Diagnostic log path should be set"
        print(f"\n[Test] Verified diagnostic log path is set: {diagnostic_log_path}")

        # Ensure the file exists after setup (it writes initial lines)
        assert os.path.exists(diagnostic_log_path), f"Diagnostic log file should exist after setup: {diagnostic_log_path}"
        print(f"\n[Test] Verified diagnostic log file exists initially.")

        # 4. Trigger log messages via the generator's logger and manager
        log_manager.start_process("Test Logging Process")
        log_manager.start_step("Test Step 1")
        generator.logger.debug("This is a detailed debug message.")
        generator.logger.info("This is an info message.")
        log_manager.log_step_data("Sample Data", {"key": "value", "count": 5})
        generator.logger.warning("This is a warning message.")
        log_manager.end_step({"result": "Step 1 OK"})

        log_manager.start_step("Test Step 2")
        generator.logger.error("This is an error message.")
        log_manager.end_step()
        log_manager.end_process({"final_stat": "Complete"})

        # 5. Wait briefly for file buffers to flush
        time.sleep(0.2)

        # 6. Assertions
        print(f"\n[Test] Reading log file: {diagnostic_log_path}")
        assert os.path.exists(diagnostic_log_path), f"Diagnostic log file should still exist: {diagnostic_log_path}"

        with open(diagnostic_log_path, 'r') as f:
            log_content = f.read()

        print(f"\n[Test] Log Content:\n------\n{log_content[:1000]}...\n------") # Print first 1000 chars

        # Check for key messages / markers
        assert "===== Diagnostic logging initialized" in log_content, "Initial header missing"
        assert "===== STARTING PROCESS: Test Logging Process" in log_content, "Process start missing"
        assert "STEP 1: Test Step 1" in log_content, "Step 1 start missing"
        assert "DEBUG - This is a detailed debug message." in log_content, "Debug message missing"
        assert "INFO - This is an info message." in log_content, "Info message missing"
        # Check log_step_data output (logged as DEBUG by default)
        assert "DEBUG - [Step 1] Sample Data: {\"key\": \"value\", \"count\": 5}" in log_content, "Step data missing/incorrect"
        assert "WARNING - This is a warning message." in log_content, "Warning message missing"
        assert "Completed step 1: Test Step 1" in log_content, "Step 1 end missing"
        assert "STEP 2: Test Step 2" in log_content, "Step 2 start missing"
        assert "ERROR - This is an error message." in log_content, "Error message missing"
        assert "Completed step 2: Test Step 2" in log_content, "Step 2 end missing"
        assert "PROCESS COMPLETED" in log_content, "Process end missing"
        assert "STATS:" in log_content, "Final stats missing"
        assert "\"final_stat\": \"Complete\"" in log_content, "Final stats content missing"

        print(f"\n[Test] All log content assertions passed for {diagnostic_log_path}")

    except Exception as e:
        pytest.fail(f"Test failed with exception: {e}\n{traceback.format_exc()}") 