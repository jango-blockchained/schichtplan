import { Elysia, t, NotFoundError } from "elysia";
import globalDb from "../db";
import { Database } from "bun:sqlite";
import { logger } from "../index";
import {
    getSettings as getServiceSettings,
    getSettingByKey as getServiceSettingByKey,
    upsertSetting as upsertServiceSetting,
    getAllAbsenceTypes as getServiceAllAbsenceTypes,
    getAbsenceTypeById as getServiceAbsenceTypeById,
    addAbsenceType as addServiceAbsenceType,
    updateAbsenceType as updateServiceAbsenceType,
    deleteAbsenceType as deleteServiceAbsenceType,
    updateSettings,
    getDatabaseTables,
    wipeTablesService
} from "../services/settingsService";
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

// Schemas for validation
const SettingKeyParamSchema = t.Object({ key: t.String() });
const SettingBodySchema = t.Object({
    value: t.String({ minLength: 1 }),
});
const AbsenceTypeIdParamSchema = t.Object({ id: t.Numeric() });
const CreateAbsenceTypeSchema = t.Object({
    name: t.String({ minLength: 1 }),
    is_paid: t.Boolean(),
});
const UpdateAbsenceTypeSchema = t.Partial(CreateAbsenceTypeSchema);

// Schema for wipe tables endpoint
const WipeTablesBodySchema = t.Object({
    tables: t.Array(t.String({ minLength: 1 }), { minItems: 1, error: "At least one table name must be provided." })
});

// --- Define Elysia Routes --- //

export const settingsRoutes = new Elysia({ prefix: "/api/settings" })
    // GET all settings (actually the single settings object)
    .get("/", async ({ set, ...ctx }) => {
        const context = ctx as { db?: Database };
        const currentDb = context.db ?? globalDb;
        const routeLogger = (ctx as any).log || logger;
        routeLogger.debug("Attempting to fetch settings...");
        try {
            const settings = await getServiceSettings(currentDb);
            if (!settings) {
                console.error("Settings object not found after calling getServiceSettings.");
                set.status = 404;
                return { error: "Settings not found." };
            }
            routeLogger.info("Settings fetched successfully.");
            return settings;
        } catch (error: any) {
            routeLogger.error({ err: error }, "Specific error context in GET /api/settings/");
            console.error("Error fetching settings:", error.message);
            if (error instanceof NotFoundError) {
                set.status = 404;
                return { error: error.message || "Settings not found." };
            }
            set.status = 500;
            return { error: "Failed to retrieve settings" };
        }
    })

    // GET all settings
    .put("/", async ({ body, set, ...ctx }) => {
        const context = ctx as { db?: Database };
        const currentDb = context.db ?? globalDb;
        logger.info({ updateData: body }, "Received PUT request to update settings (using base logger)");
        try {
            const updatedSettings = await updateSettings(body, currentDb);
            logger.info("Settings updated successfully via PUT / (using base logger)");
            return updatedSettings;
        } catch (error: any) {
            logger.error({ err: error, updateData: body }, "Error updating settings via PUT / (using base logger)");
            if (error instanceof NotFoundError) {
                 set.status = 404;
                 return { error: error.message || "Settings could not be updated (not found)." };
            }
            set.status = 500;
            return { error: error.message || "Failed to update settings" };
        }
    }, {
        body: SettingsUpdateSchema,
        detail: {
            summary: 'Update Settings',
            description: 'Updates multiple application settings fields. Send only the fields to be changed.',
            tags: ['Settings'],
        }
    })

    // GET list of database tables
    .get("/tables", async ({ set, ...ctx }) => {
        const context = ctx as { db?: Database };
        const currentDb = context.db ?? globalDb;
        const routeLogger = (ctx as any).log || logger;
        routeLogger.debug("Attempting to fetch database table names");
        try {
            const tables = await getDatabaseTables(currentDb);
            routeLogger.info("Database table names fetched successfully");
            return { tables }; // Return tables wrapped in an object
        } catch (error: any) {
            routeLogger.error("Error fetching database table names:", error.message);
            console.error("Error fetching database table names:", error.message);
            set.status = 500;
            return { error: "Failed to retrieve database table names" };
        }
    }, {
         detail: {
            summary: 'Get Database Tables',
            description: 'Retrieves a list of user-manageable database table names.',
            tags: ['Settings'],
         }
    })

    // GET setting by key
    .get("/:key", async ({ params, set, ...ctx }) => {
        const context = ctx as { db?: Database };
        const currentDb = context.db ?? globalDb;
        const routeLogger = (ctx as any).log || logger;
        routeLogger.debug(`Attempting to fetch setting with key ${params.key}`);
        try {
            const setting = await getServiceSettingByKey(params.key, currentDb);
            if (!setting) {
                set.status = 404;
                return { error: `Setting with key '${params.key}' not found` };
            }
            routeLogger.info(`Setting with key ${params.key} fetched successfully`);
            return setting;
        } catch (error: any) {
            routeLogger.error(`Error fetching setting with key ${params.key}:`, error.message);
            set.status = 500;
            return { error: "Failed to retrieve setting" };
        }
    }, { params: SettingKeyParamSchema })

    // PUT (Upsert) setting by key
    .put("/:key", async ({ params, body, set, ...ctx }) => {
        const context = ctx as { db?: Database };
        const currentDb = context.db ?? globalDb;
        const routeLogger = (ctx as any).log || logger;
        routeLogger.debug(`Attempting to upsert setting with key ${params.key}`);
        try {
            const setting = await upsertServiceSetting(params.key, body.value, currentDb);
            routeLogger.info(`Setting with key ${params.key} updated successfully`);
            return setting;
        } catch (error: any) {
            routeLogger.error(`Error upserting setting with key ${params.key}:`, error.message);
            set.status = 500;
            return { error: "Failed to update setting" };
        }
    }, {
        params: SettingKeyParamSchema,
        body: SettingBodySchema,
    })

    // --- Absence Types --- 

    // GET all absence types
    .get("/absence-types", async ({ set, ...ctx }) => {
        const context = ctx as { db?: Database };
        const currentDb = context.db ?? globalDb;
        const routeLogger = (ctx as any).log || logger;
        routeLogger.debug("Attempting to fetch all absence types");
        try {
            const absenceTypes = await getServiceAllAbsenceTypes(currentDb);
            routeLogger.info("All absence types fetched successfully");
            return absenceTypes;
        } catch (error: any) {
            routeLogger.error("Error fetching all absence types:", error.message);
            console.error("Error fetching all absence types:", error.message);
            set.status = 500;
            return { error: "Failed to retrieve absence types" };
        }
    })

    // GET absence type by ID
    .get("/absence-types/:id", async ({ params, set, ...ctx }) => {
        const context = ctx as { db?: Database };
        const currentDb = context.db ?? globalDb;
        const routeLogger = (ctx as any).log || logger;
        routeLogger.debug(`Attempting to fetch absence type with ID ${params.id}`);
        try {
            const absenceType = await getServiceAbsenceTypeById(params.id, currentDb);
            routeLogger.info(`Absence type with ID ${params.id} fetched successfully`);
            return absenceType;
        } catch (error: any) {
            routeLogger.error(`Error fetching absence type with ID ${params.id}:`, error.message);
            if (error instanceof NotFoundError) {
                set.status = 404;
                return { error: error.message };
            }
            console.error(`Error fetching absence type ${params.id}:`, error.message);
            set.status = 500;
            return { error: "Failed to retrieve absence type" };
        }
    }, { params: AbsenceTypeIdParamSchema })

    // POST new absence type
    .post("/absence-types", async ({ body, set, ...ctx }) => {
        const context = ctx as { db?: Database };
        const currentDb = context.db ?? globalDb;
        const routeLogger = (ctx as any).log || logger;
        routeLogger.debug("Attempting to add new absence type");
        try {
            const newAbsenceType = await addServiceAbsenceType(body, currentDb);
            routeLogger.info("New absence type added successfully");
            set.status = 201;
            return newAbsenceType;
        } catch (error: any) {
            routeLogger.error("Error adding absence type:", error.message);
            console.error("Error adding absence type:", error.message);
            set.status = 500;
            return { error: "Failed to add absence type" };
        }
    }, { body: CreateAbsenceTypeSchema })

    // PUT update absence type
    .put("/absence-types/:id", async ({ params, body, set, ...ctx }) => {
        const context = ctx as { db?: Database };
        const currentDb = context.db ?? globalDb;
        const routeLogger = (ctx as any).log || logger;
        routeLogger.debug(`Attempting to update absence type with ID ${params.id}`);
        try {
            const updatedAbsenceType = await updateServiceAbsenceType(params.id, body, currentDb);
            routeLogger.info(`Absence type with ID ${params.id} updated successfully`);
            return updatedAbsenceType;
        } catch (error: any) {
            routeLogger.error(`Error updating absence type with ID ${params.id}:`, error.message);
            if (error instanceof NotFoundError) {
                set.status = 404;
                return { error: error.message };
            }
            console.error(`Error updating absence type ${params.id}:`, error.message);
            set.status = 500;
            return { error: "Failed to update absence type" };
        }
    }, {
        params: AbsenceTypeIdParamSchema,
        body: UpdateAbsenceTypeSchema,
    })

    // DELETE absence type
    .delete("/absence-types/:id", async ({ params, set, ...ctx }) => {
        const context = ctx as { db?: Database };
        const currentDb = context.db ?? globalDb;
        const routeLogger = (ctx as any).log || logger;
        routeLogger.debug(`Attempting to delete absence type with ID ${params.id}`);
        try {
            await deleteServiceAbsenceType(params.id, currentDb);
            routeLogger.info(`Absence type with ID ${params.id} deleted successfully`);
            set.status = 204;
            return;
        } catch (error: any) {
            routeLogger.error(`Error deleting absence type with ID ${params.id}:`, error.message);
            if (error instanceof NotFoundError) {
                set.status = 404;
                return { error: error.message };
            }
            if (error.message.includes("currently in use")) {
                set.status = 400;
                return { error: error.message };
            }
            console.error(`Error deleting absence type ${params.id}:`, error.message);
            set.status = 500;
            return { error: "Failed to delete absence type" };
        }
    }, { params: AbsenceTypeIdParamSchema })

    // POST /settings/wipe-tables
    .post("/wipe-tables", async ({ body, set, ...ctx }) => {
        const context = ctx as { db?: Database };
        const currentDb = context.db ?? globalDb;
        const routeLogger = (ctx as any).log || logger;
        routeLogger.warn({ tables: body.tables }, "Received request to WIPE tables");
        try {
            await wipeTablesService(body.tables, currentDb);
            routeLogger.info("Tables wiped successfully");
            set.status = 204; // No Content
            return; // Return nothing on success
        } catch (error: any) {
            routeLogger.error({ err: error }, "Error wiping tables");
            set.status = error.message?.includes("No tables specified") || error.message?.includes("No valid or allowed tables") ? 400 : 500;
            return { error: error.message || "Failed to wipe tables." };
        }
    }, {
        body: WipeTablesBodySchema,
        detail: {
            summary: 'Wipe Database Tables',
            description: 'Deletes all data from specified database tables. USE WITH EXTREME CAUTION!',
            tags: ['Settings', 'Actions'],
        }
    })

    // TODO: POST /settings/backup endpoint
    // TODO: POST /settings/restore endpoint

    // --- Single Setting Key/Value Routes --- 
    // ... GET /:key, PUT /:key ...

    // --- Absence Types --- 
    // ... absence type routes ...
; 