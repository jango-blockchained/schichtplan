import { Elysia, t } from "elysia";
import { getScheduleByVersion, getScheduleVersions, generateSchedule } from "../services/scheduleService.js";
import { NotFoundError } from "elysia";

// Validation schema for version path parameter
const versionParamSchema = t.Object({
    version: t.Numeric({ minimum: 1, error: "Version must be a positive integer." })
});

// Validation schema for the generate endpoint body
const generateScheduleBodySchema = t.Object({
    startDate: t.String({ format: 'date', error: "startDate is required (YYYY-MM-DD)." }),
    endDate: t.String({ format: 'date', error: "endDate is required (YYYY-MM-DD)." }),
    // Add any other parameters needed for generation (e.g., specific constraints, version name?)
    // versionName: t.Optional(t.String({minLength: 1})),
    // options: t.Optional(t.Object({...}))
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
  .get("/versions", async ({ set }) => {
      try {
          const versions = await getScheduleVersions();
          return versions;
      } catch (error: any) {
          console.error("Error in GET /api/schedules/versions:", error);
          set.status = 500;
          return { error: error.message || "Failed to retrieve schedule versions" };
      }
  }, {
       detail: { // Add Swagger details
            summary: 'List Schedule Versions',
            description: 'Retrieves a list of available schedule version identifiers.',
            tags: ['Schedules'],
        }
  })

  // ADDED: GET /api/schedules/ (Alias for /versions)
  .get("/", async ({ set }) => {
      try {
          const versions = await getScheduleVersions();
          return versions;
      } catch (error: any) {
          console.error("Error in GET /api/schedules/ (alias for /versions):", error);
          set.status = 500;
          return { error: error.message || "Failed to retrieve schedule versions" };
      }
  }, {
      detail: { 
          summary: 'List Schedule Versions (Alias)',
          description: 'Alias for /versions. Retrieves a list of available schedule version identifiers.',
          tags: ['Schedules'],
      }
  })

  // POST /api/schedules/generate
  .post("/generate", async ({ body, set }) => {
      try {
          // Body is validated by Elysia
          console.log(`Generating schedule from ${body.startDate} to ${body.endDate}...`);
          // Call the service function to perform generation
          const generationResult = await generateSchedule(body.startDate, body.endDate /*, pass other options */);
          
          // Determine response based on result (e.g., new version ID, success message, list of entries?)
          set.status = 200; // Or 201 if a new version resource is created
          return { message: "Schedule generation initiated successfully.", result: generationResult }; // Placeholder result

      } catch (error: any) {
            console.error("Error in POST /api/schedules/generate:", error);
            // Add specific error handling for generation failures (e.g., constraints not met)
            set.status = 500; // Internal Server Error or maybe 400/409 depending on error
            return { error: error.message || "Failed to generate schedule." };
      }
  }, {
      body: generateScheduleBodySchema, // Apply validation
      detail: { // Add Swagger details
            summary: 'Generate Schedule',
            description: 'Triggers the schedule generation process for a given date range.',
            tags: ['Schedules'],
        }
  });

  // --- Add other schedule routes later ---
  // GET /versions (list available versions)
  // POST /version (create new version)
  // PUT /entry/:id (update single schedule entry - might be complex)
  // POST /generate (trigger schedule generation)
  // etc.

export default scheduleRoutes; 