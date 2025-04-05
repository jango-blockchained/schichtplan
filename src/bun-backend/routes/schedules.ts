import { Elysia, t } from "elysia";
import { getScheduleByVersion, getScheduleVersions } from "../services/scheduleService";

// Validation schema for version path parameter
const versionParamSchema = t.Object({
    version: t.Numeric({ minimum: 1, error: "Version must be a positive integer." })
});

const scheduleRoutes = new Elysia({ prefix: "/api/schedules" })
  // GET /api/schedules/version/:version
  .get("/version/:version", async ({ params, set }) => {
    try {
        // Param validation handled by Elysia
        const scheduleEntries = await getScheduleByVersion(params.version);
        return scheduleEntries;
    } catch (error: any) {
        console.error(`Error in GET /api/schedules/version/${params.version}:`, error);
        if (error.message?.includes("Invalid schedule version number")) {
            set.status = 400; // Bad Request
            return { error: error.message };
        }
        set.status = 500;
        return { error: error.message || "Failed to retrieve schedule" };
    }
  }, {
      params: versionParamSchema // Apply validation
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
  });

  // --- Add other schedule routes later ---
  // GET /versions (list available versions)
  // POST /version (create new version)
  // PUT /entry/:id (update single schedule entry - might be complex)
  // POST /generate (trigger schedule generation)
  // etc.

export default scheduleRoutes; 