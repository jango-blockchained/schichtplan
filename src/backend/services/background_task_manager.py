"""
Background Task Manager for Long-Running AI Operations

This service manages long-running AI tasks such as schedule optimization,
workload analysis, and batch operations. It provides:
- Task queue management
- Progress tracking
- Task cancellation
- Result persistence
- Status monitoring

Tasks are tracked in-memory with optional Redis persistence for
production environments.
"""

import asyncio
import time
import uuid
from collections.abc import Callable
from dataclasses import asdict, dataclass
from datetime import datetime
from enum import Enum
from typing import Any

from src.backend.utils.logger import logger


class TaskStatus(Enum):
    """Task execution status"""

    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class TaskType(Enum):
    """Types of background tasks"""

    SCHEDULE_OPTIMIZATION = "schedule_optimization"
    CONFLICT_RESOLUTION = "conflict_resolution"
    WORKLOAD_BALANCING = "workload_balancing"
    ASSIGNMENT_SUGGESTIONS = "assignment_suggestions"
    WORKLOAD_ANALYSIS = "workload_analysis"
    AVAILABILITY_SUGGESTIONS = "availability_suggestions"
    BULK_OPERATIONS = "bulk_operations"
    DATA_EXPORT = "data_export"
    PREDICTIVE_ANALYSIS = "predictive_analysis"


@dataclass
class TaskProgress:
    """Task progress information"""

    current: int  # Current step
    total: int  # Total steps
    percentage: float  # Completion percentage (0-100)
    message: str  # Progress message
    updated_at: str  # ISO timestamp


@dataclass
class BackgroundTask:
    """Background task representation"""

    id: str
    type: TaskType
    status: TaskStatus
    parameters: dict[str, Any]
    created_at: str
    started_at: str | None = None
    completed_at: str | None = None
    progress: TaskProgress | None = None
    result: Any | None = None
    error: str | None = None
    metadata: dict[str, Any] | None = None

    def to_dict(self) -> dict[str, Any]:
        """Convert task to dictionary representation"""
        data = asdict(self)
        # Convert enums to strings
        data["type"] = self.type.value if isinstance(self.type, TaskType) else self.type
        data["status"] = (
            self.status.value if isinstance(self.status, TaskStatus) else self.status
        )
        return data


class BackgroundTaskManager:
    """
    Manages long-running background tasks.

    Features:
    - Task creation and tracking
    - Progress monitoring
    - Task cancellation
    - Result persistence
    - Automatic cleanup
    """

    def __init__(self, max_tasks: int = 1000, cleanup_after_hours: int = 24):
        """
        Initialize the background task manager.

        Args:
            max_tasks: Maximum number of tasks to keep in memory
            cleanup_after_hours: Auto-cleanup completed tasks after N hours
        """
        self.tasks: dict[str, BackgroundTask] = {}
        self.max_tasks = max_tasks
        self.cleanup_after_hours = cleanup_after_hours
        self._running_tasks: dict[str, asyncio.Task] = {}
        self._task_handlers: dict[TaskType, Callable] = {}
        self._cancel_flags: dict[str, bool] = {}

        logger.info("BackgroundTaskManager initialized")

    def register_handler(
        self, task_type: TaskType, handler: Callable[[BackgroundTask], Any]
    ):
        """
        Register a handler function for a specific task type.

        Args:
            task_type: Type of task to handle
            handler: Async function that executes the task
        """
        self._task_handlers[task_type] = handler
        logger.info(f"Registered handler for task type: {task_type.value}")

    async def create_task(
        self,
        task_type: TaskType,
        parameters: dict[str, Any],
        metadata: dict[str, Any] | None = None,
    ) -> BackgroundTask:
        """
        Create and start a new background task.

        Args:
            task_type: Type of task to create
            parameters: Task parameters
            metadata: Additional metadata

        Returns:
            Created task object
        """
        # Generate unique task ID
        task_id = f"task_{uuid.uuid4().hex[:12]}"

        # Create task object
        task = BackgroundTask(
            id=task_id,
            type=task_type,
            status=TaskStatus.PENDING,
            parameters=parameters,
            created_at=datetime.now().isoformat(),
            metadata=metadata or {},
        )

        # Store task
        self.tasks[task_id] = task
        self._cancel_flags[task_id] = False

        logger.info(f"Created background task: {task_id} ({task_type.value})")

        # Start task execution
        asyncio.create_task(self._execute_task(task))

        return task

    async def _execute_task(self, task: BackgroundTask):
        """
        Execute a background task.

        Args:
            task: Task to execute
        """
        task_id = task.id

        try:
            # Update status to running
            task.status = TaskStatus.RUNNING
            task.started_at = datetime.now().isoformat()

            logger.info(f"Starting execution of task: {task_id}")

            # Get handler for task type
            handler = self._task_handlers.get(task.type)

            if not handler:
                raise ValueError(f"No handler registered for task type: {task.type}")

            # Execute handler
            result = await handler(task)

            # Check if task was cancelled
            if self._cancel_flags.get(task_id, False):
                task.status = TaskStatus.CANCELLED
                logger.info(f"Task cancelled: {task_id}")
            else:
                # Task completed successfully
                task.status = TaskStatus.COMPLETED
                task.result = result
                task.completed_at = datetime.now().isoformat()

                logger.info(f"Task completed successfully: {task_id}")

        except Exception as e:
            # Task failed
            task.status = TaskStatus.FAILED
            task.error = str(e)
            task.completed_at = datetime.now().isoformat()

            logger.error(f"Task failed: {task_id} - {str(e)}", exc_info=True)

        finally:
            # Cleanup
            if task_id in self._running_tasks:
                del self._running_tasks[task_id]

    def update_progress(
        self,
        task_id: str,
        current: int,
        total: int,
        message: str = "",
    ):
        """
        Update task progress.

        Args:
            task_id: Task identifier
            current: Current step
            total: Total steps
            message: Progress message
        """
        task = self.tasks.get(task_id)
        if not task:
            logger.warning(f"Cannot update progress for unknown task: {task_id}")
            return

        percentage = (current / total * 100) if total > 0 else 0

        task.progress = TaskProgress(
            current=current,
            total=total,
            percentage=round(percentage, 2),
            message=message,
            updated_at=datetime.now().isoformat(),
        )

        logger.debug(f"Task {task_id} progress: {current}/{total} ({percentage:.1f}%)")

    def get_task(self, task_id: str) -> BackgroundTask | None:
        """
        Get task by ID.

        Args:
            task_id: Task identifier

        Returns:
            Task object or None if not found
        """
        return self.tasks.get(task_id)

    def cancel_task(self, task_id: str) -> bool:
        """
        Cancel a running task.

        Args:
            task_id: Task identifier

        Returns:
            True if task was cancelled, False otherwise
        """
        task = self.tasks.get(task_id)
        if not task:
            logger.warning(f"Cannot cancel unknown task: {task_id}")
            return False

        if task.status not in [TaskStatus.PENDING, TaskStatus.RUNNING]:
            logger.info(f"Task {task_id} cannot be cancelled (status: {task.status})")
            return False

        # Set cancel flag
        self._cancel_flags[task_id] = True

        logger.info(f"Task cancellation requested: {task_id}")
        return True

    def list_tasks(
        self,
        status: TaskStatus | None = None,
        task_type: TaskType | None = None,
        limit: int = 100,
    ) -> list[BackgroundTask]:
        """
        List tasks with optional filtering.

        Args:
            status: Filter by status
            task_type: Filter by type
            limit: Maximum number of tasks to return

        Returns:
            List of tasks
        """
        tasks = list(self.tasks.values())

        # Apply filters
        if status:
            tasks = [t for t in tasks if t.status == status]

        if task_type:
            tasks = [t for t in tasks if t.type == task_type]

        # Sort by creation time (newest first)
        tasks.sort(key=lambda t: t.created_at, reverse=True)

        return tasks[:limit]

    def get_active_tasks(self) -> list[BackgroundTask]:
        """
        Get all active (pending or running) tasks.

        Returns:
            List of active tasks
        """
        return [
            task
            for task in self.tasks.values()
            if task.status in [TaskStatus.PENDING, TaskStatus.RUNNING]
        ]

    def cleanup_old_tasks(self, max_age_hours: int | None = None):
        """
        Remove old completed tasks from memory.

        Args:
            max_age_hours: Maximum age in hours (uses cleanup_after_hours if None)
        """
        max_age = max_age_hours or self.cleanup_after_hours
        cutoff_time = time.time() - (max_age * 3600)

        tasks_to_remove = []

        for task_id, task in self.tasks.items():
            if task.status in [
                TaskStatus.COMPLETED,
                TaskStatus.FAILED,
                TaskStatus.CANCELLED,
            ]:
                # Parse created_at timestamp
                try:
                    created_timestamp = datetime.fromisoformat(
                        task.created_at
                    ).timestamp()
                    if created_timestamp < cutoff_time:
                        tasks_to_remove.append(task_id)
                except Exception as e:
                    logger.warning(f"Error parsing task timestamp: {e}")

        # Remove old tasks
        for task_id in tasks_to_remove:
            del self.tasks[task_id]
            if task_id in self._cancel_flags:
                del self._cancel_flags[task_id]

        if tasks_to_remove:
            logger.info(f"Cleaned up {len(tasks_to_remove)} old tasks")

    def get_statistics(self) -> dict[str, Any]:
        """
        Get task manager statistics.

        Returns:
            Dictionary with statistics
        """
        tasks = list(self.tasks.values())

        stats = {
            "total_tasks": len(tasks),
            "pending": sum(1 for t in tasks if t.status == TaskStatus.PENDING),
            "running": sum(1 for t in tasks if t.status == TaskStatus.RUNNING),
            "completed": sum(1 for t in tasks if t.status == TaskStatus.COMPLETED),
            "failed": sum(1 for t in tasks if t.status == TaskStatus.FAILED),
            "cancelled": sum(1 for t in tasks if t.status == TaskStatus.CANCELLED),
            "by_type": {},
        }

        # Count by type
        for task in tasks:
            task_type = (
                task.type.value if isinstance(task.type, TaskType) else task.type
            )
            stats["by_type"][task_type] = stats["by_type"].get(task_type, 0) + 1

        return stats


# Global instance
background_task_manager = BackgroundTaskManager()


# Example task handlers (to be implemented by AI service integration)


async def handle_schedule_optimization(task: BackgroundTask) -> dict[str, Any]:
    """
    Handle schedule optimization task.

    Args:
        task: Task to execute

    Returns:
        Optimization result
    """
    logger.info(f"Executing schedule optimization task: {task.id}")

    # Update progress
    background_task_manager.update_progress(task.id, 0, 5, "Starting optimization...")

    # TODO: Integrate with actual optimization service
    # This is a placeholder implementation

    # Simulate progress
    for i in range(1, 6):
        await asyncio.sleep(1)  # Simulate work
        background_task_manager.update_progress(
            task.id, i, 5, f"Optimization step {i}/5"
        )

    return {
        "success": True,
        "optimized_shifts": 42,
        "conflicts_resolved": 5,
        "efficiency_gain": 15.5,
    }


async def handle_conflict_resolution(task: BackgroundTask) -> dict[str, Any]:
    """
    Handle conflict resolution task.

    Args:
        task: Task to execute

    Returns:
        Resolution result
    """
    logger.info(f"Executing conflict resolution task: {task.id}")

    background_task_manager.update_progress(task.id, 0, 3, "Analyzing conflicts...")

    # TODO: Integrate with actual conflict resolution service

    for i in range(1, 4):
        await asyncio.sleep(0.5)
        background_task_manager.update_progress(
            task.id, i, 3, f"Resolving conflicts: step {i}/3"
        )

    return {
        "success": True,
        "conflicts_found": 8,
        "conflicts_resolved": 7,
        "manual_review_needed": 1,
    }


# Register default handlers
background_task_manager.register_handler(
    TaskType.SCHEDULE_OPTIMIZATION, handle_schedule_optimization
)
background_task_manager.register_handler(
    TaskType.CONFLICT_RESOLUTION, handle_conflict_resolution
)
