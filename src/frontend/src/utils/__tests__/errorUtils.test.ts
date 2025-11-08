import { safeParseDate, isValidDate, safeDateOperation, getErrorMessage } from "../errorUtils";

describe("errorUtils", () => {
  describe("getErrorMessage", () => {
    it("should extract message from Error object", () => {
      const error = new Error("Test error");
      expect(getErrorMessage(error)).toBe("Test error");
    });

    it("should return default message for non-error objects", () => {
      expect(getErrorMessage(null)).toBe("Ein unerwarteter Fehler ist aufgetreten");
      expect(getErrorMessage(undefined)).toBe("Ein unerwarteter Fehler ist aufgetreten");
      expect(getErrorMessage("string")).toBe("Ein unerwarteter Fehler ist aufgetreten");
    });
  });

  describe("safeParseDate", () => {
    it("should parse valid ISO date string", () => {
      const result = safeParseDate("2024-01-15");
      expect(result).toBeInstanceOf(Date);
      expect(result.getFullYear()).toBe(2024);
      expect(result.getMonth()).toBe(0); // January is 0
      expect(result.getDate()).toBe(15);
    });

    it("should parse valid Date object", () => {
      const date = new Date("2024-01-15");
      const result = safeParseDate(date);
      expect(result).toBeInstanceOf(Date);
      expect(result.getTime()).toBe(date.getTime());
    });

    it("should return fallback for null", () => {
      const fallback = new Date("2024-01-01");
      const result = safeParseDate(null, fallback);
      expect(result.getTime()).toBe(fallback.getTime());
    });

    it("should return fallback for undefined", () => {
      const fallback = new Date("2024-01-01");
      const result = safeParseDate(undefined, fallback);
      expect(result.getTime()).toBe(fallback.getTime());
    });

    it("should return fallback for invalid date string", () => {
      const fallback = new Date("2024-01-01");
      const result = safeParseDate("invalid-date", fallback);
      expect(result.getTime()).toBe(fallback.getTime());
    });

    it("should return fallback for invalid Date object", () => {
      const fallback = new Date("2024-01-01");
      const invalidDate = new Date("invalid");
      const result = safeParseDate(invalidDate, fallback);
      expect(result.getTime()).toBe(fallback.getTime());
    });

    it("should use current date as default fallback", () => {
      const before = Date.now();
      const result = safeParseDate("invalid-date");
      const after = Date.now();
      
      expect(result.getTime()).toBeGreaterThanOrEqual(before);
      expect(result.getTime()).toBeLessThanOrEqual(after);
    });
  });

  describe("isValidDate", () => {
    it("should return true for valid Date object", () => {
      expect(isValidDate(new Date("2024-01-15"))).toBe(true);
    });

    it("should return true for valid date string", () => {
      expect(isValidDate("2024-01-15")).toBe(true);
    });

    it("should return false for null", () => {
      expect(isValidDate(null)).toBe(false);
    });

    it("should return false for undefined", () => {
      expect(isValidDate(undefined)).toBe(false);
    });

    it("should return false for invalid date string", () => {
      expect(isValidDate("invalid-date")).toBe(false);
    });

    it("should return false for invalid Date object", () => {
      expect(isValidDate(new Date("invalid"))).toBe(false);
    });

    it("should return false for non-date types", () => {
      expect(isValidDate(123)).toBe(false);
      expect(isValidDate({})).toBe(false);
      expect(isValidDate([])).toBe(false);
    });
  });

  describe("safeDateOperation", () => {
    it("should return result of successful operation", () => {
      const result = safeDateOperation(
        () => "success",
        "fallback"
      );
      expect(result).toBe("success");
    });

    it("should return fallback when operation throws", () => {
      const result = safeDateOperation(
        () => {
          throw new Error("Test error");
        },
        "fallback"
      );
      expect(result).toBe("fallback");
    });

    it("should return fallback for invalid Date result", () => {
      const result = safeDateOperation(
        () => new Date("invalid"),
        new Date("2024-01-01")
      );
      expect(result).toBeInstanceOf(Date);
      expect(result.getFullYear()).toBe(2024);
    });

    it("should log error message when provided", () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      
      safeDateOperation(
        () => {
          throw new Error("Test error");
        },
        "fallback",
        "Custom error message"
      );
      
      expect(consoleSpy).toHaveBeenCalledWith(
        "Custom error message",
        expect.any(Error)
      );
      
      consoleSpy.mockRestore();
    });

    it("should work with date-fns format operations", () => {
      const result = safeDateOperation(
        () => {
          const date = new Date("2024-01-15");
          return date.toISOString().split("T")[0];
        },
        "fallback"
      );
      expect(result).toBe("2024-01-15");
    });
  });
});
