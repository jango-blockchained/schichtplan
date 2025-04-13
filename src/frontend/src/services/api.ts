import axios, { AxiosError } from "axios";
import type {
  Settings,
  Employee,
  ScheduleError,
  ScheduleUpdate,
  DailyCoverage,
  CoverageTimeSlot,
  ShiftTemplate,
} from "@/types/index";
import { CreateEmployeeRequest, UpdateEmployeeRequest } from "../types";

interface APIErrorResponse {
  error?: string;
}

export interface Schedule {
  id: number;
  date: string;
  employee_id: number;
  shift_id: number | null;
  version: number;
  status: string;
  created_at: string;
  updated_at: string;
  break_start?: string | null;
  break_end?: string | null;
  notes?: string | null;
  is_empty?: boolean;
  shift_start?: string | null;
  shift_end?: string | null;
  availability_type?: "AVAILABLE" | "FIXED" | "PREFFERED" | "UNAVAILABLE";
  shift_type_id?: string; // EARLY, MIDDLE, LATE
  shift_type_name?: string; // early, middle, late
}

export interface ScheduleResponse {
  schedules: Schedule[];
  versions: number[];
  version_statuses?: Record<number, string>;
  current_version?: number;
  version_meta?: VersionMeta;
  errors?: ScheduleError[];
  version?: number;
  total_shifts?: number;
  filled_shifts_count?: number;
  total_schedules?: number;
  filtered_schedules?: number;
  logs?: string[];
}

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5001/api";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
  withCredentials: true,
  timeout: 30000,
  validateStatus: (status) => status >= 200 && status < 300,
});

// Add request interceptor for debugging
api.interceptors.request.use(
  (config) => {
    console.log("Making request to:", config.url);
    return config;
  },
  (error) => {
    console.error("Request error:", error);
    return Promise.reject(error);
  },
);

// Add response interceptor to handle common errors
api.interceptors.response.use(
  (response) => {
    // Log successful responses for debugging
    console.log("Response received from:", response.config?.url, {
      status: response.status,
      headers: response.headers,
      data: response.data,
    });

    // Check if response has data
    if (response.data === undefined || response.data === null) {
      console.warn("Empty response received from:", response.config?.url);
      // Return empty object for GET requests, undefined for others
      return {
        ...response,
        data: response.config?.method?.toLowerCase() === "get" ? {} : undefined,
      };
    }
    return response;
  },
  (error: AxiosError<APIErrorResponse>) => {
    // Get the most specific error message available
    const errorMessage =
      error.response?.data?.error ||
      error.message ||
      "Ein unerwarteter Fehler ist aufgetreten";

    // Log the full error details for debugging
    const errorDetails = {
      message: errorMessage,
      status: error.response?.status,
      data: error.response?.data,
      url: error.config?.url,
      method: error.config?.method,
      headers: error.response?.headers,
    };

    console.error("API Error Details:", JSON.stringify(errorDetails, null, 2));

    // Check if it's a network error (no response received)
    if (!error.response) {
      console.error(
        "Network error details:",
        JSON.stringify(
          {
            request: error.request,
            config: error.config,
          },
          null,
          2,
        ),
      );
      throw new Error(
        "Verbindung zum Server fehlgeschlagen. Bitte überprüfen Sie Ihre Internetverbindung.",
      );
    }

    // Customize error message based on status and response data
    if (error.response.status === 404) {
      throw new Error("Die angeforderten Daten wurden nicht gefunden.");
    } else if (error.response.status === 500) {
      throw new Error(errorMessage);
    } else if (error.response.status === 308) {
      throw new Error(
        "Redirect error: The API endpoint requires a trailing slash.",
      );
    } else {
      throw new Error(errorMessage);
    }
  },
);

// Settings
export const getSettings = async (): Promise<Settings> => {
  const response = await api.get("/settings/");
  return response.data;
};

export const updateSettings = async (
  settings: Partial<Settings>,
): Promise<Settings> => {
  const response = await api.put("/settings/", settings);
  return response.data;
};

export const resetSettings = async (): Promise<Settings> => {
  try {
    const response = await api.post<Settings>("/settings/reset/");
    return response.data;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to reset settings: ${error.message}`);
    }
    throw error;
  }
};

// Employees
export const getEmployees = async (): Promise<Employee[]> => {
  try {
    const response = await api.get<Employee[]>("/employees/");
    return response.data;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to fetch employees: ${error.message}`);
    }
    throw error;
  }
};

export const createEmployee = async (
  data: CreateEmployeeRequest,
): Promise<Employee> => {
  try {
    const response = await api.post<Employee>("/employees/", data);
    return response.data;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to create employee: ${error.message}`);
    }
    throw error;
  }
};

export const updateEmployee = async (
  id: number,
  data: UpdateEmployeeRequest,
): Promise<Employee> => {
  try {
    const response = await api.put<Employee>(`/employees/${id}`, data);
    return response.data;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to update employee: ${error.message}`);
    }
    throw error;
  }
};

export const deleteEmployee = async (id: number): Promise<void> => {
  try {
    await api.delete(`/employees/${id}`);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to delete employee: ${error.message}`);
    }
    throw error;
  }
};

// Shifts
export interface Shift {
  id: number;
  name?: string;
  start_time: string;
  end_time: string;
  duration_hours: number;
  requires_break: boolean;
  active_days: { [key: string]: boolean };
  created_at?: string;
  updated_at?: string;
  shift_type_id?: string;
  type?: string;
  break_duration?: number;
}

export const getShifts = async (): Promise<Shift[]> => {
  try {
    console.log('Fetching shifts from API');
    const response = await api.get<any>("/shifts/");
    console.log('Shifts response:', response.data);
    
    // Handle different response formats consistently
    if (Array.isArray(response.data)) {
      return response.data;
    } 
    
    // Handle structured response with data property
    if (response.data && typeof response.data === 'object') {
      // Case: { success: boolean, data: Shift[] }
      if ('data' in response.data && Array.isArray(response.data.data)) {
        return response.data.data;
      }
      
      // Case: { shifts: Shift[] } or similar nested property
      const potentialArrayProps = Object.keys(response.data).filter(key => 
        Array.isArray(response.data[key])
      );
      
      if (potentialArrayProps.length > 0) {
        console.log(`Found array in response at property: ${potentialArrayProps[0]}`);
        return response.data[potentialArrayProps[0]];
      }
    }
    
    // If we can't find a proper array, log and return empty
    console.error('Failed to parse shifts from response:', response.data);
    return [];
  } catch (error) {
    console.error('Error fetching shifts:', error);
    if (error instanceof Error) {
      throw new Error(`Failed to fetch shifts: ${error.message}`);
    }
    throw error;
  }
};

export const createShift = async (
  data: Omit<Shift, "id" | "duration_hours" | "created_at" | "updated_at">,
): Promise<Shift> => {
  try {
    // Create a copy of the data to avoid mutating the original
    const requestData = { ...data };
    
    // Remove shift_type property if it exists (should use shift_type_id instead)
    if ('shift_type' in requestData) {
      delete requestData.shift_type;
    }
    
    // Ensure shift_type_id is uppercase
    if (requestData.shift_type_id) {
      requestData.shift_type_id = requestData.shift_type_id.toUpperCase();
      
      // Add type field matching shift_type_id as per API documentation
      requestData.type = requestData.shift_type_id.toLowerCase();
    }
    
    // Generate a name field if not present
    if (!requestData.name) {
      requestData.name = "New Shift Template";
    }
    
    // Calculate duration in hours
    const timeToMinutes = (time: string): number => {
      const [hours, minutes] = time.split(":").map(Number);
      return hours * 60 + minutes;
    };
    
    const startMinutes = timeToMinutes(requestData.start_time);
    const endMinutes = timeToMinutes(requestData.end_time);
    
    let duration = endMinutes - startMinutes;
    if (duration < 0) duration += 24 * 60; // Handle overnight shifts
    
    const durationHours = duration / 60;
    
    // Break duration in minutes if required (optional field in API)
    if (requestData.requires_break && !requestData.break_duration) {
      if (durationHours >= 8) {
        requestData.break_duration = 60;
      } else if (durationHours >= 6) {
        requestData.break_duration = 30;
      }
    }
    
    console.log(`Creating shift with data:`, {
      ...requestData,
      duration_hours: durationHours
    });
    
    const response = await api.post<Shift>("/shifts/", {
      ...requestData,
      duration_hours: durationHours,
    });
    
    return response.data as Shift;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to create shift: ${error.message}`);
    }
    throw error;
  }
};

export const updateShift = async ({
  id,
  ...data
}: Partial<Shift> & { id: number }): Promise<Shift> => {
  try {
    console.log(`Updating shift ID ${id} with data:`, data);
    
    // Create a copy of the data to avoid mutating the original
    const requestData = { ...data };
    
    // Ensure shift_type_id is uppercase
    if (requestData.shift_type_id) {
      requestData.shift_type_id = requestData.shift_type_id.toUpperCase();
      console.log(`Normalized shift_type_id to uppercase: ${requestData.shift_type_id}`);
      
      // Add type field matching shift_type_id as per API documentation
      requestData.type = requestData.shift_type_id.toLowerCase();
    }
    
    // Generate a name field if not present
    if (!requestData.name) {
      requestData.name = `Shift ${id}`;
    }
    
    // Ensure duration_hours is included if start_time and end_time are provided
    if (requestData.start_time && requestData.end_time && requestData.duration_hours === undefined) {
      // Calculate duration if not provided
      const timeToMinutes = (time: string): number => {
        const [hours, minutes] = time.split(":").map(Number);
        return hours * 60 + minutes;
      };
    
      const startMinutes = timeToMinutes(requestData.start_time);
      const endMinutes = timeToMinutes(requestData.end_time);
      
      let duration = endMinutes - startMinutes;
      if (duration < 0) duration += 24 * 60; // Handle overnight shifts
      
      requestData.duration_hours = duration / 60;
      console.log(`Calculated duration_hours: ${requestData.duration_hours}`);
    }
    
    // Break duration in minutes if required (optional field in API)
    if (requestData.requires_break && !requestData.break_duration) {
      // Calculate break duration based on shift length
      const durationHours = requestData.duration_hours || 0;
      if (durationHours >= 8) {
        requestData.break_duration = 60;
      } else if (durationHours >= 6) {
        requestData.break_duration = 30;
      }
    }
    
    console.log(`Sending request data to API:`, requestData);
    
    const response = await api.put<{success: boolean, data: Shift} | Shift>(`/shifts/${id}/`, requestData);
    console.log(`Update response for shift ID ${id}:`, response.data);
    
    // Handle different response formats
    if (response.data && typeof response.data === 'object' && 'success' in response.data && 'data' in response.data) {
      return response.data.data;
    }
    
    return response.data as Shift;
  } catch (error) {
    console.error(`Error updating shift ID ${id}:`, error);
    if (error instanceof Error) {
      throw new Error(`Failed to update shift: ${error.message}`);
    }
    throw error;
  }
};

export const deleteShift = async (id: number): Promise<void> => {
  try {
    await api.delete(`/shifts/${id}`);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to delete shift: ${error.message}`);
    }
    throw error;
  }
};

export const createDefaultShifts = async (): Promise<{ count: number }> => {
  try {
    const response = await api.post<{ count: number }>("/shifts/defaults/");
    return response.data;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to create default shifts: ${error.message}`);
    }
    throw error;
  }
};

// Schedules
export interface ScheduleData {
  id: number;
  date: string;
  employee: {
    id: number;
    name: string;
  };
  shift: {
    id: number;
    start_time: string;
    end_time: string;
  };
  break_start: string | null;
  break_end: string | null;
  notes: string | null;
}

export const getSchedules = async (
  startDate: string,
  endDate: string,
  version?: number,
  includeEmpty: boolean = false,
): Promise<ScheduleResponse> => {
  try {
    console.log("🟩 getSchedules called with:", {
      startDate,
      endDate,
      version,
      includeEmpty,
    });

    const response = await api.get("/schedules/", {
      params: {
        start_date: startDate,
        end_date: endDate,
        version,
        include_empty: includeEmpty,
      },
    });

    console.log("🟩 getSchedules response:", response.data);
    return response.data;
  } catch (error) {
    console.error("🟩 getSchedules error:", error);
    if (error instanceof Error) {
      throw new Error(`Failed to fetch schedules: ${error.message}`);
    }
    throw error;
  }
};

export const generateSchedule = async (
  startDate: string,
  endDate: string,
  createEmptySchedules: boolean = false,
  version: number,
): Promise<ScheduleResponse> => {
  try {
    console.log("📆 Generating schedule with parameters:", {
      startDate,
      endDate,
      createEmptySchedules,
      version,
      timestamp: new Date().toISOString(),
    });

    // Validiere Eingabedaten
    if (!startDate || !endDate) {
      throw new Error("Start- und Enddatum sind erforderlich");
    }

    if (!version || isNaN(version) || version <= 0) {
      throw new Error("Eine gültige Version ist erforderlich");
    }

    // Validiere Datumsformat (sollte YYYY-MM-DD sein)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
      throw new Error("Datumsformat muss YYYY-MM-DD sein");
    }

    // Get all shifts to validate they have durations
    const shiftsResponse = await api.get<Shift[] | {success: boolean, data: Shift[]}>("/shifts/");
    
    // Ensure shifts is always an array, regardless of API response format
    let shifts: Shift[] = [];
    
    if (Array.isArray(shiftsResponse.data)) {
      shifts = shiftsResponse.data;
    } else if (shiftsResponse.data && typeof shiftsResponse.data === 'object' && 'data' in shiftsResponse.data && Array.isArray(shiftsResponse.data.data)) {
      shifts = shiftsResponse.data.data;
    } else {
      console.error("❌ Unexpected shifts response format:", shiftsResponse.data);
      throw new Error("Unerwartetes Format der Schichtdaten. Bitte aktualisieren Sie die Seite und versuchen Sie es erneut.");
    }

    if (shifts.length === 0) {
      throw new Error("Keine Schichten definiert. Bitte erstellen Sie zuerst Schichten.");
    }

    console.log(`📊 Loaded ${shifts.length} shifts from the server`);

    // Check for shifts with missing or invalid duration_hours
    const invalidShifts = shifts.filter(
      (shift) =>
        shift.duration_hours === null ||
        shift.duration_hours === undefined ||
        isNaN(shift.duration_hours) ||
        shift.duration_hours <= 0,
    );

    if (invalidShifts.length > 0) {
      console.warn(
        `⚠️ Found ${invalidShifts.length} shifts with missing or invalid duration_hours:`,
        invalidShifts.map((s) => ({
          id: s.id,
          start: s.start_time,
          end: s.end_time,
        })),
      );

      // Try to fix shifts with missing duration_hours
      if (invalidShifts.length > 0) {
        console.warn(
          "🔧 Attempting to fix shifts with missing duration_hours using dedicated endpoint",
        );

        try {
          // Use the dedicated endpoint to fix all shifts at once
          const fixResult = await fixShiftDurations();
          console.log("✅ Fixed shift durations:", fixResult);
        } catch (fixError) {
          console.error("❌ Error using fix-durations endpoint:", fixError);

          // Fall back to the old method of fixing shifts one by one
          console.warn("Falling back to fixing shifts one by one");

          // Fix each invalid shift by calculating duration_hours
          for (const shift of invalidShifts) {
            try {
              // Parse start and end times
              const [startHour, startMinute] = shift.start_time
                .split(":")
                .map(Number);
              const [endHour, endMinute] = shift.end_time
                .split(":")
                .map(Number);

              if (
                isNaN(startHour) ||
                isNaN(startMinute) ||
                isNaN(endHour) ||
                isNaN(endMinute)
              ) {
                console.error(
                  `Invalid time format for shift ${shift.id}: ${shift.start_time} - ${shift.end_time}`,
                );
                continue;
              }

              // Convert times to minutes for easier calculation
              const startMinutes = startHour * 60 + startMinute;
              const endMinutes = endHour * 60 + endMinute;

              // Handle overnight shifts
              let durationMinutes = endMinutes - startMinutes;
              if (durationMinutes < 0) {
                durationMinutes += 24 * 60; // Add 24 hours for overnight shifts
              }

              // Convert to decimal hours
              const finalDuration = durationMinutes / 60;

              console.log(
                `Calculated duration for shift ${shift.id}: ${finalDuration} hours (from ${shift.start_time} to ${shift.end_time})`,
              );

              // Update the shift with the calculated duration
              await updateShift({
                id: shift.id,
                duration_hours: finalDuration,
              });

              console.log(
                `Updated shift ${shift.id} with duration_hours = ${finalDuration}`,
              );
            } catch (calcError) {
              console.error(
                `Failed to calculate duration for shift ${shift.id}:`,
                calcError,
              );
            }
          }
        }

        // Fetch shifts again to make sure we have the updated data
        const updatedShiftsResponse = await api.get<Shift[] | {success: boolean, data: Shift[]}>("/shifts/");
        
        // Ensure we have an array again after refetching
        if (Array.isArray(updatedShiftsResponse.data)) {
          shifts = updatedShiftsResponse.data;
        } else if (updatedShiftsResponse.data && typeof updatedShiftsResponse.data === 'object' && 'data' in updatedShiftsResponse.data && Array.isArray(updatedShiftsResponse.data.data)) {
          shifts = updatedShiftsResponse.data.data;
        } else {
          console.error("❌ Unexpected format in updated shifts response:", updatedShiftsResponse.data);
          throw new Error("Unerwartetes Format der aktualisierten Schichtdaten. Bitte aktualisieren Sie die Seite und versuchen Sie es erneut.");
        }
        
        console.log(
          `📊 Reloaded ${shifts.length} shifts after fixing durations`,
        );

        // Check if we still have invalid shifts
        const remainingInvalidShifts = shifts.filter(
          (shift) =>
            shift.duration_hours === null ||
            shift.duration_hours === undefined ||
            isNaN(shift.duration_hours) ||
            shift.duration_hours <= 0,
        );

        if (remainingInvalidShifts.length > 0) {
          console.error(
            "❌ Still have invalid shifts after attempting to fix:",
            remainingInvalidShifts.map((s) => ({
              id: s.id,
              start: s.start_time,
              end: s.end_time,
              duration: s.duration_hours,
            })),
          );
          throw new Error(
            "Schichtdauer fehlt: Einige Schichten haben immer noch keine gültige Dauer. Bitte überprüfen Sie die Schichteinstellungen manuell.",
          );
        }
      }
    }

    // Now generate the schedule
    console.log("🚀 Calling backend /schedules/generate endpoint with:", {
      start_date: startDate,
      end_date: endDate,
      create_empty_schedules: createEmptySchedules,
      version: version,
    });

    // Baue Request-Daten - angepasst an das Backend-Schema (generateScheduleBodySchema)
    // Das Backend erwartet startDate und endDate, NICHT start_date und end_date
    const requestData = {
      startDate: startDate,  // camelCase wie im Backend-Schema definiert
      endDate: endDate,      // camelCase wie im Backend-Schema definiert
      create_empty_schedules: createEmptySchedules, // optional: später anpassen, falls benötigt
      version: version,      // optional: später anpassen, falls benötigt
    };

    console.log("🔄 Anfrage wird nach Backend-Schema formatiert:", requestData);

    // Überprüfe Anfrage-Format gegen Backend-Erwartungen
    console.log("Starte Verarbeitung");
    let response;
    try {
      // Verwende direkt das richtige Format entsprechend des Backend-Schemas
      response = await api.post<ScheduleResponse>("/schedules/generate", requestData);
    } catch (apiError: any) {
      if (apiError.response && apiError.response.status === 422) {
        // Wenn 422 Fehler, versuche alternative Parameterformate
        console.log("Versuche alternatives Request-Format");
        try {
          // Alternative 1: camelCase Format
          const altRequestData1 = {
            startDate: startDate,
            endDate: endDate,
            createEmptySchedules: createEmptySchedules,
            version: version,
          };
          response = await api.post<ScheduleResponse>("/schedules/generate", altRequestData1);
        } catch (altError1: any) {
          // Alternative 2: Noch ein anderes Format mit Start/End als separate Parameter
          try {
            const altRequestData2 = {
              startDate: startDate,
              endDate: endDate,
              create_empty: createEmptySchedules,
              versionId: version,
            };
            response = await api.post<ScheduleResponse>("/schedules/generate", altRequestData2);
          } catch (altError2: any) {
            // Wenn alle Alternativen fehlschlagen, werfe den ursprünglichen Fehler
            // Bessere Fehlerbehandlung für API-Fehler
            console.error("❌ Schedule generation API error:", apiError);
            
            if (apiError.response) {
              // Der Server hat mit einem Fehlercode geantwortet
              const status = apiError.response.status;
              const responseData = apiError.response.data;
              
              console.error(`❌ API error ${status}:`, responseData);
              
              if (status === 422) {
                // Unprocessable Entity - Validierungsfehler
                const errorMessage = responseData.error || responseData.message || 
                  (responseData.detail ? (Array.isArray(responseData.detail) ? 
                    responseData.detail.map((d: any) => `${d.loc.join('.')}: ${d.msg}`).join(', ') : 
                    responseData.detail) : 
                    "Validierungsfehler bei der Schichtplan-Generierung");
                
                console.error("❌ Validation error details:", errorMessage);
                
                // API Dokumentation prüfen und korrektes Format ausgeben
                console.error("❌ Expected API format:", {
                  "Laut Dokumentation": "/api/schedules/generate erwartet: start_date, end_date, create_empty_schedules, version",
                  "Tatsächliche Anfrage": requestData,
                  "API Fehlermeldung": errorMessage
                });
                
                // Versuche, benutzerfreundliche Fehlermeldung zu erstellen
                if (typeof errorMessage === 'string') {
                  if (errorMessage.includes("start_date") || errorMessage.includes("startDate")) {
                    throw new Error("Start-Datum fehlt oder ist ungültig. Format sollte YYYY-MM-DD sein.");
                  } else if (errorMessage.includes("end_date") || errorMessage.includes("endDate")) {
                    throw new Error("End-Datum fehlt oder ist ungültig. Format sollte YYYY-MM-DD sein.");
                  } else if (errorMessage.includes("shift")) {
                    throw new Error("Schichtprobleme: " + errorMessage);
                  } else if (errorMessage.includes("employee")) {
                    throw new Error("Mitarbeiterprobleme: " + errorMessage);
                  } else if (errorMessage.includes("version")) {
                    throw new Error("Versionsprobleme: " + errorMessage);
                  } else {
                    throw new Error("Fehler bei der API-Anfrage: " + errorMessage);
                  }
                } else {
                  throw new Error("Fehler bei der API-Anfrage: Validierungsproblem mit den gesendeten Daten.");
                }
              } else if (status === 404) {
                throw new Error("Die angeforderte Ressource wurde nicht gefunden. Eventuell existiert die Version nicht.");
              } else if (status === 400) {
                throw new Error("Ungültige Anfrage: " + (responseData.error || responseData.message || "Bitte überprüfen Sie die eingegebenen Daten."));
              } else {
                throw new Error(`Fehler bei der API-Anfrage (${status}): ` + (responseData.error || responseData.message || "Unbekannter Fehler"));
              }
            }
            
            // Wenn kein Response-Objekt vorhanden ist, handelt es sich um einen Netzwerkfehler
            throw new Error("Netzwerkfehler bei der Schichtplan-Generierung. Bitte überprüfen Sie Ihre Internetverbindung.");
          }
        }
      } else {
        // Für andere Fehlertypen als 422
        if (apiError.response) {
          // Der Server hat mit einem Fehlercode geantwortet
          const status = apiError.response.status;
          const responseData = apiError.response.data;
          
          console.error(`❌ API error ${status}:`, responseData);
          
          if (status === 404) {
            throw new Error("Die angeforderte Ressource wurde nicht gefunden. Eventuell existiert die Version nicht.");
          } else if (status === 400) {
            throw new Error("Ungültige Anfrage: " + (responseData.error || responseData.message || "Bitte überprüfen Sie die eingegebenen Daten."));
          } else {
            throw new Error(`Fehler bei der API-Anfrage (${status}): ` + (responseData.error || responseData.message || "Unbekannter Fehler"));
          }
        } else {
          // Wenn kein Response-Objekt vorhanden ist, handelt es sich um einen Netzwerkfehler
          throw new Error("Netzwerkfehler bei der Schichtplan-Generierung. Bitte überprüfen Sie Ihre Internetverbindung.");
        }
      }
    }

    // Log generation success details
    console.log("✅ Schedule generation successful:", {
      "Total schedules": response.data.schedules?.length || 0,
      "With shift_id":
        response.data.schedules?.filter((s) => s.shift_id !== null).length || 0,
      "Empty schedules":
        response.data.schedules?.filter((s) => s.shift_id === null).length || 0,
      "With shift_type":
        response.data.schedules?.filter((s) => s.availability_type).length || 0,
      "Unique employee count": new Set(
        response.data.schedules?.map((s) => s.employee_id),
      ).size,
      "Error count": response.data.errors?.length || 0,
    });

    if (response.data.errors && response.data.errors.length > 0) {
      console.warn(
        "⚠️ Schedule generation completed with errors:",
        response.data.errors,
      );
    }

    return response.data;
  } catch (error) {
    console.error("❌ Schedule generation error:", error);

    if (error instanceof Error) {
      throw new Error(`Failed to generate schedule: ${error.message}`);
    }
    throw error;
  }
};

export const exportSchedule = async (
  startDate: string,
  endDate: string,
  layoutConfig?: any,
): Promise<Blob> => {
  try {
    const response = await api.post(
      "/schedules/export",
      {
        start_date: startDate,
        end_date: endDate,
        layout_config: layoutConfig,
      },
      {
        responseType: "blob",
      },
    );
    return response.data;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to export schedule: ${error.message}`);
    }
    throw error;
  }
};

export const updateBreakNotes = async (
  employeeId: number,
  date: string,
  notes: string,
): Promise<ScheduleData> => {
  try {
    const response = await api.put<{ message: string; schedule: ScheduleData }>(
      "/schedules/update-break-notes/",
      {
        employee_id: employeeId,
        date,
        notes,
      },
    );
    return response.data.schedule;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to update break notes: ${error.message}`);
    }
    throw error;
  }
};

export const updateShiftDay = async (
  employeeId: number,
  fromDate: string,
  toDate: string,
): Promise<void> => {
  try {
    await api.put("/schedules/update-day/", {
      employee_id: employeeId,
      from_date: fromDate,
      to_date: toDate,
    });
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to update shift: ${error.message}`);
    }
    throw error;
  }
};

export interface TimeSlot {
  day: number;
  start: string;
  end: string;
}

export interface Availability {
  id?: number;
  employee_id: number;
  start_date: string;
  end_date: string;
  start_time?: string;
  end_time?: string;
  availability_type: "AVAILABLE" | "FIXED" | "PREFFERED" | "UNAVAILABLE";
  reason?: string;
  is_recurring: boolean;
  recurrence_day?: number;
}

export interface AvailabilityCheck {
  is_available: boolean;
  reason?: string;
}

// Availability endpoints
export interface EmployeeAvailability {
  id?: number;
  employee_id: number;
  day_of_week: number;
  hour: number;
  is_available: boolean;
  availability_type: string;
  created_at?: string;
  updated_at?: string;
}

export const getEmployeeAvailabilities = async (
  employeeId: number,
): Promise<EmployeeAvailability[]> => {
  const response = await api.get<EmployeeAvailability[]>(
    `/employees/${employeeId}/availability/`,
  );
  return response.data;
};

export const createAvailability = async (
  availability: Omit<Availability, "id">,
): Promise<Availability> => {
  const response = await api.post<Availability>("/availability", availability);
  return response.data;
};

export const updateAvailability = async (
  id: number,
  availability: Partial<Availability>,
): Promise<Availability> => {
  const response = await api.put<Availability>(
    `/availability/${id}`,
    availability,
  );
  return response.data;
};

export const deleteAvailability = async (id: number): Promise<void> => {
  await api.delete(`/availability/${id}`);
};

export const checkAvailability = async (
  employeeId: number,
  date: string,
  startTime?: string,
  endTime?: string,
): Promise<AvailabilityCheck> => {
  const response = await api.post<AvailabilityCheck>("/availability/check", {
    employee_id: employeeId,
    date,
    start_time: startTime,
    end_time: endTime,
  });
  return response.data;
};

export const updateEmployeeAvailability = async (
  employeeId: number,
  availabilities: Omit<
    EmployeeAvailability,
    "id" | "created_at" | "updated_at"
  >[],
) => {
  const response = await api.put(
    `/employees/${employeeId}/availabilities`,
    availabilities,
  );
  return response.data;
};

export const updateSchedule = async (
  scheduleId: number,
  update: ScheduleUpdate,
): Promise<Schedule> => {
  try {
    console.log("🟩 updateSchedule API call:", {
      scheduleId,
      update,
      shift_id_type:
        update.shift_id === null
          ? "null"
          : update.shift_id === undefined
            ? "undefined"
            : typeof update.shift_id,
    });

    // Use the new /schedules/update/ endpoint with POST method
    const url = `/schedules/update/${scheduleId}`;
    console.log("🔴 Making API request to:", API_BASE_URL + url);

    const response = await api.post<Schedule>(url, update);
    console.log("🔴 updateSchedule API response:", response.data);

    return response.data;
  } catch (error) {
    console.error("🔴 updateSchedule API error:", error);
    // Log more details about the error
    if (error && typeof error === "object" && "response" in error) {
      console.error("🔴 API error details:", {
        status: (error as any).response?.status,
        statusText: (error as any).response?.statusText,
        data: (error as any).response?.data,
      });
    }

    if (error instanceof Error) {
      throw new Error(`Failed to update schedule: ${error.message}`);
    }
    throw error;
  }
};

// Coverage
export const getAllCoverage = async (): Promise<DailyCoverage[]> => {
  try {
    const response = await api.get<DailyCoverage[]>("/coverage/");
    return response.data;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to fetch coverage: ${error.message}`);
    }
    throw error;
  }
};

export const getCoverageByDay = async (
  dayIndex: number,
): Promise<DailyCoverage> => {
  try {
    const response = await api.get<DailyCoverage>(`/coverage/${dayIndex}`);
    return response.data;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(
        `Failed to fetch coverage for day ${dayIndex}: ${error.message}`,
      );
    }
    throw error;
  }
};

export const updateCoverage = async (
  coverage: DailyCoverage[],
): Promise<void> => {
  try {
    // Transform the nested structure into a flat array as expected by the backend
    const flatCoverageSlots = coverage.flatMap((day) => // Use flatMap
      day.timeSlots.map((slot) => ({ // Map each slot
        day_index: day.dayIndex, // Add the dayIndex to each slot object
        start_time: slot.startTime,
        end_time: slot.endTime,
        min_employees: slot.minEmployees,
        max_employees: slot.maxEmployees,
        employee_types: (slot as CoverageTimeSlot).employeeTypes || [], // Retain existing fields
        requires_keyholder: (slot as CoverageTimeSlot).requiresKeyholder ?? false,
        keyholder_before_minutes: (slot as CoverageTimeSlot).keyholderBeforeMinutes,
        keyholder_after_minutes: (slot as CoverageTimeSlot).keyholderAfterMinutes,
        // Remove the id field as it's not on the frontend type and not needed for bulk update
        // id: (slot as CoverageTimeSlot).id,
      })),
    );

    console.log("Sending flattened coverage data:", flatCoverageSlots);
    // Send the flattened array to the bulk endpoint
    const response = await api.post("/coverage/bulk", flatCoverageSlots);
    console.log("Coverage update response:", response.data);
  } catch (error) {
    console.error("Error updating coverage:", error);
    if (error instanceof Error) {
      throw new Error(`Failed to update coverage: ${error.message}`);
    }
    throw error;
  }
};

// Demo Data
export const generateDemoData = async (
  module: string,
): Promise<void | Settings> => {
  try {
    const response = await api.post("/demo-data/", { module });

    // If generating settings data, update the settings in the store
    if (module === "settings" || module === "all") {
      const settings = await getSettings();
      return settings;
    }

    return;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to generate demo data: ${error.message}`);
    }
    throw error;
  }
};

// Generate optimized demo data with more diverse shift patterns
export const generateOptimizedDemoData = async (): Promise<void | Settings> => {
  // Uncommenting: Backend endpoint /api/demo-data/optimized/ should now exist (placeholder)
  // console.warn("generateOptimizedDemoData called, but the backend endpoint is not implemented.");
  
  try {
    // The backend endpoint exists now, but is a placeholder.
    // The response won't have task_id yet unless the placeholder is updated.
    const response = await api.post("/demo-data/optimized/");

    // Keep the polling logic commented out for now, as the placeholder doesn't return task_id
    /*
    if (response.data && response.data.task_id) {
      // Task started successfully, begin polling
      const taskId = response.data.task_id;

      // Get settings to initialize UI
      let settings = await getSettings();

      // Set up polling interval (every 2 seconds)
      const pollingInterval = setInterval(async () => {
        try {
          // Check task status
          const statusResponse = await api.get(
            `/demo-data/optimized/status/${taskId}`,
          );

          // Refresh settings to update UI
          settings = await getSettings();

          // If task is completed or failed, stop polling
          if (
            statusResponse.data.status === "completed" ||
            statusResponse.data.status === "failed"
          ) {
            clearInterval(pollingInterval);
          }
        } catch (error) {
          // Error checking status, stop polling
          clearInterval(pollingInterval);
          console.error("Error checking task status:", error);
        }
      }, 2000);

      // Return initial settings
      return settings;
    }
    */

    // Since the backend is just a placeholder, immediately fetch current settings
    // This mimics the original fallback behavior if no task_id was returned.
    console.log("Optimized demo data generation requested (placeholder). Fetching current settings as fallback.");
    const settings = await getSettings();
    return settings;
    
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(
        `Failed to generate optimized demo data: ${error.message}`,
      );
    }
    throw error;
  }
  
  // Removed fallback return undefined;
};

// Reset optimized demo data generation status
export const resetOptimizedDemoDataStatus = async (): Promise<void> => {
  try {
    await api.post("/demo-data/optimized/reset");
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to reset demo data status: ${error.message}`);
    }
    throw error;
  }
};

// Store Config
export interface StoreConfig {
  settings: Settings;
  version: string;
}

export const getStoreConfig = async (): Promise<StoreConfig> => {
  try {
    const response = await api.get<StoreConfig>("/store/config");
    return response.data;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to fetch store config: ${error.message}`);
    }
    throw error;
  }
};

export const updateStoreConfig = async (
  config: Partial<StoreConfig>,
): Promise<StoreConfig> => {
  try {
    const response = await api.put<StoreConfig>("/store/config", config);
    return response.data;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to update store config: ${error.message}`);
    }
    throw error;
  }
};

export async function resetStoreConfig(): Promise<void> {
  try {
    const response = await fetch(`${API_BASE_URL}/store/config/reset`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to reset store config: ${response.statusText}`);
    }
  } catch (error) {
    console.error("Error resetting store config:", error);
    throw error;
  }
}

// Absences
export interface Absence {
  id: number;
  employee_id: number;
  absence_type_id: string;
  start_date: string;
  end_date: string;
  note?: string;
}

export const getAbsences = async (employeeId: number): Promise<Absence[]> => {
  try {
    const response = await api.get<Absence[]>(
      `/employees/${employeeId}/absences`,
    );
    return response.data;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to fetch absences: ${error.message}`);
    }
    throw error;
  }
};

export const createAbsence = async (
  data: Omit<Absence, "id">,
): Promise<Absence> => {
  try {
    const response = await api.post<Absence>(
      `/employees/${data.employee_id}/absences`,
      data,
    );
    return response.data;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to create absence: ${error.message}`);
    }
    throw error;
  }
};

export const deleteAbsence = async (
  id: number,
  employeeId: number,
): Promise<void> => {
  try {
    await api.delete(`/employees/${employeeId}/absences/${id}`);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to delete absence: ${error.message}`);
    }
    throw error;
  }
};

// Database backup and restore
export const backupDatabase = async (): Promise<Blob> => {
  try {
    const response = await api.get("/settings/backup/", {
      responseType: "blob",
    });
    return response.data;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to backup database: ${error.message}`);
    }
    throw error;
  }
};

export const restoreDatabase = async (file: File): Promise<void> => {
  try {
    const formData = new FormData();
    formData.append("file", file);
    await api.post("/settings/restore/", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to restore database: ${error.message}`);
    }
    throw error;
  }
};

export const clearLogs = async (): Promise<void> => {
  try {
    await api.post("/api/logs/clear");
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to clear logs: ${error.message}`);
    }
    throw error;
  }
};

export const wipeTables = async (tables: string[]): Promise<void> => {
  try {
    await api.post("/settings/wipe-tables", { tables });
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to wipe tables: ${error.message}`);
    }
    throw error;
  }
};

// Logs
export interface LogFile {
  name: string;
  path: string;
  size: number;
  modified: string;
  preview: string;
}

export interface LogContent {
  name: string;
  content: string;
  size: number;
  modified: string;
}

export const getLogs = async (): Promise<LogFile[]> => {
  try {
    const response = await api.get<{ logs: LogFile[] }>("/api/logs/", {
      params: {
        type: "all",
        days: 7,
      },
    });
    return response.data.logs;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to fetch logs: ${error.message}`);
    }
    throw error;
  }
};

export const getLogContent = async (filename: string): Promise<LogContent> => {
  try {
    const response = await api.get<LogContent>(`/api/logs/${filename}`);
    return response.data;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to fetch log content: ${error.message}`);
    }
    throw error;
  }
};

export const deleteLog = async (filename: string): Promise<void> => {
  try {
    await api.delete(`/api/logs/${filename}`);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to delete log: ${error.message}`);
    }
    throw error;
  }
};

export const publishSchedule = async (version: number) => {
  try {
    // We'll use the updateVersionStatus endpoint instead
    const response = await updateVersionStatus(version, {
      status: "PUBLISHED",
    });
    return response;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to publish schedule: ${error.message}`);
    }
    throw error;
  }
};

export const archiveSchedule = async (version: number) => {
  try {
    // We'll use the updateVersionStatus endpoint instead
    const response = await updateVersionStatus(version, { status: "ARCHIVED" });
    return response;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to archive schedule: ${error.message}`);
    }
    throw error;
  }
};

// Version Management
export interface VersionMeta {
  version: number;
  created_at: string;
  created_by: number | null;
  updated_at: string | null;
  updated_by: number | null;
  status: string;
  date_range: {
    start: string;
    end: string;
  };
  base_version: number | null;
  notes: string | null;
}

export interface VersionResponse {
  versions: VersionMeta[];
}

export const getAllVersions = async (
  startDate?: string,
  endDate?: string,
): Promise<VersionResponse> => {
  try {
    const params: Record<string, string> = {};
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;

    console.log("🔍 Fetching versions with params:", params);
    
    const response = await api.get<any>("/schedules/versions", {
      params,
    });
    
    console.log("📋 Raw versions response:", response.data);
    
    // Reshape response data to expected format
    let formattedVersions: VersionMeta[] = [];
    
    // Handle different response formats
    if (Array.isArray(response.data)) {
      console.log("📋 Response is an array, transforming to expected format");
      
      formattedVersions = response.data.map(version => {
        // Check if version already has the expected structure
        if (version.date_range && typeof version.date_range === 'object' && 'start' in version.date_range) {
          return version;
        }
        
        // Transform from flat structure to nested date_range
        return {
          ...version,
          date_range: {
            start: version.date_range_start || version.date_range?.start,
            end: version.date_range_end || version.date_range?.end
          }
        };
      });
      
      return { versions: formattedVersions };
    }
    
    // If we already have the correct structure
    if ('versions' in response.data && Array.isArray(response.data.versions)) {
      console.log(`📋 Response has versions array, transforming elements if needed`);
      
      formattedVersions = response.data.versions.map(version => {
        // Check if version already has the expected structure
        if (version.date_range && typeof version.date_range === 'object' && 'start' in version.date_range) {
          return version;
        }
        
        // Transform from flat structure to nested date_range
        return {
          ...version,
          date_range: {
            start: version.date_range_start || version.date_range?.start,
            end: version.date_range_end || version.date_range?.end
          }
        };
      });
      
      return { versions: formattedVersions };
    }
    
    // If empty or invalid response
    console.warn("⚠️ Invalid versions response format:", response.data);
    return { versions: [] };
  } catch (error) {
    console.error("❌ Error fetching versions:", error);
    
    // Log more details about the error
    if (error && typeof error === "object" && "response" in error) {
      console.error("❌ API error details:", {
        status: (error as any).response?.status,
        statusText: (error as any).response?.statusText,
        data: (error as any).response?.data,
      });
    }
    
    if (error instanceof Error) {
      throw new Error(`Failed to fetch versions: ${error.message}`);
    }
    throw error;
  }
};

export interface CreateVersionRequest {
  start_date: string;
  end_date: string;
  base_version?: number;
  notes?: string;
}

export interface CreateVersionResponse {
  message: string;
  version: number;
  status: string;
  version_meta: VersionMeta;
}

export const createNewVersion = async (
  data: CreateVersionRequest,
): Promise<CreateVersionResponse> => {
  try {
    console.log("🔵 Creating new version with data:", data);
    console.log("🔵 API base URL:", API_BASE_URL);
    const response = await api.post<CreateVersionResponse>(
      "/schedules/version",
      data,
    );
    console.log("🔵 Create new version response:", response.data);
    
    // Validate response data before returning
    if (!response.data || typeof response.data.version !== 'number') {
      console.error("🔴 Invalid response from create version API:", response.data);
      throw new Error("Server returned an invalid response: Missing or invalid version number");
    }
    
    return response.data;
  } catch (error) {
    console.error("🔴 Create new version error:", error);
    // Log more details about the error
    if (error && typeof error === "object" && "response" in error) {
      console.error("🔴 API error details:", {
        status: (error as any).response?.status,
        statusText: (error as any).response?.statusText,
        data: (error as any).response?.data,
      });
    }
    if (error instanceof Error) {
      throw new Error(`Failed to create new version: ${error.message}`);
    }
    throw error;
  }
};

export interface UpdateVersionStatusRequest {
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
}

export interface UpdateVersionStatusResponse {
  message: string;
  version: number;
  status: string;
}

export const updateVersionStatus = async (
  version: number,
  data: UpdateVersionStatusRequest,
): Promise<UpdateVersionStatusResponse> => {
  try {
    const response = await api.put<UpdateVersionStatusResponse>(
      `/schedules/version/${version}/status`,
      data,
    );
    return response.data;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to update version status: ${error.message}`);
    }
    throw error;
  }
};

// Add new version control functions below:

export interface DuplicateVersionRequest {
  start_date: string;
  end_date: string;
  source_version: number;
  notes?: string;
}

export interface DuplicateVersionResponse {
  message: string;
  version: number;
  status: string;
  version_meta?: any;
}

export const duplicateVersion = async (
  data: DuplicateVersionRequest,
): Promise<DuplicateVersionResponse> => {
  try {
    const response = await api.post<DuplicateVersionResponse>(
      "/schedules/version/duplicate",
      data,
    );
    return response.data;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to duplicate version: ${error.message}`);
    }
    throw error;
  }
};

export interface VersionDetailsResponse {
  version: number;
  status: string;
  created_at: string;
  updated_at?: string;
  date_range: {
    start: string;
    end: string;
  };
  base_version?: number;
  notes?: string;
  schedule_count: number;
  employees_count: number;
  days_count: number;
}

export const getVersionDetails = async (
  version: number,
): Promise<VersionDetailsResponse> => {
  try {
    const response = await api.get<VersionDetailsResponse>(
      `/schedules/version/${version}/details`,
    );
    return response.data;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to get version details: ${error.message}`);
    }
    throw error;
  }
};

export interface CompareVersionsResponse {
  base_version: number;
  compare_version: number;
  differences: {
    added: number;
    removed: number;
    changed: number;
    unchanged: number;
    details: Array<{
      employee_id: number;
      date: string;
      base_shift_id?: number;
      compare_shift_id?: number;
      type: "added" | "removed" | "changed" | "unchanged";
    }>;
  };
}

export const compareVersions = async (
  baseVersion: number,
  compareVersion: number,
): Promise<CompareVersionsResponse> => {
  try {
    const response = await api.get<CompareVersionsResponse>(
      `/schedules/versions/compare?base_version=${baseVersion}&compare_version=${compareVersion}`,
    );
    return response.data;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to compare versions: ${error.message}`);
    }
    throw error;
  }
};

export interface UpdateVersionNotesRequest {
  notes: string;
}

export interface UpdateVersionNotesResponse {
  version: number;
  notes: string;
  message: string;
}

export const updateVersionNotes = async (
  version: number,
  data: UpdateVersionNotesRequest,
): Promise<UpdateVersionNotesResponse> => {
  try {
    const response = await api.put<UpdateVersionNotesResponse>(
      `/schedules/version/${version}/notes`,
      data,
    );
    return response.data;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to update version notes: ${error.message}`);
    }
    throw error;
  }
};

export const fixShiftDurations = async (): Promise<{
  message: string;
  fixed_count: number;
}> => {
  try {
    const response = await api.post<{ message: string; fixed_count: number }>(
      "/shifts/fix-durations",
    );
    return response.data;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to fix shift durations: ${error.message}`);
    }
    throw error;
  }
};

export interface DeleteVersionResponse {
  message: string;
  deleted_schedules_count: number;
}

export const deleteVersion = async (
  version: number,
): Promise<DeleteVersionResponse> => {
  try {
    const response = await api.delete<DeleteVersionResponse>(
      `/schedules/version/${version}`,
    );
    return response.data;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to delete version: ${error.message}`);
    }
    throw error;
  }
};

export interface CreateScheduleRequest {
  employee_id: number;
  date: string;
  shift_id: number;
  version: number;
  break_start?: string;
  break_end?: string;
  notes?: string;
  availability_type?: "AVAILABLE" | "FIXED" | "PREFFERED" | "UNAVAILABLE";
}

export const createSchedule = async (
  data: CreateScheduleRequest,
): Promise<Schedule> => {
  try {
    console.log("Creating new schedule with data:", data);
    const response = await api.post<Schedule>("/schedules/", data);
    console.log("Schedule created successfully:", response.data);
    return response.data;
  } catch (error) {
    console.error("Failed to create schedule:", error);
    if (error instanceof Error) {
      throw new Error(`Failed to create schedule: ${error.message}`);
    }
    throw error;
  }
};

// Add this new function
export const addEmployeeAvailability = async (
  employeeId: number,
  availability: Omit<EmployeeAvailability, "id" | "created_at" | "updated_at" | "employee_id"> & { employee_id?: number },
): Promise<EmployeeAvailability> => {
  const payload = { ...availability, employee_id: employeeId };
  const response = await api.post<EmployeeAvailability>(
    `/employees/${employeeId}/availability/`, // Use trailing slash as per backend route
    payload,
  );
  return response.data;
};

// Shift Templates
export const getShiftTemplates = async (): Promise<Shift[]> => {
  return getShifts();
};

export const createShiftTemplate = async (
  data: Omit<Shift, "id" | "duration_hours" | "created_at" | "updated_at">
): Promise<Shift> => {
  return createShift(data);
};

export const updateShiftTemplate = async ({
  id,
  ...data
}: Partial<Shift> & { id: number }): Promise<Shift> => {
  return updateShift({ id, ...data });
};

export const deleteShiftTemplate = async (id: number): Promise<void> => {
  return deleteShift(id);
};
