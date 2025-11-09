from datetime import date as datetime_date
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class GenerationOptions(BaseModel):
    """Optional generation flags forwarded from the frontend."""

    model_config = ConfigDict(populate_by_name=True)

    keep_existing_assignments: bool | None = Field(
        None,
        alias="keepExistingAssignments",
        description=(
            "If false, existing assignments in the date range are cleared "
            "before generation."
        ),
    )
    use_phase1_fixed_assignments: bool | None = Field(
        None,
        alias="usePhase1FixedAssignments",
        description="Whether phase 1 (fixed availability) is enabled.",
    )
    use_phase2_preferred_availability: bool | None = Field(
        None,
        alias="usePhase2PreferredAvailability",
        description="Whether phase 2 (preferred availability) is enabled.",
    )
    use_phase3_standard_generation: bool | None = Field(
        None,
        alias="usePhase3StandardGeneration",
        description="Whether phase 3 (standard generation) is enabled.",
    )
    phase_mode: (
        Literal[
            "fixed_assignments",
            "preferred_availability",
            "standard_generation",
            "finalize",
        ]
        | None
    ) = Field(
        None,
        alias="phaseMode",
        description="Active multi-phase mode for this generation request.",
    )


class ScheduleGenerateRequest(BaseModel):
    """Schema for the schedule generation request."""

    start_date: datetime_date = Field(
        ..., description="Start date of the schedule in YYYY-MM-DD format."
    )
    end_date: datetime_date = Field(
        ..., description="End date of the schedule in YYYY-MM-DD format."
    )
    create_empty_schedules: bool | None = Field(
        True,
        description=(
            "Whether to create empty schedules for dates without assignments."
        ),
    )
    version: int | None = Field(
        1, description="Version number for the generated schedule."
    )
    enable_diagnostics: bool | None = Field(
        False,
        description="Whether to enable diagnostic logging during generation.",
    )
    generation_options: GenerationOptions | None = Field(
        None,
        alias="generation_options",
        description=(
            "Optional feature flags that control phased generation behaviour."
        ),
    )
    coverage_profile_id: int | None = Field(
        None,
        alias="coverage_profile_id",
        description=(
            "Optional ID of a saved coverage profile to use for this generation."
        ),
    )


class ScheduleUpdateRequest(BaseModel):
    """Schema for updating a schedule entry."""

    employee_id: int | None = Field(
        None, description="ID of the employee assigned to the schedule."
    )
    shift_id: int | None = Field(
        None, description="ID of the shift assigned to the schedule."
    )
    date: datetime_date | None = Field(
        None,
        description="Date for the entry. Can be updated for rescheduling.",
    )
    version: int | None = Field(None, description="Version of the schedule.")
    notes: str | None = Field(None, description="Notes for the schedule entry.")
    availability_type: str | None = Field(
        None,
        description=(
            "Availability type for the schedule entry (e.g., FIXED, PREF, AVAILABLE)."
        ),
    )
    break_duration: int | None = Field(None, description="Break duration in minutes.")
    is_keyholder_shift: bool | None = Field(
        None, description="Whether this shift is assigned the keyholder role."
    )
    shift_start: str | None = Field(
        None,
        description="Shift start time in HH:MM format (explicit scheduling).",
    )
    shift_end: str | None = Field(
        None,
        description="Shift end time in HH:MM format (explicit scheduling).",
    )
    # shift_type is derived from shift_id, not a direct input field
    # id is part of the URL, not the request body
