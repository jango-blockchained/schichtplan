/**
 * Safely extracts an error message from various error types
 */
export const getErrorMessage = (error: any): string => {
  if (error && typeof error === "object" && "message" in error) {
    return error.message;
  }
  return "Ein unerwarteter Fehler ist aufgetreten";
};
