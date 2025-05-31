import { Elysia, t } from "elysia";
import { getDb } from "../db"; // Import getDb
import { getScheduleByVersion, getScheduleVersions, generateSchedule, createNewScheduleVersion } from "../services/scheduleService.js";
import { NotFoundError } from "elysia";

// Initialize the database instance
const db = getDb();

// Validation schema for version path parameter
const versionParamSchema = t.Object({
    version: t.Numeric({ minimum: 1, error: "Version must be a positive integer." })
});

// Validation schema for the generate endpoint body
const generateScheduleBodySchema = t.Object({
    startDate: t.String({ format: 'date', error: "startDate is required (YYYY-MM-DD)." }),
    endDate: t.String({ format: 'date', error: "endDate is required (YYYY-MM-DD)." }),
    createEmptySchedules: t.Optional(t.Boolean()),
    version: t.Optional(t.Numeric({ minimum: 1 })),
    aiConfig: t.Optional(t.Object({
        weights: t.Optional(t.Object({
            availability: t.Optional(t.Number()),
            preferences: t.Optional(t.Number()),
            fairness: t.Optional(t.Number()),
            history: t.Optional(t.Number()),
            workload: t.Optional(t.Number()),
            keyholder: t.Optional(t.Number()),
            skills: t.Optional(t.Number()),
            fatigue: t.Optional(t.Number()),
            seniority: t.Optional(t.Number()),
        })),
        fatigueThreshold: t.Optional(t.Number()),
        workloadBalanceTarget: t.Optional(t.Number()),
        historicalLookbackDays: t.Optional(t.Number()),
    })),
    schedulerConfig: t.Optional(t.Object({
        minShiftMinutes: t.Optional(t.Number()),
        maxShiftMinutes: t.Optional(t.Number()),
        slotIntervalMinutes: t.Optional(t.Number()),
        maxConsecutiveDays: t.Optional(t.Number()),
        defaultMinRestPeriodMinutes: t.Optional(t.Number()),
        defaultMaxDailyMinutes: t.Optional(t.Number()),
        defaultAbsoluteMaxDailyMinutes: t.Optional(t.Number()),
        breakThresholdMinutes: t.Optional(t.Number()),
        breakDurationMinutes: t.Optional(t.Number()),
        enforceKeyholderRule: t.Optional(t.Boolean()),
        openingLeadTimeMinutes: t.Optional(t.Number()),
        closingLagTimeMinutes: t.Optional(t.Number()),
    }))
});

// Schema for creating a new version
const createVersionBodySchema = t.Object({
    start_date: t.String({ format: 'date', error: "start_date is required (YYYY-MM-DD)." }),
    end_date: t.String({ format: 'date', error: "end_date is required (YYYY-MM-DD)." }),
    base_version: t.Optional(t.Numeric({ minimum: 1, error: "base_version must be a positive integer." })),
    notes: t.Optional(t.String())
});

// Schema for updating schedule version status
const updateVersionStatusSchema = t.Object({
    status: t.Enum({
        DRAFT: "DRAFT",
        PUBLISHED: "PUBLISHED",
        ARCHIVED: "ARCHIVED"
    }, { error: "Status must be one of: DRAFT, PUBLISHED, ARCHIVED" })
});

// Schema for updating schedule version notes
const updateVersionNotesSchema = t.Object({
    notes: t.String({ error: "Notes must be a string" })
});

// Schema for updating a schedule entry
const updateScheduleEntrySchema = t.Object({
    shift_id: t.Optional(t.Numeric({ error: "shift_id must be a number" })),
    break_start: t.Optional(t.String({ pattern: '^([01]\\d|2[0-3]):([0-5]\\d)$', error: "break_start must be in HH:MM format" })),
    break_end: t.Optional(t.String({ pattern: '^([01]\\d|2[0-3]):([0-5]\\d)$', error: "break_end must be in HH:MM format" })),
    notes: t.Optional(t.String()),
    shift_type: t.Optional(t.String())
});

// Schema for schedule entry ID parameter
const scheduleEntryParamSchema = t.Object({
    id: t.Numeric({ minimum: 1, error: "Entry ID must be a positive integer." })
});

const scheduleRoutes = new Elysia({ prefix: "/api/schedules" })
  // GET /api/schedules/version/:version
  .get("/version/:version", async ({ params, set }) => {
    try {
        const scheduleEntries = await getScheduleByVersion(params.version);
        // Assuming getScheduleByVersion returns null or throws if not found
        if (!scheduleEntries) {
             throw new NotFoundError(`Schedule version ${params.version} not found.`);
        }
        return scheduleEntries;
    } catch (error: any) {
        console.error(`Error in GET /api/schedules/version/${params.version}:`, error);
        if (error instanceof NotFoundError) {
            set.status = 404;
            return { error: error.message };
        }
        if (error.message?.includes("Invalid schedule version")) {
            set.status = 400;
            return { error: error.message };
        }
        set.status = 500;
        return { error: error.message || "Failed to retrieve schedule" };
    }
  }, {
      params: versionParamSchema,
       detail: { // Add Swagger details
            summary: 'Get Schedule by Version',
            description: 'Retrieves all schedule entries associated with a specific version number.',
            tags: ['Schedules'],
        }
  })
  // GET /api/schedules/versions (List available versions)
  .get("/versions", async ({ query, set }) => {
      try {
          // Pass query parameters to the service function
          const versions = await getScheduleVersions(query.start_date, query.end_date);
          return versions;
      } catch (error: any) {
          console.error("Error in GET /api/schedules/versions:", error);
          set.status = 500;
          return { error: error.message || "Failed to retrieve schedule versions" };
      }
  }, {
       // Add query parameter validation
       query: t.Optional(t.Object({
            start_date: t.Optional(t.String({ format: 'date', error: "start_date must be YYYY-MM-DD." })),
            end_date: t.Optional(t.String({ format: 'date', error: "end_date must be YYYY-MM-DD." }))
       })),
       detail: { // Add Swagger details
            summary: 'List Schedule Versions',
            description: 'Retrieves a list of available schedule version metadata, optionally filtered by date range.',
            tags: ['Schedules'],
        }
  })

  // ADDED: GET /api/schedules/ (Alias for /versions) - ALSO UPDATE THIS ALIAS
  .get("/", async ({ query, set }) => { // <-- Add 'query' to destructuring
      try {
          // Pass query parameters to the service function
          const versions = await getScheduleVersions(query.start_date, query.end_date);
          return versions;
      } catch (error: any) {
          console.error("Error in GET /api/schedules/ (alias for /versions):", error);
          set.status = 500;
          return { error: error.message || "Failed to retrieve schedule versions" };
      }
  }, {
       // Add query parameter validation
       query: t.Optional(t.Object({
            start_date: t.Optional(t.String({ format: 'date', error: "start_date must be YYYY-MM-DD." })),
            end_date: t.Optional(t.String({ format: 'date', error: "end_date must be YYYY-MM-DD." }))
       })),
      detail: {
          summary: 'List Schedule Versions (Alias)',
          description: 'Alias for /versions. Retrieves a list of available schedule version identifiers, optionally filtered by date range.',
          tags: ['Schedules'],
      }
  })

  // POST /api/schedules/version (Create a new schedule version)
  .post("/version", async ({ body, set }) => {
      try {
          console.log("Received request to create new schedule version:", body);
          const result = await createNewScheduleVersion(body);
          set.status = 201; // Created
          console.log("New schedule version created:", result);
          return result;
      } catch (error: any) {
          console.error("Error in POST /api/schedules/version:", error);
          // Check for specific validation errors from service?
          if (error.message?.includes("Start date and end date are required")) {
              set.status = 400;
          } else {
              set.status = 500;
          }
          return { error: error.message || "Failed to create new schedule version." };
      }
  }, {
      body: createVersionBodySchema, // Apply validation
      detail: {
          summary: 'Create New Schedule Version',
          description: 'Creates a new, empty schedule version (or based on a base version) for the specified date range.',
          tags: ['Schedules'],
      }
  })

  // PUT /api/schedules/version/:version/status (Update version status)
  .put("/version/:version/status", async ({ params, body, set }) => {
    try {
        console.log(`Updating status for version ${params.version} to ${body.status}`);
        
        // Check if version exists
        const versionExists = await db.query(`
            SELECT version FROM schedule_version_meta WHERE version = ?
        `).get(params.version) as ScheduleEntryRow | undefined;
        
        if (!versionExists) {
            set.status = 404;
            return { error: `Schedule version ${params.version} not found.` };
        }
        
        // Update status
        await db.query(`
            UPDATE schedule_version_meta
            SET status = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
            WHERE version = ?
        `).run(body.status, params.version);
        
        // Also update all schedule entries for this version
        await db.query(`
            UPDATE schedules
            SET status = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
            WHERE version = ?
        `).run(body.status, params.version);
        
        return { 
            message: `Status updated to ${body.status}`, 
            version: params.version, 
            status: body.status 
        };
    } catch (error: any) {
        console.error(`Error updating version ${params.version} status:`, error);
        set.status = 500;
        return { error: error.message || "Failed to update version status" };
    }
  }, {
      params: versionParamSchema,
      body: updateVersionStatusSchema,
      detail: {
          summary: 'Update Schedule Version Status',
          description: 'Updates the status of a schedule version (DRAFT, PUBLISHED, ARCHIVED).',
          tags: ['Schedules'],
      }
  })
  
  // PUT /api/schedules/version/:version/notes (Update version notes)
  .put("/version/:version/notes", async ({ params, body, set }) => {
    try {
        console.log(`Updating notes for version ${params.version}`);
        
        // Check if version exists
        const versionExists = await db.query(`
            SELECT version FROM schedule_version_meta WHERE version = ?
        `).get(params.version);
        
        if (!versionExists) {
            set.status = 404;
            return { error: `Schedule version ${params.version} not found.` };
        }
        
        // Update notes
        await db.query(`
            UPDATE schedule_version_meta
            SET notes = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
            WHERE version = ?
        `).run(body.notes, params.version);
        
        return { 
            message: "Notes updated", 
            version: params.version
        };
    } catch (error: any) {
        console.error(`Error updating version ${params.version} notes:`, error);
        set.status = 500;
        return { error: error.message || "Failed to update version notes" };
    }
  }, {
      params: versionParamSchema,
      body: updateVersionNotesSchema,
      detail: {
          summary: 'Update Schedule Version Notes',
          description: 'Updates the notes field of a schedule version.',
          tags: ['Schedules'],
      }
  })
  
  // PUT /api/schedules/entry/:id (Update single schedule entry)
  .put("/entry/:id", async ({ params, body, set }) => {
    try {
        const entryId = params.id;
        console.log(`Updating schedule entry ${entryId} with:`, body);
        
        // Check if entry exists
        const entryExists = await db.query(`
            SELECT id, version FROM schedules WHERE id = ?
        `).get(entryId) as ScheduleEntryRow | undefined;
        
        if (!entryExists) {
            set.status = 404;
            return { error: `Schedule entry ${entryId} not found.` };
        }
        
        // Check if version is in DRAFT status (can only edit DRAFT schedules)
        const versionStatus = await db.query(`
            SELECT status FROM schedule_version_meta WHERE version = ?
        `).get(entryExists.version) as ScheduleVersionStatusRow | undefined;
        
        if (versionStatus && versionStatus.status !== 'DRAFT') {
            set.status = 403; // Forbidden
            return { 
                error: `Cannot edit schedule entry in ${versionStatus.status} status. Only DRAFT schedules can be modified.` 
            };
        }
        
        // Build the update SQL dynamically based on provided fields
        let updateFields = [];
        let values = [];
        
        if (body.shift_id !== undefined) {
            updateFields.push('shift_id = ?');
            values.push(body.shift_id);
        }
        
        if (body.break_start !== undefined) {
            updateFields.push('break_start = ?');
            values.push(body.break_start);
        }
        
        if (body.break_end !== undefined) {
            updateFields.push('break_end = ?');
            values.push(body.break_end);
        }
        
        if (body.notes !== undefined) {
            updateFields.push('notes = ?');
            values.push(body.notes);
        }
        
        if (body.shift_type !== undefined) {
            updateFields.push('shift_type = ?');
            values.push(body.shift_type);
        }
        
        // Always update the updated_at timestamp
        updateFields.push('updated_at = strftime(\'%Y-%m-%dT%H:%M:%fZ\', \'now\')');
        
        // Only proceed if there are fields to update
        if (updateFields.length === 0) {
            set.status = 400;
            return { error: "No valid fields to update were provided." };
        }
        
        // Build and execute the SQL
        const sql = `
            UPDATE schedules 
            SET ${updateFields.join(', ')}
            WHERE id = ?
        `;
        
        values.push(entryId);
        await db.query(sql).run(...values);
        
        // Get the updated entry
        const updatedEntry = await db.query(`
            SELECT * FROM schedules WHERE id = ?
        `).get(entryId);
        
        return { 
            message: "Schedule entry updated", 
            entry: updatedEntry 
        };
    } catch (error: any) {
        console.error(`Error updating schedule entry ${params.id}:`, error);
        set.status = 500;
        return { error: error.message || "Failed to update schedule entry" };
    }
  }, {
      params: scheduleEntryParamSchema,
      body: updateScheduleEntrySchema,
      detail: {
          summary: 'Update Schedule Entry',
          description: 'Updates a single schedule entry (shift assignment).',
          tags: ['Schedules'],
      }
  })
  
  // POST /api/schedules/duplicate/:version (Duplicate a schedule version)
  .post("/duplicate/:version", async ({ params, set }) => {
    try {
        console.log(`Duplicating schedule version ${params.version}`);
        
        // Check if source version exists
        const sourceVersion = await db.query(`
            SELECT * FROM schedule_version_meta WHERE version = ?
        `).get(params.version) as VersionMetaRow | undefined;
        
        if (!sourceVersion) {
            set.status = 404;
            return { error: `Source schedule version ${params.version} not found.` };
        }
        
        // Get the next available version number
        const maxVersion = await db.query(`
            SELECT MAX(version) as max_version FROM schedule_version_meta
        `).get() as MaxVersionRow | undefined;
        
        const newVersion = (maxVersion?.max_version || 0) + 1;
        
        // Insert new version metadata
        await db.query(`
            INSERT INTO schedule_version_meta (
                version, status, date_range_start, date_range_end, 
                base_version, notes, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        `).run(
            newVersion, 
            'DRAFT', // Always create as DRAFT
            sourceVersion.date_range_start,
            sourceVersion.date_range_end,
            sourceVersion.version, // Original version becomes the base
            `Duplicate of version ${sourceVersion.version}`
        );
        
        // Copy all schedule entries
        await db.query(`
            INSERT INTO schedules (
                employee_id, shift_id, date, version,
                break_start, break_end, notes, shift_type,
                availability_type, status, created_at, updated_at
            )
            SELECT 
                employee_id, shift_id, date, ?,
                break_start, break_end, notes, shift_type,
                availability_type, 'DRAFT', 
                strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
                strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
            FROM schedules
            WHERE version = ?
        `).run(newVersion, params.version);
        
        // Get count of duplicated entries
        const entryCount = await db.query(`
            SELECT COUNT(*) as count FROM schedules WHERE version = ?
        `).get(newVersion) as CountRow | undefined;
        
        return { 
            message: "Schedule version duplicated", 
            original_version: params.version,
            new_version: newVersion,
            entry_count: entryCount?.count || 0
        };
    } catch (error: any) {
        console.error(`Error duplicating version ${params.version}:`, error);
        set.status = 500;
        return { error: error.message || "Failed to duplicate schedule version" };
    }
  }, {
      params: versionParamSchema,
      detail: {
          summary: 'Duplicate Schedule Version',
          description: 'Creates a new schedule version by duplicating an existing one.',
          tags: ['Schedules'],
      }
  })

  // POST /api/schedules/generate
  .post("/generate", async ({ body, set }) => {
      try {
          console.log(`Generating AI-powered schedule from ${body.startDate} to ${body.endDate}...`);
          
          // Call the enhanced service function with AI integration
          const generationResult = await generateSchedule(
              body.startDate, 
              body.endDate,
              body.createEmptySchedules || false,
              body.version,
              db,
              {
                  aiConfig: body.aiConfig,
                  schedulerConfig: body.schedulerConfig
              }
          );
          
          // Return detailed results
          set.status = generationResult.status === "SUCCESS" ? 200 : 207; // 207 for partial success with warnings
          return generationResult;

      } catch (error: any) {
            console.error("Error in POST /api/schedules/generate:", error);
            set.status = 500;
            return { 
                error: error.message || "Failed to generate schedule.",
                status: "ERROR",
                logs: [{
                    timestamp: new Date().toISOString(),
                    level: "error",
                    message: error.message || "Failed to generate schedule."
                }]
            };
      }
  }, {
      body: generateScheduleBodySchema, // Apply validation
      detail: { // Add Swagger details
            summary: 'Generate AI-Powered Schedule',
            description: 'Triggers the AI-powered schedule generation process for a given date range with configurable scoring weights and scheduler settings.',
            tags: ['Schedules'],
        }
  });

// Define types for database rows
interface VersionMetaRow {
  version: number;
  status: string;
  date_range_start: string;
  date_range_end: string;
}

interface MaxVersionRow {
  max_version: number;
}

interface CountRow {
  count: number;
}

interface ScheduleEntryRow {
  id: number;
  version: number;
}

interface ScheduleVersionStatusRow {
  status: string;
}

export default scheduleRoutes; 