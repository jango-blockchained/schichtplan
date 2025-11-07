// Export the Axios instance
export { api } from "./instance";

// Export all types and functions from domain modules
export * from "./settings";
export * from "./employee";
export * from "./shift";
export * from "./absence";
export * from "./schedule";
export * from "./version";
export * from "./coverage";
export * from "./log";
export * from "./database";
export * from "./week";
export * from "./ai";
export * from "./util";

// Re-export types from the shared types file for external use
export type { Shift, Absence, Employee, Settings } from "@/types/index";

// Re-export canonical Schedule types
export type {
  Schedule,
  ScheduleResponse,
  Schedule as ApiSchedule,
} from "@/types/index";
