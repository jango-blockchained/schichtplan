from pydantic import BaseModel, Field
from typing import Optional
from datetime import date

class ScheduleGenerateRequest(BaseModel):
    """Schema for the schedule generation request."""
    start_date: date = Field(..., description="Start date of the schedule in YYYY-MM-DD format.")
    end_date: date = Field(..., description="End date of the schedule in YYYY-MM-DD format.")
    create_empty_schedules: Optional[bool] = Field(True, description="Whether to create empty schedules for dates without assignments.")
    version: Optional[int] = Field(1, description="Version number for the generated schedule.")
    enable_diagnostics: Optional[bool] = Field(False, description="Whether to enable diagnostic logging during generation.")

class ScheduleUpdateRequest(BaseModel):
    """Schema for updating a schedule entry."""
    employee_id: Optional[int] = Field(None, description="ID of the employee assigned to the schedule.")
    shift_id: Optional[int] = Field(None, description="ID of the shift assigned to the schedule.")
    date: Optional[date] = None
    version: Optional[int] = Field(None, description="Version of the schedule.")
    notes: Optional[str] = Field(None, description="Notes for the schedule entry.")
    availability_type: Optional[str] = Field(None, description="Availability type for the schedule entry (e.g., FIX, PREF, AVL).")
    break_duration: Optional[int] = Field(None, description="Break duration in minutes.")
    # shift_type is derived from shift_id, not a direct input field
    # id is part of the URL, not the request body 