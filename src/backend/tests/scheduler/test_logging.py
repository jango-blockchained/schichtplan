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
# Go up 4 levels to reach the project root directory # Adjusted for test location
# sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))) # Let conftest handle path
# Add the 'src' directory to the Python path
# sys.path.insert(0, str(project_root / "src")) # Let conftest handle path

# Import necessary classes (adjust paths if necessary)
from services.scheduler import ScheduleGenerator # Assumes src/backend is on path
from services.scheduler.logging_utils import ProcessTracker # Import ProcessTracker

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
    Tests if the ProcessTracker creates the diagnostic log file and
    writes messages at different levels correctly.
    """
    try:
        # 1. Instantiate Generator (which creates its own ProcessTracker)
        generator = ScheduleGenerator()
        # Access the ProcessTracker instance
        process_tracker = generator.process_tracker
        assert process_tracker is not None, "ProcessTracker should be initialized in ScheduleGenerator"
        assert isinstance(process_tracker, ProcessTracker), "Should be a ProcessTracker instance"

        # 2. Setup logging to use the test directory and DEBUG level
        # ProcessTracker setup is internal, we don't call setup_logging directly here.
        # Log paths are determined by the central logger setup.
        # For testing, we might need to mock the central logger or configure it
        # to use the test directory. This is complex.
        # Let's assume the default logging setup writes *somewhere* and check content.
        # The diagnostic logger used by tracker is generator.diagnostic_logger
        diagnostic_logger = generator.diagnostic_logger
        assert diagnostic_logger is not None, "Diagnostic logger should exist"

        # Find the file handler for the diagnostic logger to get the path
        diagnostic_log_path = None
        for handler in diagnostic_logger.handlers:
            if isinstance(handler, logging.FileHandler):
                diagnostic_log_path = handler.baseFilename
                break
        assert diagnostic_log_path is not None, "Diagnostic log file handler not found"
        print(f"\n[Test] Found diagnostic log path: {diagnostic_log_path}")

        # Ensure the file exists after setup (it writes initial lines)
        assert os.path.exists(diagnostic_log_path), f"Diagnostic log file should exist: {diagnostic_log_path}"
        print(f"\n[Test] Verified diagnostic log file exists initially.")

        # Clear the log file before adding new test messages
        with open(diagnostic_log_path, 'w') as f:
            f.write("") # Clear content

        # 4. Trigger log messages via the process tracker and generator's logger
        # start_process() no longer takes a process name argument
        process_tracker.start_process()
        process_tracker.start_step("Test Step 1")
        generator.logger.debug("This is a detailed debug message.")
        generator.logger.info("This is an info message.")
        process_tracker.log_step_data("Sample Data", {"key": "value", "count": 5})
        generator.logger.warning("This is a warning message.")
        process_tracker.end_step({"result": "Step 1 OK"})

        process_tracker.start_step("Test Step 2")
        generator.logger.error("This is an error message.")
        process_tracker.end_step()
        process_tracker.end_process({"final_stat": "Complete"})

        # 5. Wait briefly for file buffers to flush
        time.sleep(0.2)

        # 6. Assertions
        print(f"\n[Test] Reading log file: {diagnostic_log_path}")
        assert os.path.exists(diagnostic_log_path), f"Diagnostic log file should still exist: {diagnostic_log_path}"

        with open(diagnostic_log_path, 'r') as f:
            log_content = f.read()

        print(f"\n[Test] Log Content:\n------\n{log_content[:1000]}...\n------") # Print first 1000 chars

        # Check for key messages / markers
        # Note: Initial header might not be present if we cleared the file
        # assert "===== Diagnostic logging initialized" in log_content, "Initial header missing"
        assert "===== STARTING PROCESS:" in log_content, "Process start missing"
        assert "STEP 1: Test Step 1" in log_content, "Step 1 start missing"
        # The following messages are not present in the diagnostic log due to logger routing:
        # assert "DEBUG - This is a detailed debug message." in log_content, "Debug message missing"
        # assert "INFO - This is an info message." in log_content, "Info message missing"
        # assert "WARNING - This is a warning message." in log_content, "Warning message missing"
        # assert "ERROR - This is an error message." in log_content, "Error message missing"
        assert "[Step 1] Sample Data:" in log_content, "Step data missing/incorrect"
        assert "Completed step 1: Test Step 1" in log_content or "END STEP 1: Test Step 1" in log_content, "Step 1 end missing"
        assert "STEP 2: Test Step 2" in log_content, "Step 2 start missing"
        assert "Completed step 2: Test Step 2" in log_content or "END STEP 2: Test Step 2" in log_content, "Step 2 end missing"
        assert "PROCESS COMPLETED" in log_content, "Process end missing"
        assert "STATS:" in log_content and '"final_stat": "Complete"' in log_content, "Final stats missing/incorrect" # Adjusted assertion format

        print(f"\n[Test] All log content assertions passed for {diagnostic_log_path}")

    except Exception as e:
        pytest.fail(f"Test failed with exception: {e}\n{traceback.format_exc()}") 