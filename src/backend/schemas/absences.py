from pydantic import BaseModel, Field
from datetime import date
from typing import Optional

class AbsenceCreateRequest(BaseModel):
    """Schema for the absence creation request."""
    start_date: date = Field(..., description="Start date of the absence in YYYY-MM-DD format.")
    end_date: date = Field(..., description="End date of the absence in YYYY-MM-DD format.")
    absence_type_id: int = Field(..., description="ID of the absence type.")
    note: str = Field("", description="Optional note for the absence.")
    # employee_id is part of the URL, not the request body

class AbsenceUpdateRequest(BaseModel):
    """Schema for the absence update request."""
    # All fields are optional for update
    start_date: Optional[date] = Field(None, description="Start date of the absence in YYYY-MM-DD format.")
    end_date: Optional[date] = Field(None, description="End date of the absence in YYYY-MM-DD format.")
    absence_type_id: Optional[int] = Field(None, description="ID of the absence type.")
    note: Optional[str] = Field(None, description="Optional note for the absence.") 