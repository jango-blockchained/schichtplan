from datetime import datetime
from sqlalchemy import Column, Integer, String, JSON, DateTime, Boolean
from . import db
from .employee import EmployeeGroup


class Coverage(db.Model):
    """Represents a coverage requirement definition.

    This model defines blocks of time on specific days of the week where
    a certain number of employees, potentially with specific types or roles
    (like keyholder), are required.

    IMPORTANT Backend Interpretation:
    While the frontend editor uses `start_time`, `end_time`, and `min_employees`
    to define a visual block, the backend scheduler and validator interpret
    this differently. A single Coverage record signifies that `min_employees`
    are required for *each granular time interval* (e.g., every 15 or 60 minutes)
    that falls within the `start_time` (inclusive) and `end_time` (exclusive)
    for the specified `day_index`.

    Overlap Handling:
    If multiple Coverage records created via the editor overlap for the same
    time interval, the backend utility (`get_required_staffing_for_interval`)
    resolves this by taking the maximum `min_employees` across all overlapping
    records for that interval. Other requirements like `employee_types` are
    combined (e.g., union), and `requires_keyholder` is set to True if *any*
    overlapping record requires it.

    Decoupling:
    These records define the overall staffing *need*. They are no longer directly
    linked one-to-one with specific shifts that fulfill them. The scheduler aims
    to assign shifts whose times cover the intervals where needs exist.

    Attributes:
        id (int): Primary key.
        day_index (int): Day of the week (0=Monday, 6=Sunday).
        start_time (str): Start time of the coverage block (HH:MM).
        end_time (str): End time of the coverage block (HH:MM).
        min_employees (int): Minimum employees required per interval within this block.
        max_employees (int): Maximum employees (informational, less used by interval logic).
        employee_types (JSON): List of specific employee type IDs/names required.
                                (Interpretation depends on scheduler logic, e.g., any of these types needed).
        allowed_employee_groups (JSON): List of employee groups allowed for this coverage.
        requires_keyholder (bool): If a keyholder is mandatory during intervals in this block.
        keyholder_before_minutes (int): Informational - how early keyholder needed before block start.
        keyholder_after_minutes (int): Informational - how late keyholder needed after block end.
        created_at (DateTime): Timestamp of creation.
        updated_at (DateTime): Timestamp of last update.
    """

    __tablename__ = "coverage"

    id = Column(Integer, primary_key=True)
    day_index = Column(Integer, nullable=False)  # 0-6 (Monday-Sunday)
    start_time = Column(String(5), nullable=False)  # Format: "HH:MM"
    end_time = Column(String(5), nullable=False)  # Format: "HH:MM"
    min_employees = Column(Integer, nullable=False, default=1)
    max_employees = Column(Integer, nullable=False, default=3)
    employee_types = Column(
        JSON, nullable=False, default=lambda: [group.value for group in EmployeeGroup]
    )  # List of employee type IDs (using EmployeeGroup values)
    allowed_employee_groups = Column(
        JSON, nullable=True, default=lambda: [group.value for group in EmployeeGroup]
    )  # List of EmployeeGroup values
    requires_keyholder = Column(
        Boolean, nullable=False, default=False
    )  # Whether this coverage block requires a keyholder
    keyholder_before_minutes = Column(
        Integer, nullable=True
    )  # Minutes keyholder needs to be there before
    keyholder_after_minutes = Column(
        Integer, nullable=True
    )  # Minutes keyholder needs to stay after
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __init__(
        self,
        day_index,
        start_time,
        end_time,
        min_employees=1,
        max_employees=3,
        employee_types=None,
        allowed_employee_groups=None,
        requires_keyholder=False,
        keyholder_before_minutes=None,
        keyholder_after_minutes=None,
    ):
        self.day_index = day_index
        self.start_time = start_time
        self.end_time = end_time
        self.min_employees = min_employees
        self.max_employees = max_employees
        self.employee_types = employee_types or [group.value for group in EmployeeGroup]
        self.allowed_employee_groups = allowed_employee_groups or [
            group.value for group in EmployeeGroup
        ]
        self.requires_keyholder = requires_keyholder
        self.keyholder_before_minutes = keyholder_before_minutes
        self.keyholder_after_minutes = keyholder_after_minutes

    def to_dict(self):
        """Convert coverage to dictionary"""
        return {
            "id": self.id,
            "day_index": self.day_index,
            "start_time": self.start_time,
            "end_time": self.end_time,
            "min_employees": self.min_employees,
            "max_employees": self.max_employees,
            "employee_types": self.employee_types,
            "allowed_employee_groups": self.allowed_employee_groups,
            "requires_keyholder": self.requires_keyholder,
            "keyholder_before_minutes": self.keyholder_before_minutes,
            "keyholder_after_minutes": self.keyholder_after_minutes,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

    def __repr__(self):
        return f"<Coverage {self.day_index} {self.start_time}-{self.end_time}>"
