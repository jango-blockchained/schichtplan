"""Process tracking utilities for the scheduler."""

import logging
import uuid
import json
import traceback
import sys
from datetime import datetime
from typing import Optional, Dict, Any, TYPE_CHECKING

if TYPE_CHECKING:
    from logging import Logger as LoggerType # Avoid circular import issues

class ProcessTracker:
    """
    Tracks the progress and timing of a multi-step process, like schedule generation.
    Logs information using provided logger instances.
    """

    def __init__(self, process_name: str, schedule_logger: 'LoggerType', diagnostic_logger: 'LoggerType'):
        """
        Initialize the tracker.

        Args:
            process_name: A name for the overall process (e.g., "Schedule Generation").
            schedule_logger: Logger instance for general schedule process logging (e.g., logger).
            diagnostic_logger: Logger instance for detailed diagnostic logging (e.g., logger.create_diagnostic_logger).
        """
        self.process_name = process_name
        self.schedule_logger = schedule_logger
        self.diagnostic_logger = diagnostic_logger
        self.session_id = str(uuid.uuid4())[:8]  # Unique ID for this process run
        self.current_step = None
        self.step_count = 0
        self.steps_completed = []
        self.step_start_time = None
        self.process_start_time = None

        # Log initialization immediately using the provided diagnostic logger
        self.diagnostic_logger.info(f"ProcessTracker initialized for '{process_name}' (Session: {self.session_id})")


    def start_process(self) -> None:
        """Start timing the overall process."""
        self.process_start_time = datetime.now()
        self.step_count = 0
        self.steps_completed = []
        start_msg = f"===== STARTING PROCESS: {self.process_name} (Session: {self.session_id}) ====="
        self.schedule_logger.info(start_msg)
        self.diagnostic_logger.info(start_msg)

    def start_step(self, step_name: str) -> None:
        """Log the start of a processing step."""
        self.step_count += 1
        self.current_step = step_name
        self.step_start_time = datetime.now()
        step_msg = f"Step {self.step_count}: {step_name} - Started"
        # Log step start to both loggers for different levels of detail/formats
        self.schedule_logger.info(step_msg)
        self.diagnostic_logger.info(f"--> START STEP {self.step_count}: {step_name}")


    def end_step(self, results: Optional[Dict[str, Any]] = None) -> None:
        """Log the completion of a processing step with optional results."""
        if self.current_step and self.step_start_time:
            duration = datetime.now() - self.step_start_time
            self.steps_completed.append(self.current_step)
            duration_ms = duration.total_seconds() * 1000

            completion_msg = f"Step {self.step_count}: {self.current_step} - Completed in {duration_ms:.1f}ms"
            diag_completion_msg = f"<-- END STEP {self.step_count}: {self.current_step} ({duration_ms:.1f}ms)"

            self.schedule_logger.info(completion_msg)
            self.diagnostic_logger.info(diag_completion_msg)

            # Log results if provided (primarily to diagnostic for detail)
            if results:
                try:
                    # Use indentation for readability in diagnostic log
                    result_str = json.dumps(results, default=str, indent=2)
                    self.diagnostic_logger.debug(f"    Step {self.step_count} Results:\n{result_str}")
                    # Log concise summary to schedule log if needed
                    # self.schedule_logger.debug(f"Step {self.step_count} results keys: {list(results.keys())}")
                except Exception as e:
                    self.diagnostic_logger.error(f"Failed to serialize step results: {e}")
                    self.diagnostic_logger.debug(f"Raw results: {results}")


            self.current_step = None
            self.step_start_time = None
        else:
             self.diagnostic_logger.warning("end_step called without an active step or start time.")


    def end_process(self, stats: Optional[Dict[str, Any]] = None) -> None:
        """Log the completion of the entire process."""
        if self.process_start_time:
            duration = datetime.now() - self.process_start_time
            duration_sec = duration.total_seconds()

            summary = {
                "session_id": self.session_id,
                "total_steps": self.step_count,
                "steps_completed": len(self.steps_completed),
                "duration_seconds": duration_sec,
            }
            if stats:
                summary.update(stats)

            completion_msg = "===== PROCESS COMPLETED ====="
            summary_msg = f"Process summary: {json.dumps(summary, default=str)}"
            diag_summary_msg = (f"PROCESS COMPLETED - Runtime: {duration_sec:.2f}s "
                                f"- Steps: {len(self.steps_completed)}/{self.step_count}")

            self.schedule_logger.info(completion_msg)
            self.schedule_logger.info(f"Total runtime: {duration_sec:.2f} seconds")
            self.schedule_logger.info(f"Steps completed: {len(self.steps_completed)}/{self.step_count}")
            self.schedule_logger.info(summary_msg)

            self.diagnostic_logger.info(completion_msg)
            self.diagnostic_logger.info(diag_summary_msg)

            if stats:
                try:
                    stats_str = json.dumps(stats, default=str, indent=2)
                    self.diagnostic_logger.info(f"STATS:\n{stats_str}")
                except Exception as e:
                    self.diagnostic_logger.error(f"Failed to serialize final stats: {e}")
                    self.diagnostic_logger.info(f"Raw stats: {stats}")

        else:
            self.diagnostic_logger.warning("end_process called without a process start time.")

    def log_step_data(self, data_name: str, data: Any, level: int = logging.DEBUG) -> None:
        """Log detailed data associated with the current step, primarily to the diagnostic log."""
        if self.current_step:
            try:
                # Format complex data nicely for diagnostic log
                if isinstance(data, dict) or isinstance(data, list):
                    # Limit depth/size for very large structures if necessary
                    data_str = json.dumps(data, default=str, indent=2)
                else:
                    data_str = str(data)

                # Truncate if excessively long to avoid flooding logs
                max_len = 2000
                if len(data_str) > max_len:
                    data_str = data_str[:max_len] + "... [truncated]"

                log_prefix = f"[Step {self.step_count}] {data_name}:"
                # Log detailed data mainly to diagnostic
                self.diagnostic_logger.log(level, f"{log_prefix}\n{data_str}")
                # Optionally log a summary or confirmation to the schedule log
                # self.schedule_logger.debug(f"{log_prefix} logged to diagnostics.")

            except Exception as e:
                self.diagnostic_logger.error(f"Error logging step data '{data_name}': {e}")
                self.diagnostic_logger.debug(f"Raw data: {data}")
        else:
            self.diagnostic_logger.warning(f"log_step_data called without an active step for '{data_name}'.")


    def log_error(self, message: str, exc_info=True) -> None:
        """Log an error message to both schedule and diagnostic logs."""
        self.schedule_logger.error(message, exc_info=exc_info)
        # Log detailed error with traceback to diagnostic log
        if exc_info:
            exc_type, exc_value, exc_traceback = sys.exc_info()
            if exc_type and exc_value:
                tb_lines = traceback.format_exception(
                    exc_type, exc_value, exc_traceback
                )
                self.diagnostic_logger.error(f"ERROR: {message}\n{''.join(tb_lines)}")
            else:
                 self.diagnostic_logger.error(f"ERROR: {message} (Exception info requested but not available)")
        else:
            self.diagnostic_logger.error(f"ERROR: {message}")

    # Convenience methods to log to both loggers if desired, or just one
    def log_info(self, message: str, log_to_diag: bool = True):
         self.schedule_logger.info(message)
         if log_to_diag:
             self.diagnostic_logger.info(message)

    def log_debug(self, message: str, log_to_schedule: bool = False):
         # Debug usually goes only to diagnostic unless specified
         self.diagnostic_logger.debug(message)
         if log_to_schedule:
             self.schedule_logger.debug(message)

    def log_warning(self, message: str, log_to_diag: bool = True):
        self.schedule_logger.warning(message)
        if log_to_diag:
            self.diagnostic_logger.warning(message)


    def get_session_id(self) -> str:
        """Get the unique session ID for this process run."""
        return self.session_id
