from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import date

class AvailabilityCreateRequest(BaseModel):
    """Schema for the availability creation request."""
    employee_id: int = Field(..., description="ID of the employee.")
    day_of_week: int = Field(..., description="Day of the week (0=Monday, 6=Sunday).")
    hour: int = Field(..., description="Hour of the day (0-23).")
    is_available: Optional[bool] = Field(True, description="Whether the employee is available at this time.")
    availability_type: Optional[str] = Field("AVL", description="Type of availability (e.g., FIX, PREF, AVL).")

class AvailabilityUpdateRequest(BaseModel):
    """Schema for the availability update request."""
    employee_id: Optional[int] = Field(None, description="ID of the employee.")
    day_of_week: Optional[int] = Field(None, description="Day of the week (0=Monday, 6=Sunday).")
    hour: Optional[int] = Field(None, description="Hour of the day (0-23).")
    is_available: Optional[bool] = Field(None, description="Whether the employee is available at this time.")
    availability_type: Optional[str] = Field(None, description="Type of availability (e.g., FIX, PREF, AVL).")

class AvailabilityCheckRequest(BaseModel):
    """Schema for checking employee availability."""
    employee_id: int = Field(..., description="ID of the employee.")
    date: date = Field(..., description="Date to check availability for (YYYY-MM-DD).")
    hour: Optional[int] = Field(None, description="Optional hour of the day (0-23) to check.")

class EmployeeAvailabilityUpdateRequest(BaseModel):
    """Schema for updating all availabilities for an employee."""
    day_of_week: int = Field(..., description="Day of the week (0=Monday, 6=Sunday).")
    hour: int = Field(..., description="Hour of the day (0-23).")
    is_available: bool = Field(..., description="Whether the employee is available at this time.")
    availability_type: Optional[str] = Field("AVL", description="Type of availability (e.g., FIX, PREF, AVL).")

class EmployeeAvailabilitiesUpdateRequest(BaseModel):
    """Schema for the list of availability updates for an employee."""
    __root__: List[EmployeeAvailabilityUpdateRequest] 