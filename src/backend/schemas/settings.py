from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, RootModel, field_validator

# --- Existing/Verified Models (with minor adjustments if needed) ---


class SpecialDayCustomHours(BaseModel):
    """Schema for custom hours on a special day."""

    opening: str = Field(..., description="Opening time in HH:MM format.")
    closing: str = Field(..., description="Closing time in HH:MM format.")

    @field_validator("opening", "closing")
    @classmethod
    def validate_time_format(cls, v):
        """Validate time is in HH:MM format."""
        try:
            datetime.strptime(v, "%H:%M")
        except ValueError:
            raise ValueError(f"Time must be in HH:MM format, got {v}")
        return v


class SpecialDay(BaseModel):
    """Schema for a special day configuration."""

    description: str = Field(..., description="Description of the special day.")
    is_closed: bool = Field(..., description="Whether the store is closed on this day.")
    custom_hours: SpecialDayCustomHours | None = Field(
        None, description="Custom opening hours if not closed."
    )
    # Removed 'date' field from here, as it's expected to be the key in a Dict in GeneralSettings


class GenerationRequirements(BaseModel):
    """Schema for schedule generation requirements."""

    enforce_minimum_coverage: bool | None = Field(
        True, description="Enforce minimum coverage requirements."
    )
    enforce_contracted_hours: bool | None = Field(
        True, description="Enforce contracted hours for employees."
    )
    enforce_keyholder_coverage: bool | None = Field(
        True, description="Ensure keyholder coverage for shifts requiring keyholders."
    )
    enforce_rest_periods: bool | None = Field(
        True, description="Enforce minimum rest periods between shifts."
    )
    enforce_early_late_rules: bool | None = Field(
        True, description="Enforce rules for early/late shifts."
    )
    enforce_employee_group_rules: bool | None = Field(
        True, description="Enforce rules specific to employee groups."
    )
    enforce_break_rules: bool | None = Field(
        True, description="Enforce break rules based on shift duration."
    )
    enforce_max_hours: bool | None = Field(
        True, description="Enforce maximum working hours per day/week."
    )
    enforce_consecutive_days: bool | None = Field(
        True, description="Enforce maximum consecutive working days."
    )
    enforce_weekend_distribution: bool | None = Field(
        True, description="Enforce fair distribution of weekend shifts."
    )
    enforce_shift_distribution: bool | None = Field(
        True, description="Enforce fair distribution of different shift types."
    )
    enforce_availability: bool | None = Field(
        True, description="Respect employee availability preferences."
    )
    enforce_qualifications: bool | None = Field(
        True, description="Respect employee qualifications for specific tasks."
    )
    enforce_opening_hours: bool | None = Field(
        True, description="Respect store opening hours for scheduling."
    )
    # Add any other fields if present in frontend type Settings.scheduling.generation_requirements or model


# --- NEW Pydantic Models (as per task plan) ---


class GeneralSettings(BaseModel):  # Modified as per plan
    """Schema for general settings."""

    store_name: str | None = Field(None, description="Name of the store.")
    store_address: str | None = Field(None, description="Address of the store.")
    store_phone: str | None = Field(
        None, description="Phone number of the store."
    )  # Added from plan
    store_email: str | None = Field(
        None, description="Email address of the store."
    )  # Added from plan
    timezone: str | None = Field(None, description="Timezone for the store operations.")
    language: str | None = Field(
        None, description="Default language for the application."
    )
    date_format: str | None = Field(None, description="Preferred date format.")
    time_format: str | None = Field(
        None, description="Preferred time format (e.g., 12h or 24h)."
    )
    weekend_start: int | None = Field(
        None, description="Weekend start preference (0=Sunday, 1=Monday)."
    )
    store_opening: str | None = Field(
        None, description="Default store opening time (HH:MM)."
    )  # For general reference
    store_closing: str | None = Field(
        None, description="Default store closing time (HH:MM)."
    )  # For general reference
    keyholder_before_minutes: int | None = Field(
        None, description="Minutes keyholder must be present before opening."
    )
    keyholder_after_minutes: int | None = Field(
        None, description="Minutes keyholder must be present after closing."
    )
    opening_days: (
        dict[
            Literal[
                "monday",
                "tuesday",
                "wednesday",
                "thursday",
                "friday",
                "saturday",
                "sunday",
            ],
            bool,
        ]
        | None
    ) = Field(None, description="Which days the store is open.")
    special_days: dict[str, SpecialDay] | None = Field(
        None, description="Special days and holidays configuration (key: YYYY-MM-DD)."
    )
    # Removed break_duration_minutes from here, will be in SchedulingSettingsSchema

    @field_validator("store_opening", "store_closing")
    @classmethod
    def validate_time_format_optional(cls, v):
        if v is not None:
            try:
                datetime.strptime(v, "%H:%M")
            except ValueError:
                raise ValueError(f"Time must be in HH:MM format, got {v}")
        return v

    @field_validator("special_days")
    @classmethod
    def validate_special_days_date_keys(cls, v):
        if v is not None:
            for date_str in v:
                try:
                    datetime.strptime(date_str, "%Y-%m-%d")
                except ValueError:
                    raise ValueError(
                        f"Special day date key must be in YYYY-MM-DD format, got {date_str}"
                    )
        return v


class SchedulingSettingsSchema(BaseModel):
    """Schema for scheduling-specific settings."""

    scheduling_resource_type: Literal["shifts", "coverage"] | None = Field(
        None, description="Primary resource type for scheduling."
    )
    default_shift_duration: float | None = Field(
        None, description="Default duration for shifts in hours."
    )
    min_break_duration: int | None = Field(
        None, description="Minimum break duration in minutes."
    )
    max_daily_hours: float | None = Field(
        None, description="Maximum daily working hours for an employee."
    )
    max_weekly_hours: float | None = Field(
        None, description="Maximum weekly working hours for an employee."
    )
    total_weekly_working_hours: float | None = Field(
        None, description="Total weekly working hours constraint for all employees."
    )
    min_rest_between_shifts: float | None = Field(
        None, description="Minimum rest period between shifts in hours."
    )
    scheduling_period_weeks: int | None = Field(
        None, description="Number of weeks for a standard scheduling period."
    )
    auto_schedule_preferences: bool | None = Field(
        None, description="Whether to automatically consider employee preferences."
    )
    enable_diagnostics: bool | None = Field(
        None, description="Enable diagnostic logging for the scheduler."
    )
    generation_requirements: GenerationRequirements | None = Field(
        None, description="Detailed constraints for schedule generation."
    )
    scheduling_algorithm: Literal["standard", "optimized"] | None = Field(
        None, description="Algorithm to use for scheduling."
    )
    max_generation_attempts: int | None = Field(
        None, description="Maximum number of attempts for schedule generation."
    )


class DisplaySettingsDarkThemeSchema(BaseModel):
    """Schema for dark theme specific display settings."""

    primary_color: str | None = Field(None, description="Primary color for dark theme.")
    secondary_color: str | None = Field(
        None, description="Secondary color for dark theme."
    )
    accent_color: str | None = Field(None, description="Accent color for dark theme.")
    background_color: str | None = Field(
        None, description="Background color for dark theme."
    )
    surface_color: str | None = Field(None, description="Surface color for dark theme.")
    text_color: str | None = Field(None, description="Text color for dark theme.")


class DisplaySettingsSchema(BaseModel):
    """Schema for general display and notification settings."""

    theme: Literal["light", "dark", "system"] | None = Field(
        None, description="Application theme."
    )
    primary_color: str | None = Field(
        None, description="Primary color for light theme."
    )
    secondary_color: str | None = Field(
        None, description="Secondary color for light theme."
    )
    accent_color: str | None = Field(None, description="Accent color for light theme.")
    background_color: str | None = Field(
        None, description="Background color for light theme."
    )
    surface_color: str | None = Field(
        None, description="Surface color for light theme."
    )
    text_color: str | None = Field(None, description="Text color for light theme.")
    dark_theme: DisplaySettingsDarkThemeSchema | None = Field(
        None, description="Specific settings for dark theme."
    )
    show_sunday: bool | None = Field(None, description="Show Sunday in calendar views.")
    show_weekdays: bool | None = Field(
        None, description="Show weekdays in calendar views."
    )  # This seems redundant if show_sunday implies others
    start_of_week: Literal[0, 1, 2, 3, 4, 5, 6] | None = Field(
        None, description="Start day of the week (0=Sunday, 1=Monday, ...)."
    )  # Adjusted to Literal
    calendar_start_day: Literal["sunday", "monday"] | None = Field(
        None, description="User's preferred start day for calendar views."
    )
    calendar_default_view: Literal["month", "week", "day"] | None = Field(
        None, description="Default view for the calendar."
    )
    email_notifications: bool | None = Field(
        None, description="Master switch for email notifications."
    )
    schedule_published_notify: bool | None = Field(
        None, description="Notify on schedule publish."
    )  # Aligned name
    shift_changes_notify: bool | None = Field(
        None, description="Notify on shift changes."
    )  # Aligned name
    time_off_requests_notify: bool | None = Field(
        None, description="Notify on time-off requests."
    )  # Aligned name


class PDFMarginsSchema(BaseModel):
    """Schema for PDF margins."""

    top: float | None = Field(
        None, description="Top margin in units (e.g., mm or inches)."
    )
    right: float | None = Field(None, description="Right margin.")
    bottom: float | None = Field(None, description="Bottom margin.")
    left: float | None = Field(None, description="Left margin.")


class PDFTableStyleSchema(BaseModel):
    """Schema for PDF table styling."""

    header_bg_color: str | None = Field(
        None, description="Header background color (hex)."
    )
    border_color: str | None = Field(None, description="Table border color (hex).")
    text_color: str | None = Field(None, description="Table text color (hex).")
    header_text_color: str | None = Field(None, description="Header text color (hex).")


class PDFFontsSchema(BaseModel):
    """Schema for PDF font settings."""

    family: str | None = Field(None, description="Font family name.")
    size: float | None = Field(None, description="Base font size.")
    header_size: float | None = Field(None, description="Header font size.")


class PDFContentSchema(BaseModel):
    """Schema for content visibility in PDFs."""

    show_employee_id: bool | None = Field(None, description="Show employee ID in PDF.")
    show_position: bool | None = Field(
        None, description="Show employee position in PDF."
    )
    show_breaks: bool | None = Field(None, description="Show break times in PDF.")
    show_total_hours: bool | None = Field(
        None, description="Show total hours for employees in PDF."
    )


# MEP PDF Configuration Schemas - Matching Frontend SimplifiedPDFConfig


class MEPStoreFieldSchema(BaseModel):
    """Schema for MEP store field."""

    label: str | None = None
    value: str | None = None


class MEPPeriodFieldSchema(BaseModel):
    """Schema for MEP period field."""

    label: str | None = None
    value: str | None = None


class MEPPeriodFieldsSchema(BaseModel):
    """Schema for MEP period fields."""

    month_year: MEPPeriodFieldSchema | None = None
    week_from: MEPPeriodFieldSchema | None = None
    week_to: MEPPeriodFieldSchema | None = None


class MEPStorageNoteSchema(BaseModel):
    """Schema for MEP storage note."""

    text: str | None = None
    position: str | None = None


class MEPHeaderSchema(BaseModel):
    """Schema for MEP header."""

    title: str | None = None
    store_field: MEPStoreFieldSchema | None = None
    period_fields: MEPPeriodFieldsSchema | None = None
    storage_note: MEPStorageNoteSchema | None = None


class MEPEmployeeColumnSchema(BaseModel):
    """Schema for MEP employee column."""

    label: str | None = None
    width: float | None = None


class MEPEmployeeColumnsSchema(BaseModel):
    """Schema for MEP employee columns."""

    name: MEPEmployeeColumnSchema | None = None
    function: MEPEmployeeColumnSchema | None = None
    plan_week: MEPEmployeeColumnSchema | None = None


class MEPDayColumnsSchema(BaseModel):
    """Schema for MEP day columns."""

    enabled_days: list[str] | None = None
    day_labels: dict[str, str] | None = None
    day_width: float | None = None


class MEPSummaryColumnSchema(BaseModel):
    """Schema for MEP summary column."""

    label: str | None = None
    width: float | None = None


class MEPSummaryColumnsSchema(BaseModel):
    """Schema for MEP summary columns."""

    week_total: MEPSummaryColumnSchema | None = None
    month_total: MEPSummaryColumnSchema | None = None


class MEPRowSchema(BaseModel):
    """Schema for MEP row."""

    label: str | None = None
    enabled: bool | None = None


class MEPRowStructureSchema(BaseModel):
    """Schema for MEP row structure."""

    date_row: MEPRowSchema | None = None
    active_row: MEPRowSchema | None = None
    start_row: MEPRowSchema | None = None
    break_row: MEPRowSchema | None = None
    end_row: MEPRowSchema | None = None
    total_row: MEPRowSchema | None = None


class MEPTableSchema(BaseModel):
    """Schema for MEP table."""

    employee_columns: MEPEmployeeColumnsSchema | None = None
    day_columns: MEPDayColumnsSchema | None = None
    summary_columns: MEPSummaryColumnsSchema | None = None
    row_structure: MEPRowStructureSchema | None = None


class MEPBreakRulesSchema(BaseModel):
    """Schema for MEP break rules."""

    enabled: bool | None = None
    text: str | None = None


class MEPAbsenceTypeSchema(BaseModel):
    """Schema for MEP absence type."""

    code: str | None = None
    label: str | None = None


class MEPAbsenceTypesSchema(BaseModel):
    """Schema for MEP absence types."""

    enabled: bool | None = None
    title: str | None = None
    types: list[MEPAbsenceTypeSchema] | None = None


class MEPInstructionsSchema(BaseModel):
    """Schema for MEP instructions."""

    enabled: bool | None = None
    text: str | None = None


class MEPDateStampSchema(BaseModel):
    """Schema for MEP date stamp."""

    enabled: bool | None = None
    text: str | None = None


class MEPFooterSchema(BaseModel):
    """Schema for MEP footer."""

    break_rules: MEPBreakRulesSchema | None = None
    absence_types: MEPAbsenceTypesSchema | None = None
    instructions: MEPInstructionsSchema | None = None
    date_stamp: MEPDateStampSchema | None = None


class MEPFontsSchema(BaseModel):
    """Schema for MEP fonts."""

    header_font: str | None = None
    header_size: float | None = None
    table_font: str | None = None
    table_size: float | None = None
    footer_font: str | None = None
    footer_size: float | None = None


class MEPColorsSchema(BaseModel):
    """Schema for MEP colors."""

    header_bg: str | None = None
    header_text: str | None = None
    table_border: str | None = None
    table_bg: str | None = None
    table_text: str | None = None


class MEPSpacingSchema(BaseModel):
    """Schema for MEP spacing."""

    page_margin: float | None = None
    section_spacing: float | None = None
    row_height: float | None = None


class MEPTableStyleSchema(BaseModel):
    """Schema for MEP table style."""

    border_width: float | None = None
    grid_style: str | None = None
    cell_padding: float | None = None


class MEPStylingSchema(BaseModel):
    """Schema for MEP styling."""

    fonts: MEPFontsSchema | None = None
    colors: MEPColorsSchema | None = None
    spacing: MEPSpacingSchema | None = None
    table_style: MEPTableStyleSchema | None = None


class SimplifiedPDFConfigSchema(BaseModel):
    """Schema for the complete MEP PDF configuration matching frontend interface."""

    header: MEPHeaderSchema | None = None
    table: MEPTableSchema | None = None
    footer: MEPFooterSchema | None = None
    styling: MEPStylingSchema | None = None


class PDFLayoutSettingsSchema(BaseModel):
    """Schema for overall PDF layout settings supporting both legacy and MEP formats."""

    # Legacy settings for backward compatibility
    page_size: str | None = Field(None, description="Page size (e.g., A4, Letter).")
    orientation: Literal["portrait", "landscape"] | None = Field(
        None, description="Page orientation."
    )
    margins: PDFMarginsSchema | None = Field(None, description="Page margins.")
    fonts: PDFFontsSchema | None = Field(None, description="Font settings.")
    table_style: PDFTableStyleSchema | None = Field(None, description="Table styling.")
    content: PDFContentSchema | None = Field(
        None, description="Content visibility settings."
    )

    # New MEP configuration - this will be the main config when using MEP layouts
    header: MEPHeaderSchema | None = Field(
        None, description="MEP header configuration."
    )
    table: MEPTableSchema | None = Field(None, description="MEP table configuration.")
    footer: MEPFooterSchema | None = Field(
        None, description="MEP footer configuration."
    )
    styling: MEPStylingSchema | None = Field(
        None, description="MEP styling configuration."
    )
    table_style: PDFTableStyleSchema | None = Field(
        None, description="Styling for tables in PDF."
    )
    fonts: PDFFontsSchema | None = Field(None, description="Font settings for PDF.")
    content: PDFContentSchema | None = Field(
        None, description="Content visibility settings for PDF."
    )

    # New MEP-specific configuration
    mep_config: SimplifiedPDFConfigSchema | None = Field(
        None, description="Detailed MEP form configuration"
    )


class EmployeeTypeSchema(BaseModel):
    """Schema for defining an employee type/group."""

    id: str = Field(..., description="Unique identifier for the employee type.")
    name: str = Field(..., description="Display name of the employee type.")
    abbr: str | None = Field(None, description="Abbreviation for the employee type.")
    min_hours: float | None = Field(
        None, description="Minimum contractual hours for this type."
    )  # Made optional based on common use cases
    max_hours: float | None = Field(
        None, description="Maximum contractual hours for this type."
    )  # Made optional
    type: Literal["employee_type", "employee"] = Field(
        "employee_type", description="Internal type discriminator."
    )


class ShiftTypeSchemaPydantic(BaseModel):  # Renamed to avoid conflicts
    """Schema for defining a shift type."""

    id: str = Field(..., description="Unique identifier for the shift type.")
    name: str = Field(..., description="Display name of the shift type.")
    color: str = Field(..., description="Color code (hex) for this shift type.")
    type: Literal["shift_type"] = Field(
        "shift_type", description="Internal type discriminator."
    )
    auto_assign_only: bool | None = Field(
        None, description="Whether this shift type is for auto-assignment only."
    )


class AbsenceTypeSchema(BaseModel):
    """Schema for defining an absence type."""

    id: str = Field(..., description="Unique identifier for the absence type.")
    name: str = Field(..., description="Display name of the absence type.")
    color: str = Field(..., description="Color code (hex) for this absence type.")
    type: Literal["absence_type", "absence"] = Field(
        "absence_type", description="Internal type discriminator."
    )


class EmployeeGroupsSettingsSchema(BaseModel):
    """Schema for managing employee types, shift types, and absence types."""

    employee_types: list[EmployeeTypeSchema] | None = Field(
        None, description="List of defined employee types."
    )
    shift_types: list[ShiftTypeSchemaPydantic] | None = Field(
        None, description="List of defined shift types."
    )
    absence_types: list[AbsenceTypeSchema] | None = Field(
        None, description="List of defined absence types."
    )


class AvailabilityTypeDetailSchema(BaseModel):
    """Schema for a single availability type definition."""

    id: str = Field(..., description="Unique identifier for the availability type.")
    name: str = Field(..., description="Display name of the availability type.")
    description: str | None = Field(
        None, description="Description of the availability type."
    )  # Made Optional
    color: str = Field(..., description="Color code (hex) for this availability type.")
    priority: int = Field(
        ...,
        description="Priority level for scheduling (higher means more preferred/important).",
    )
    is_available: bool = Field(
        ..., description="Does this type signify availability or unavailability?"
    )


class AvailabilityTypesSettingsSchema(BaseModel):
    """Schema for managing different types of employee availability."""

    types: list[AvailabilityTypeDetailSchema] | None = Field(
        None, description="List of defined availability types."
    )


class DemoDataSettingsSchema(BaseModel):
    """Schema for demo data generation settings."""

    selected_module: str | None = Field(
        None, description="Module for which to generate demo data."
    )
    last_execution: str | None = Field(
        None,
        description="Timestamp of the last demo data generation (ISO format string).",
    )  # Changed back to string for JSON serialization


class ActionsSettingsSchema(BaseModel):
    """Schema for settings related to executable actions like demo data generation."""

    demo_data: DemoDataSettingsSchema | None = Field(
        None, description="Settings for demo data generation."
    )


class WeekNavigationSettingsSchema(BaseModel):
    """Schema for week navigation settings."""

    week_weekend_start: Literal["MONDAY", "SUNDAY"] | None = Field(
        None, description="Weekend start preference (MONDAY or SUNDAY)."
    )
    week_month_boundary_mode: Literal["keep_intact", "split_by_month"] | None = Field(
        None, description="How to handle weeks that span multiple months."
    )


class AISchedulingSettingsSchema(BaseModel):
    """Schema for AI-assisted scheduling features."""

    enabled: bool | None = Field(
        None, description="Enable/disable AI scheduling features."
    )
    api_key: str | None = Field(None, description="API key for AI scheduling service.")


# --- Main Settings Schema ---


class CompleteSettings(BaseModel):
    """Schema for the complete settings object. All fields are optional for partial updates."""

    model_config = ConfigDict(validate_assignment=True)

    general: GeneralSettings | None = Field(
        None, description="General store and application settings."
    )
    scheduling: SchedulingSettingsSchema | None = Field(
        None, description="Settings related to the scheduling engine and rules."
    )
    # 'scheduling_advanced' from existing AdvancedSettings is deprecated if its content (like generation_requirements)
    # is now fully part of 'scheduling'. If other distinct advanced fields exist, it could be kept.
    # For now, assuming 'generation_requirements' is moved to 'scheduling'.
    # scheduling_advanced: Optional[AdvancedSettings] = Field(None, description="Advanced scheduling parameters.") # Task plan says review/remove
    display: DisplaySettingsSchema | None = Field(
        None, description="Display, theme, and notification settings."
    )
    pdf_layout: PDFLayoutSettingsSchema | None = Field(
        None, description="Settings for PDF generation layout and content."
    )
    employee_groups: EmployeeGroupsSettingsSchema | None = Field(
        None,
        description="Management of employee types, shift types, and absence types.",
    )
    availability_types: AvailabilityTypesSettingsSchema | None = Field(
        None, description="Configuration for employee availability types."
    )
    actions: ActionsSettingsSchema | None = Field(
        None, description="Settings related to system actions like demo data."
    )
    ai_scheduling: AISchedulingSettingsSchema | None = Field(
        None, description="Settings for AI-powered scheduling features."
    )
    week_navigation: WeekNavigationSettingsSchema | None = Field(
        None, description="Settings for week-based navigation."
    )


# --- Utility Schemas (from original file, if still needed) ---


class TablesList(BaseModel):
    """Schema for the wipe tables request."""

    tables: list[str] = Field(..., description="List of table names to wipe.")


class SettingValue(
    BaseModel
):  # This might be used for a generic single setting update endpoint
    """Schema for updating a single setting value, if a generic endpoint exists."""

    value: Any = Field(..., description="The new value for the setting.")


# CategorySettings: RootModel if available, else BaseModel fallback
class CategorySettings(RootModel[dict[str, Any]]):
    """Settings for a specific category, represented as a dictionary."""

    model_config = ConfigDict(
        json_schema_extra={
            "description": "Settings for a specific category, represented as a dictionary.",
            "example": {"some_setting": "some_value", "another_setting": True},
        }
    )


# The original AdvancedSettings can be removed if all its fields are integrated or deprecated.
# For instance, generation_requirements is now in SchedulingSettingsSchema.
# scheduling_algorithm and max_generation_attempts could also be moved there if they are frontend configurable.

# StoreHoursSettings is also deprecated as its individual day open/close times
# are not the primary way store hours are defined (usually a general opening_days dict + general store_opening/closing times).
# The model.Settings also points to this consolidation.
