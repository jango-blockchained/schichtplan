import { Elysia, t } from "elysia";
import { getSettings, updateSettings } from "../services/settingsService";
import type {
  Settings,
  OpeningDays,
  SpecialHours,
  SchedulingAdvanced,
  PdfLayoutPresets,
  AvailabilityTypeDefinition,
  EmployeeTypeDefinition,
  ShiftTypeDefinition,
  AbsenceTypeDefinition,
  ActionsDemoData,
} from "../db/schema";

// --- Define Elysia Schemas for Settings --- //

// Define schemas for nested objects (important for validation)
const OpeningDaysSchema = t.Record(t.String(), t.Boolean());
const SpecialHourEntrySchema = t.Object({
  is_closed: t.Boolean(),
  opening: t.String({ format: "time" }), // Assuming "HH:MM"
  closing: t.String({ format: "time" }),
});
const SpecialHoursSchema = t.Record(t.String({ format: "date" }), SpecialHourEntrySchema); // Key: "YYYY-MM-DD"
const SchedulingAdvancedSchema = t.Record(t.String(), t.Any()); // Allow any structure for now

const PdfLayoutConfigSchema = t.Object({
    page_size: t.String(),
    orientation: t.Union([t.Literal("portrait"), t.Literal("landscape")]),
    margin_top: t.Number(),
    margin_right: t.Number(),
    margin_bottom: t.Number(),
    margin_left: t.Number(),
    table_header_bg_color: t.String({ format: 'hex-color'}),
    table_border_color: t.String({ format: 'hex-color'}),
    table_text_color: t.String({ format: 'hex-color'}),
    table_header_text_color: t.String({ format: 'hex-color'}),
    font_family: t.String(),
    font_size: t.Number(),
    header_font_size: t.Number(),
    show_employee_id: t.Boolean(),
    show_position: t.Boolean(),
    show_breaks: t.Boolean(),
    show_total_hours: t.Boolean(),
    name: t.Optional(t.String())
});

const PdfLayoutPresetsSchema = t.Record(t.String(), PdfLayoutConfigSchema);

const AvailabilityTypeDefinitionSchema = t.Object({
  id: t.String(),
  name: t.String(),
  description: t.String(),
  color: t.String({ format: 'hex-color'}),
  priority: t.Number(),
  is_available: t.Boolean(),
});

const EmployeeTypeDefinitionSchema = t.Object({
  id: t.String(),
  name: t.String(),
  min_hours: t.Number(),
  max_hours: t.Number(),
  max_daily_hours: t.Number(),
  type: t.String(), // Could be t.Literal('employee') if fixed
});

const ShiftTypeHourConditionsSchema = t.Object({
    startTime: t.String({ format: 'time' }),
    endTime: t.String({ format: 'time' }),
    minDuration: t.Number(),
    maxDuration: t.Number(),
});

const ShiftTypeDefinitionSchema = t.Object({
  id: t.String(),
  name: t.String(),
  color: t.String({ format: 'hex-color'}),
  type: t.String(), // Could be t.Literal('shift') if fixed
  hourConditions: t.Optional(ShiftTypeHourConditionsSchema),
});

const AbsenceTypeDefinitionSchema = t.Object({
  id: t.String(),
  name: t.String(),
  color: t.String({ format: 'hex-color'}),
  type: t.String(), // Could be t.Literal('absence') if fixed
});

const ActionsDemoDataSchema = t.Object({
    selected_module: t.String(),
    last_execution: t.Nullable(t.String({ format: 'date-time'})),
})

// Define the main Settings schema for the PUT request body (Partial)
// We make most fields optional because it's a PUT/PATCH operation
const SettingsUpdateSchema = t.Partial(t.Object({
  store_name: t.Optional(t.String()),
  store_address: t.Optional(t.Nullable(t.String())),
  store_contact: t.Optional(t.Nullable(t.String())),
  timezone: t.Optional(t.String()),
  language: t.Optional(t.String()),
  date_format: t.Optional(t.String()),
  time_format: t.Optional(t.String()),
  store_opening: t.Optional(t.String({ format: "time" })),
  store_closing: t.Optional(t.String({ format: "time" })),
  opening_days: t.Optional(OpeningDaysSchema),
  special_hours: t.Optional(SpecialHoursSchema),
  keyholder_before_minutes: t.Optional(t.Number({ minimum: 0 })),
  keyholder_after_minutes: t.Optional(t.Number({ minimum: 0 })),
  require_keyholder: t.Optional(t.Boolean()),
  scheduling_resource_type: t.Optional(t.Union([t.Literal("coverage"), t.Literal("shifts")])),
  default_shift_duration: t.Optional(t.Number({ minimum: 0 })),
  min_break_duration: t.Optional(t.Number({ minimum: 0 })),
  max_daily_hours: t.Optional(t.Number({ minimum: 0 })),
  max_weekly_hours: t.Optional(t.Number({ minimum: 0 })),
  min_rest_between_shifts: t.Optional(t.Number({ minimum: 0 })),
  scheduling_period_weeks: t.Optional(t.Number({ minimum: 1 })),
  auto_schedule_preferences: t.Optional(t.Boolean()),
  min_employees_per_shift: t.Optional(t.Number({ minimum: 0 })),
  max_employees_per_shift: t.Optional(t.Number({ minimum: 0 })),
  allow_dynamic_shift_adjustment: t.Optional(t.Boolean()),
  scheduling_advanced: t.Optional(SchedulingAdvancedSchema),
  theme: t.Optional(t.String()),
  primary_color: t.Optional(t.String({ format: 'hex-color'})),
  secondary_color: t.Optional(t.String({ format: 'hex-color'})),
  accent_color: t.Optional(t.String({ format: 'hex-color'})),
  background_color: t.Optional(t.String({ format: 'hex-color'})),
  surface_color: t.Optional(t.String({ format: 'hex-color'})),
  text_color: t.Optional(t.String({ format: 'hex-color'})),
  dark_theme_primary_color: t.Optional(t.String({ format: 'hex-color'})),
  dark_theme_secondary_color: t.Optional(t.String({ format: 'hex-color'})),
  dark_theme_accent_color: t.Optional(t.String({ format: 'hex-color'})),
  dark_theme_background_color: t.Optional(t.String({ format: 'hex-color'})),
  dark_theme_surface_color: t.Optional(t.String({ format: 'hex-color'})),
  dark_theme_text_color: t.Optional(t.String({ format: 'hex-color'})),
  show_sunday: t.Optional(t.Boolean()),
  show_weekdays: t.Optional(t.Boolean()),
  start_of_week: t.Optional(t.Number({ minimum: 0, maximum: 1 })), // 0=Sun, 1=Mon
  email_notifications: t.Optional(t.Boolean()),
  schedule_published_notify: t.Optional(t.Boolean()),
  shift_changes_notify: t.Optional(t.Boolean()),
  time_off_requests_notify: t.Optional(t.Boolean()),
  // PDF Layout directly embedded in Settings for update
  page_size: t.Optional(t.String()),
  orientation: t.Optional(t.Union([t.Literal("portrait"), t.Literal("landscape")])),
  margin_top: t.Optional(t.Number()),
  margin_right: t.Optional(t.Number()),
  margin_bottom: t.Optional(t.Number()),
  margin_left: t.Optional(t.Number()),
  table_header_bg_color: t.Optional(t.String({ format: 'hex-color'})),
  table_border_color: t.Optional(t.String({ format: 'hex-color'})),
  table_text_color: t.Optional(t.String({ format: 'hex-color'})),
  table_header_text_color: t.Optional(t.String({ format: 'hex-color'})),
  font_family: t.Optional(t.String()),
  font_size: t.Optional(t.Number()),
  header_font_size: t.Optional(t.Number()),
  show_employee_id: t.Optional(t.Boolean()),
  show_position: t.Optional(t.Boolean()),
  show_breaks: t.Optional(t.Boolean()),
  show_total_hours: t.Optional(t.Boolean()),
  pdf_layout_presets: t.Optional(t.Nullable(PdfLayoutPresetsSchema)),
  // Definition Data (Arrays)
  availability_types: t.Optional(t.Array(AvailabilityTypeDefinitionSchema)),
  employee_types: t.Optional(t.Array(EmployeeTypeDefinitionSchema)),
  shift_types: t.Optional(t.Array(ShiftTypeDefinitionSchema)),
  absence_types: t.Optional(t.Array(AbsenceTypeDefinitionSchema)),
  actions_demo_data: t.Optional(t.Nullable(ActionsDemoDataSchema)),
}));


// --- Define Elysia Routes --- //

export const settingsRoutes = new Elysia({ prefix: "/settings" })
  // GET /api/settings
  .get("/", async ({ set }) => {
    try {
      const settings = await getSettings();
      return settings;
    } catch (error: any) {
      console.error(`Error fetching settings: ${error.message}`);
      set.status = 500;
      return { error: "Failed to retrieve settings" };
    }
  })

  // PUT /api/settings
  .put("/", async ({ body, set }) => {
      try {
        const updatedSettings = await updateSettings(body);
        return updatedSettings;
      } catch (error: any) {
        console.error(`Error updating settings: ${error.message}`);
        // Consider more specific error codes based on service errors
        set.status = 500;
        return { error: "Failed to update settings" };
      }
    },
    {
      // Validate the request body against the schema
      body: SettingsUpdateSchema,
      // We can add response schema later if needed
      // response: SettingsSchema // Assuming a full Settings schema exists
    }
  ); 