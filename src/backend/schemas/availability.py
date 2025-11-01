from datetime import date

from pydantic import BaseModel, Field

from src.backend.models.employee import AvailabilityType  # Import the enum


class AvailabilityCreateRequest(BaseModel):
    """Schema for the availability creation request."""

    employee_id: int
    day_of_week: int = Field(..., ge=0, le=6)  # 0 for Monday, 6 for Sunday
    hour: int = Field(..., ge=0, le=23)
    is_available: bool
    availability_type: AvailabilityType = Field(
        default=AvailabilityType.AVAILABLE
    )  # Use the imported enum


class AvailabilityUpdateRequest(BaseModel):
    """Schema for the availability update request."""

    employee_id: int | None = None
    day_of_week: int | None = Field(None, ge=0, le=6)  # 0 for Monday, 6 for Sunday
    hour: int | None = Field(None, ge=0, le=23)
    is_available: bool | None = None
    availability_type: AvailabilityType | None = None


class AvailabilityCheckRequest(BaseModel):
    """Schema for checking employee availability."""

    employee_id: int
    date: date  # Pydantic handles date parsing
    hour: int | None = Field(None, ge=0, le=23)
    # We could add validation here to ensure 'date' is in a reasonable range,
    # but for now assume valid date object


class EmployeeAvailabilityBase(BaseModel):
    """Base schema for employee availability."""

    day_of_week: int = Field(..., ge=0, le=6)  # 0 for Monday, 6 for Sunday
    hour: int = Field(..., ge=0, le=23)
    is_available: bool
    availability_type: AvailabilityType = Field(default=AvailabilityType.AVAILABLE)


class EmployeeAvailabilitiesUpdateRequest(BaseModel):
    availabilities: list[EmployeeAvailabilityBase]


class EmployeeStatusByDateRequest(BaseModel):
    """Schema for the employee status by date request."""

    date: date


# Schema for GET /api/availability/shifts_for_employee
class EmployeeShiftsForEmployeeRequest(BaseModel):
    date: date
    employee_id: int
