from pydantic import BaseModel, Field, validator, RootModel
from typing import Dict, List, Optional, Any, Literal
from datetime import datetime

# --- Existing/Verified Models (with minor adjustments if needed) ---

class SpecialDayCustomHours(BaseModel):
    """Schema for custom hours on a special day."""
    opening: str = Field(..., description="Opening time in HH:MM format.")
    closing: str = Field(..., description="Closing time in HH:MM format.")

    @validator('opening', 'closing')
    def validate_time_format(cls, v):
        """Validate time is in HH:MM format."""
        try:
            datetime.strptime(v, '%H:%M')
        except ValueError:
            raise ValueError(f"Time must be in HH:MM format, got {v}")
        return v

class SpecialDay(BaseModel):
    """Schema for a special day configuration."""
    description: str = Field(..., description="Description of the special day.")
    is_closed: bool = Field(..., description="Whether the store is closed on this day.")
    custom_hours: Optional[SpecialDayCustomHours] = Field(None, description="Custom opening hours if not closed.")
    # Removed 'date' field from here, as it's expected to be the key in a Dict in GeneralSettings

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
    # Add any other fields if present in frontend type Settings.scheduling.generation_requirements or model

# --- NEW Pydantic Models (as per task plan) ---

class GeneralSettings(BaseModel): # Modified as per plan
    """Schema for general settings."""
    store_name: Optional[str] = Field(None, description="Name of the store.")
    store_address: Optional[str] = Field(None, description="Address of the store.")
    store_phone: Optional[str] = Field(None, description="Phone number of the store.") # Added from plan
    store_email: Optional[str] = Field(None, description="Email address of the store.") # Added from plan
    timezone: Optional[str] = Field(None, description="Timezone for the store operations.")
    language: Optional[str] = Field(None, description="Default language for the application.")
    date_format: Optional[str] = Field(None, description="Preferred date format.")
    time_format: Optional[str] = Field(None, description="Preferred time format (e.g., 12h or 24h).")
    store_opening: Optional[str] = Field(None, description="Default store opening time (HH:MM).") # For general reference
    store_closing: Optional[str] = Field(None, description="Default store closing time (HH:MM).") # For general reference
    keyholder_before_minutes: Optional[int] = Field(None, description="Minutes keyholder must be present before opening.")
    keyholder_after_minutes: Optional[int] = Field(None, description="Minutes keyholder must be present after closing.")
    opening_days: Optional[Dict[Literal['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'], bool]] = Field(None, description="Which days the store is open.")
    special_days: Optional[Dict[str, SpecialDay]] = Field(None, description="Special days and holidays configuration (key: YYYY-MM-DD).")
    # Removed break_duration_minutes from here, will be in SchedulingSettingsSchema

    @validator('store_opening', 'store_closing')
    def validate_time_format_optional(cls, v):
        if v is not None:
            try:
                datetime.strptime(v, '%H:%M')
            except ValueError:
                raise ValueError(f"Time must be in HH:MM format, got {v}")
        return v

    @validator('special_days')
    def validate_special_days_date_keys(cls, v):
        if v is not None:
            for date_str in v.keys():
                try:
                    datetime.strptime(date_str, "%Y-%m-%d")
                except ValueError:
                    raise ValueError(f"Special day date key must be in YYYY-MM-DD format, got {date_str}")
        return v

class SchedulingSettingsSchema(BaseModel):
    """Schema for scheduling-specific settings."""
    scheduling_resource_type: Optional[Literal["shifts", "coverage"]] = Field(None, description="Primary resource type for scheduling.")
    default_shift_duration: Optional[float] = Field(None, description="Default duration for shifts in hours.")
    min_break_duration: Optional[int] = Field(None, description="Minimum break duration in minutes.")
    max_daily_hours: Optional[float] = Field(None, description="Maximum daily working hours for an employee.")
    max_weekly_hours: Optional[float] = Field(None, description="Maximum weekly working hours for an employee.")
    min_rest_between_shifts: Optional[float] = Field(None, description="Minimum rest period between shifts in hours.")
    scheduling_period_weeks: Optional[int] = Field(None, description="Number of weeks for a standard scheduling period.")
    auto_schedule_preferences: Optional[bool] = Field(None, description="Whether to automatically consider employee preferences.")
    enable_diagnostics: Optional[bool] = Field(None, description="Enable diagnostic logging for the scheduler.")
    generation_requirements: Optional[GenerationRequirements] = Field(None, description="Detailed constraints for schedule generation.")
    scheduling_algorithm: Optional[Literal["standard", "optimized"]] = Field(None, description="Algorithm to use for scheduling.")
    max_generation_attempts: Optional[int] = Field(None, description="Maximum number of attempts for schedule generation.")

class DisplaySettingsDarkThemeSchema(BaseModel):
    """Schema for dark theme specific display settings."""
    primary_color: Optional[str] = Field(None, description="Primary color for dark theme.")
    secondary_color: Optional[str] = Field(None, description="Secondary color for dark theme.")
    accent_color: Optional[str] = Field(None, description="Accent color for dark theme.")
    background_color: Optional[str] = Field(None, description="Background color for dark theme.")
    surface_color: Optional[str] = Field(None, description="Surface color for dark theme.")
    text_color: Optional[str] = Field(None, description="Text color for dark theme.")

class DisplaySettingsSchema(BaseModel):
    """Schema for general display and notification settings."""
    theme: Optional[Literal['light', 'dark', 'system']] = Field(None, description="Application theme.")
    primary_color: Optional[str] = Field(None, description="Primary color for light theme.")
    secondary_color: Optional[str] = Field(None, description="Secondary color for light theme.")
    accent_color: Optional[str] = Field(None, description="Accent color for light theme.")
    background_color: Optional[str] = Field(None, description="Background color for light theme.")
    surface_color: Optional[str] = Field(None, description="Surface color for light theme.")
    text_color: Optional[str] = Field(None, description="Text color for light theme.")
    dark_theme: Optional[DisplaySettingsDarkThemeSchema] = Field(None, description="Specific settings for dark theme.")
    show_sunday: Optional[bool] = Field(None, description="Show Sunday in calendar views.")
    show_weekdays: Optional[bool] = Field(None, description="Show weekdays in calendar views.") # This seems redundant if show_sunday implies others
    start_of_week: Optional[Literal[0, 1, 2, 3, 4, 5, 6]] = Field(None, description="Start day of the week (0=Sunday, 1=Monday, ...).") # Adjusted to Literal
    calendar_start_day: Optional[Literal['sunday', 'monday']] = Field(None, description="User's preferred start day for calendar views.")
    calendar_default_view: Optional[Literal['month', 'week', 'day']] = Field(None, description="Default view for the calendar.")
    email_notifications: Optional[bool] = Field(None, description="Master switch for email notifications.")
    schedule_published_notify: Optional[bool] = Field(None, description="Notify on schedule publish.") # Aligned name
    shift_changes_notify: Optional[bool] = Field(None, description="Notify on shift changes.") # Aligned name
    time_off_requests_notify: Optional[bool] = Field(None, description="Notify on time-off requests.") # Aligned name

class PDFMarginsSchema(BaseModel):
    """Schema for PDF margins."""
    top: Optional[float] = Field(None, description="Top margin in units (e.g., mm or inches).")
    right: Optional[float] = Field(None, description="Right margin.")
    bottom: Optional[float] = Field(None, description="Bottom margin.")
    left: Optional[float] = Field(None, description="Left margin.")

class PDFTableStyleSchema(BaseModel):
    """Schema for PDF table styling."""
    header_bg_color: Optional[str] = Field(None, description="Header background color (hex).")
    border_color: Optional[str] = Field(None, description="Table border color (hex).")
    text_color: Optional[str] = Field(None, description="Table text color (hex).")
    header_text_color: Optional[str] = Field(None, description="Header text color (hex).")

class PDFFontsSchema(BaseModel):
    """Schema for PDF font settings."""
    family: Optional[str] = Field(None, description="Font family name.")
    size: Optional[float] = Field(None, description="Base font size.")
    header_size: Optional[float] = Field(None, description="Header font size.")

class PDFContentSchema(BaseModel):
    """Schema for content visibility in PDFs."""
    show_employee_id: Optional[bool] = Field(None, description="Show employee ID in PDF.")
    show_position: Optional[bool] = Field(None, description="Show employee position in PDF.")
    show_breaks: Optional[bool] = Field(None, description="Show break times in PDF.")
    show_total_hours: Optional[bool] = Field(None, description="Show total hours for employees in PDF.")

class PDFLayoutSettingsSchema(BaseModel):
    """Schema for overall PDF layout settings."""
    page_size: Optional[str] = Field(None, description="Page size (e.g., A4, Letter).")
    orientation: Optional[Literal['portrait', 'landscape']] = Field(None, description="Page orientation.")
    margins: Optional[PDFMarginsSchema] = Field(None, description="Page margins.")
    table_style: Optional[PDFTableStyleSchema] = Field(None, description="Styling for tables in PDF.")
    fonts: Optional[PDFFontsSchema] = Field(None, description="Font settings for PDF.")
    content: Optional[PDFContentSchema] = Field(None, description="Content visibility settings for PDF.")

class EmployeeTypeSchema(BaseModel):
    """Schema for defining an employee type/group."""
    id: str = Field(..., description="Unique identifier for the employee type.")
    name: str = Field(..., description="Display name of the employee type.")
    abbr: Optional[str] = Field(None, description="Abbreviation for the employee type.")
    min_hours: Optional[float] = Field(None, description="Minimum contractual hours for this type.") # Made optional based on common use cases
    max_hours: Optional[float] = Field(None, description="Maximum contractual hours for this type.") # Made optional
    type: Literal["employee_type", "employee"] = Field("employee_type", description="Internal type discriminator.")


class ShiftTypeSchemaPydantic(BaseModel): # Renamed to avoid conflicts
    """Schema for defining a shift type."""
    id: str = Field(..., description="Unique identifier for the shift type.")
    name: str = Field(..., description="Display name of the shift type.")
    color: str = Field(..., description="Color code (hex) for this shift type.")
    type: Literal["shift_type"] = Field("shift_type", description="Internal type discriminator.")
    auto_assign_only: Optional[bool] = Field(None, description="Whether this shift type is for auto-assignment only.")


class AbsenceTypeSchema(BaseModel):
    """Schema for defining an absence type."""
    id: str = Field(..., description="Unique identifier for the absence type.")
    name: str = Field(..., description="Display name of the absence type.")
    color: str = Field(..., description="Color code (hex) for this absence type.")
    type: Literal["absence_type", "absence"] = Field("absence_type", description="Internal type discriminator.")


class EmployeeGroupsSettingsSchema(BaseModel):
    """Schema for managing employee types, shift types, and absence types."""
    employee_types: Optional[List[EmployeeTypeSchema]] = Field(None, description="List of defined employee types.")
    shift_types: Optional[List[ShiftTypeSchemaPydantic]] = Field(None, description="List of defined shift types.")
    absence_types: Optional[List[AbsenceTypeSchema]] = Field(None, description="List of defined absence types.")

class AvailabilityTypeDetailSchema(BaseModel):
    """Schema for a single availability type definition."""
    id: str = Field(..., description="Unique identifier for the availability type.")
    name: str = Field(..., description="Display name of the availability type.")
    description: Optional[str] = Field(None, description="Description of the availability type.") # Made Optional
    color: str = Field(..., description="Color code (hex) for this availability type.")
    priority: int = Field(..., description="Priority level for scheduling (higher means more preferred/important).")
    is_available: bool = Field(..., description="Does this type signify availability or unavailability?")

class AvailabilityTypesSettingsSchema(BaseModel):
    """Schema for managing different types of employee availability."""
    types: Optional[List[AvailabilityTypeDetailSchema]] = Field(None, description="List of defined availability types.")

class DemoDataSettingsSchema(BaseModel):
    """Schema for demo data generation settings."""
    selected_module: Optional[str] = Field(None, description="Module for which to generate demo data.")
    last_execution: Optional[datetime] = Field(None, description="Timestamp of the last demo data generation.") # Changed to datetime

class ActionsSettingsSchema(BaseModel):
    """Schema for settings related to executable actions like demo data generation."""
    demo_data: Optional[DemoDataSettingsSchema] = Field(None, description="Settings for demo data generation.")

class AISchedulingSettingsSchema(BaseModel):
    """Schema for AI-assisted scheduling features."""
    enabled: Optional[bool] = Field(None, description="Enable/disable AI scheduling features.")
    api_key: Optional[str] = Field(None, description="API key for AI scheduling service.")

# --- Main Settings Schema ---

class CompleteSettings(BaseModel):
    """Schema for the complete settings object. All fields are optional for partial updates."""
    general: Optional[GeneralSettings] = Field(None, description="General store and application settings.")
    scheduling: Optional[SchedulingSettingsSchema] = Field(None, description="Settings related to the scheduling engine and rules.")
    # 'scheduling_advanced' from existing AdvancedSettings is deprecated if its content (like generation_requirements)
    # is now fully part of 'scheduling'. If other distinct advanced fields exist, it could be kept.
    # For now, assuming 'generation_requirements' is moved to 'scheduling'.
    # scheduling_advanced: Optional[AdvancedSettings] = Field(None, description="Advanced scheduling parameters.") # Task plan says review/remove
    display: Optional[DisplaySettingsSchema] = Field(None, description="Display, theme, and notification settings.")
    pdf_layout: Optional[PDFLayoutSettingsSchema] = Field(None, description="Settings for PDF generation layout and content.")
    employee_groups: Optional[EmployeeGroupsSettingsSchema] = Field(None, description="Management of employee types, shift types, and absence types.")
    availability_types: Optional[AvailabilityTypesSettingsSchema] = Field(None, description="Configuration for employee availability types.")
    actions: Optional[ActionsSettingsSchema] = Field(None, description="Settings related to system actions like demo data.")
    ai_scheduling: Optional[AISchedulingSettingsSchema] = Field(None, description="Settings for AI-powered scheduling features.")

    class Config:
        validate_assignment = True # Useful for models where attributes might be updated post-initialization

# --- Utility Schemas (from original file, if still needed) ---

class TablesList(BaseModel):
    """Schema for the wipe tables request."""
    tables: List[str] = Field(..., description="List of table names to wipe.")

class SettingValue(BaseModel): # This might be used for a generic single setting update endpoint
    """Schema for updating a single setting value, if a generic endpoint exists."""
    value: Any = Field(..., description="The new value for the setting.")

# CategorySettings: RootModel if available, else BaseModel fallback
class CategorySettings(RootModel[Dict[str, Any]]):
    """Settings for a specific category, represented as a dictionary."""
    class Config:
        schema_extra = {
            "description": "Settings for a specific category, represented as a dictionary.",
            "example": {"some_setting": "some_value", "another_setting": True}
        }

# The original AdvancedSettings can be removed if all its fields are integrated or deprecated.
# For instance, generation_requirements is now in SchedulingSettingsSchema.
# scheduling_algorithm and max_generation_attempts could also be moved there if they are frontend configurable.

# StoreHoursSettings is also deprecated as its individual day open/close times
# are not the primary way store hours are defined (usually a general opening_days dict + general store_opening/closing times).
# The model.Settings also points to this consolidation.
