from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, Dict, Any
from datetime import date

class AIScheduleGenerateRequest(BaseModel):
    """Schema for the AI schedule generation request."""
    start_date: date = Field(..., description="Start date of the schedule in YYYY-MM-DD format.")
    end_date: date = Field(..., description="End date of the schedule in YYYY-MM-DD format.")
    version_id: Optional[int] = Field(None, description="Optional version ID to associate with the generated schedule.")
    ai_model_params: Optional[Dict[str, Any]] = Field({}, description="Optional dictionary of parameters for the AI model.")

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "start_date": "2023-10-26",
                    "end_date": "2023-11-01",
                    "version_id": 5,
                    "ai_model_params": {"temperature": 0.7, "max_tokens": 1500}
                }
            ]
        }
    ) 