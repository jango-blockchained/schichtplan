import { isValid, parseISO } from "date-fns";

/**
 * Safely extracts an error message from various error types
 */
export const getErrorMessage = (error: any): string => {
  if (error && typeof error === "object" && "message" in error) {
    return error.message;
  }
  return "Ein unerwarteter Fehler ist aufgetreten";
};

/**
 * Safely parses a date from various input types
 * Returns a valid Date object or the fallback date (default: current date)
 */
export const safeParseDate = (
  dateInput: string | Date | null | undefined,
  fallback: Date = new Date()
): Date => {
  try {
    // Handle null or undefined
    if (dateInput == null) {
      return fallback;
    }

    // If already a Date object
    if (dateInput instanceof Date) {
      return isValid(dateInput) ? dateInput : fallback;
    }

    // If it's a string, try to parse it
    if (typeof dateInput === "string") {
      // Try ISO parsing first
      const parsed = parseISO(dateInput);
      if (isValid(parsed)) {
        return parsed;
      }

      // Try standard Date constructor
      const standardParsed = new Date(dateInput);
      if (isValid(standardParsed)) {
        return standardParsed;
      }
    }

    // If all parsing fails, return fallback
    return fallback;
  } catch (error) {
    console.error("Error parsing date:", dateInput, error);
    return fallback;
  }
};

/**
 * Checks if a date value is valid
 */
export const isValidDate = (date: any): boolean => {
  try {
    if (date == null) return false;
    if (date instanceof Date) return isValid(date);
    if (typeof date === "string") {
      const parsed = parseISO(date);
      return isValid(parsed);
    }
    return false;
  } catch {
    return false;
  }
};

/**
 * Safely formats a date with a fallback
 * Used when you need to ensure a date operation doesn't throw
 */
export const safeDateOperation = <T>(
  operation: () => T,
  fallback: T,
  errorMessage?: string
): T => {
  try {
    const result = operation();
    // Additional check for Date objects
    if (result instanceof Date && !isValid(result)) {
      if (errorMessage) {
        console.error(errorMessage, result);
      }
      return fallback;
    }
    return result;
  } catch (error) {
    if (errorMessage) {
      console.error(errorMessage, error);
    }
    return fallback;
  }
};
