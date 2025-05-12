from pydantic import BaseModel, Field, validator
from typing import Dict, List, Optional, Any, Union
from datetime import datetime

class TablesList(BaseModel):
    """Schema for the wipe tables request."""
    tables: List[str] = Field(..., description="List of table names to wipe.")

class SettingValue(BaseModel):
    """Schema for updating a single setting value."""
    value: Any = Field(..., description="The new value for the setting.")

class CategorySettings(BaseModel):
    """Schema for updating settings for a specific category."""
    __root__: Dict[str, Any] = Field(..., description="Settings for a specific category.")

class GenerationRequirements(BaseModel):
    """Schema for schedule generation requirements."""
    enforce_minimum_coverage: Optional[bool] = Field(True, description="Enforce minimum coverage requirements.")
    enforce_contracted_hours: Optional[bool] = Field(True, description="Enforce contracted hours for employees.")
    enforce_keyholder_coverage: Optional[bool] = Field(True, description="Ensure keyholder coverage for shifts requiring keyholders.")
    enforce_rest_periods: Optional[bool] = Field(True, description="Enforce minimum rest periods between shifts.")
    enforce_early_late_rules: Optional[bool] = Field(True, description="Enforce rules for early/late shifts.")
    enforce_employee_group_rules: Optional[bool] = Field(True, description="Enforce rules specific to employee groups.")
    enforce_break_rules: Optional[bool] = Field(True, description="Enforce break rules based on shift duration.")
    enforce_max_hours: Optional[bool] = Field(True, description="Enforce maximum working hours per day/week.")
    enforce_consecutive_days: Optional[bool] = Field(True, description="Enforce maximum consecutive working days.")
    enforce_weekend_distribution: Optional[bool] = Field(True, description="Enforce fair distribution of weekend shifts.")
    enforce_shift_distribution: Optional[bool] = Field(True, description="Enforce fair distribution of different shift types.")
    enforce_availability: Optional[bool] = Field(True, description="Respect employee availability preferences.")
    enforce_qualifications: Optional[bool] = Field(True, description="Respect employee qualifications for specific tasks.")
    enforce_opening_hours: Optional[bool] = Field(True, description="Respect store opening hours for scheduling.")

class StoreHoursSettings(BaseModel):
    """Schema for store hours settings."""
    monday_open: Optional[str] = Field(None, description="Monday opening time (HH:MM format).")
    monday_close: Optional[str] = Field(None, description="Monday closing time (HH:MM format).")
    tuesday_open: Optional[str] = Field(None, description="Tuesday opening time (HH:MM format).")
    tuesday_close: Optional[str] = Field(None, description="Tuesday closing time (HH:MM format).")
    wednesday_open: Optional[str] = Field(None, description="Wednesday opening time (HH:MM format).")
    wednesday_close: Optional[str] = Field(None, description="Wednesday closing time (HH:MM format).")
    thursday_open: Optional[str] = Field(None, description="Thursday opening time (HH:MM format).")
    thursday_close: Optional[str] = Field(None, description="Thursday closing time (HH:MM format).")
    friday_open: Optional[str] = Field(None, description="Friday opening time (HH:MM format).")
    friday_close: Optional[str] = Field(None, description="Friday closing time (HH:MM format).")
    saturday_open: Optional[str] = Field(None, description="Saturday opening time (HH:MM format).")
    saturday_close: Optional[str] = Field(None, description="Saturday closing time (HH:MM format).")
    sunday_open: Optional[str] = Field(None, description="Sunday opening time (HH:MM format).")
    sunday_close: Optional[str] = Field(None, description="Sunday closing time (HH:MM format).")
    
    @validator('*')
    def validate_time_format(cls, v):
        """Validate time is in HH:MM format."""
        if v is not None:
            try:
                hours, minutes = v.split(':')
                if not (0 <= int(hours) <= 23 and 0 <= int(minutes) <= 59):
                    raise ValueError("Hours must be 0-23, minutes must be 0-59")
            except Exception:
                raise ValueError(f"Time must be in HH:MM format, got {v}")
        return v

class GeneralSettings(BaseModel):
    """Schema for general settings."""
    store_name: Optional[str] = Field(None, description="Name of the store.")
    store_address: Optional[str] = Field(None, description="Address of the store.")
    store_phone: Optional[str] = Field(None, description="Phone number of the store.")
    store_email: Optional[str] = Field(None, description="Email address of the store.")
    break_duration_minutes: Optional[int] = Field(None, description="Default break duration in minutes.")
    
    @validator('break_duration_minutes')
    def validate_break_duration(cls, v):
        """Validate break duration is reasonable."""
        if v is not None and not (0 <= v <= 120):
            raise ValueError("Break duration must be between 0 and 120 minutes")
        return v

class AdvancedSettings(BaseModel):
    """Schema for advanced settings."""
    generation_requirements: Optional[GenerationRequirements] = None
    scheduling_algorithm: Optional[str] = Field(None, description="Algorithm to use for scheduling.")
    max_generation_attempts: Optional[int] = Field(None, description="Maximum number of generation attempts.")
    
    @validator('max_generation_attempts')
    def validate_max_attempts(cls, v):
        """Validate max generation attempts is reasonable."""
        if v is not None and not (1 <= v <= 100):
            raise ValueError("Max generation attempts must be between 1 and 100")
        return v

class CompleteSettings(BaseModel):
    """Schema for the complete settings object."""
    general: Optional[GeneralSettings] = None
    store_hours: Optional[StoreHoursSettings] = None
    scheduling_advanced: Optional[AdvancedSettings] = None
    custom_settings: Optional[Dict[str, Any]] = Field(None, description="Custom settings not covered by other categories.")