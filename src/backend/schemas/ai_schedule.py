from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from datetime import date


class AIScheduleGenerateRequest(BaseModel):
    """Schema for the AI schedule generation request."""

    start_date: date = Field(
        ..., description="Start date of the schedule in YYYY-MM-DD format."
    )
    end_date: date = Field(
        ..., description="End date of the schedule in YYYY-MM-DD format."
    )
    version_id: Optional[int] = Field(
        None,
        description="Optional version ID to associate with the generated schedule.",
    )
    ai_model_params: Optional[Dict[str, Any]] = Field(
        {}, description="Optional dictionary of parameters for the AI model."
    )

    class Config:
        schema_extra = {
            "examples": [
                {
                    "start_date": "2023-10-26",
                    "end_date": "2023-11-01",
                    "version_id": 5,
                    "ai_model_params": {"temperature": 0.7, "max_tokens": 1500},
                }
            ]
        }


class AIScheduleFeedbackRequest(BaseModel):
    """Schema for receiving feedback on AI schedule assignments."""

    version_id: int = Field(
        ..., description="The version ID of the schedule being reviewed."
    )
    manual_assignments: List[Dict[str, Any]] = Field(
        ..., description="List of manual assignments or modifications made by the user."
    )
    # Add other relevant feedback fields as needed, e.g., comments, ratings, etc.

    class Config:
        schema_extra = {
            "examples": [
                {
                    "version_id": 5,
                    "manual_assignments": [
                        {"employee_id": 1, "date": "2023-10-28", "shift_id": 3},
                        {"employee_id": 2, "date": "2023-10-29", "shift_id": 1},
                    ],
                }
            ]
        }
