from datetime import date

from pydantic import BaseModel, Field


class AbsenceCreateRequest(BaseModel):
    """Schema for the absence creation request."""

    start_date: date = Field(
        ..., description="Start date of the absence in YYYY-MM-DD format."
    )
    end_date: date = Field(
        ..., description="End date of the absence in YYYY-MM-DD format."
    )
    absence_type_id: str = Field(..., description="ID of the absence type.")
    note: str = Field("", description="Optional note for the absence.")
    status: str = Field(
        "requested",
        description=("Status of the absence (e.g., requested, approved, declined)."),
    )
    # employee_id is part of the URL, not the request body


class AbsenceUpdateRequest(BaseModel):
    """Schema for the absence update request."""

    # All fields are optional for update
    start_date: date | None = Field(
        None, description="Start date of the absence in YYYY-MM-DD format."
    )
    end_date: date | None = Field(
        None, description="End date of the absence in YYYY-MM-DD format."
    )
    absence_type_id: str | None = Field(None, description="ID of the absence type.")
    note: str | None = Field(None, description="Optional note for the absence.")
    status: str | None = Field(
        None,
        description=("Status of the absence (e.g., requested, approved, declined)."),
    )
