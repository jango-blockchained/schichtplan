import { isValid, parseISO } from "date-fns";

/**
 * Error Handling Utilities
 * 
 * This module provides defensive programming utilities for handling dates and errors
 * throughout the frontend application. These utilities prevent RangeError crashes
 * when dealing with invalid date strings from API responses or user input.
 * 
 * @module errorUtils
 */

/**
 * Safely extracts an error message from various error types
 * 
 * @param error - Any error object or value
 * @returns A human-readable error message in German
 * 
 * @example
 * try {
 *   // some operation
 * } catch (error) {
 *   toast({ title: getErrorMessage(error) });
 * }
 */
export const getErrorMessage = (error: any): string => {
  if (error && typeof error === "object" && "message" in error) {
    return error.message;
  }
  return "Ein unerwarteter Fehler ist aufgetreten";
};

/**
 * Safely parses a date from various input types
 * 
 * This function handles invalid dates gracefully by returning a fallback value
 * instead of throwing RangeError. Use this instead of `new Date()` when parsing
 * dates from API responses or user input.
 * 
 * @param dateInput - Date string, Date object, null, or undefined
 * @param fallback - Date to return if parsing fails (default: current date)
 * @returns A valid Date object
 * 
 * @example
 * // Safe parsing from API response
 * const absence = await getAbsence(id);
 * const startDate = safeParseDate(absence.start_date);
 * 
 * @example
 * // With custom fallback
 * const specificDate = safeParseDate(userInput, new Date('2024-01-01'));
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
 * 
 * Use this to validate dates before processing them. Returns false for
 * null, undefined, invalid Date objects, and unparseable strings.
 * 
 * @param date - Any value to check
 * @returns true if the value is a valid date
 * 
 * @example
 * if (isValidDate(user.birthday)) {
 *   // Safe to format or calculate with this date
 *   const formatted = format(new Date(user.birthday), "dd.MM.yyyy");
 * }
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
 * Safely executes a date operation with fallback and error logging
 * 
 * Wraps any date-related operation in a try-catch block. If the operation
 * throws or returns an invalid Date, returns the fallback value instead.
 * 
 * @param operation - Function to execute
 * @param fallback - Value to return if operation fails
 * @param errorMessage - Optional message to log on error
 * @returns Result of operation or fallback
 * 
 * @example
 * // Safe date formatting
 * const formatted = safeDateOperation(
 *   () => format(safeParseDate(absence.start_date), "dd.MM.yyyy"),
 *   "Invalid date",
 *   "Error formatting absence start date"
 * );
 * 
 * @example
 * // Safe date calculation
 * const days = safeDateOperation(
 *   () => differenceInDays(endDate, startDate) + 1,
 *   0,
 *   "Error calculating date difference"
 * );
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
