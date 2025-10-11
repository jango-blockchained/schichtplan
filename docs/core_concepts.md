# Core Concepts and Terminology

This document outlines the core concepts and terminology used within the Schichtplan project.

## Key Entities

*   **Schedule:** A collection of assignments for employees to shifts over a defined period. Schedules can have different versions.
*   **Shift:** A block of time that needs to be covered by one or more employees. Shifts are defined by `ShiftTemplate`s.
    *   **Shift Template:** Defines the properties of a shift, such as start time, end time, active days, and any special requirements (e.g., keyholder).
*   **Version:** A specific iteration of a schedule. This allows for creating and comparing different schedule possibilities before publishing a final one.
*   **Availability:** Defines when an employee is able to work.
    *   **Availability Type:** Specifies the nature of an employee's availability (e.g., `AVAILABLE`, `FIXED`, `PREFERRED`, `UNAVAILABLE`).
*   **Coverage:** Defines the staffing requirements for specific time intervals.
    *   **Coverage Requirement:** Specifies the minimum number of employees, and potentially specific employee types or skills (like keyholder), needed for a given time slot on a particular day. The backend interprets this as a need for *each granular interval* (e.g., every 15 or 60 minutes) within the defined time block.
    *   **Overlap Handling:** If multiple Coverage records overlap, the system typically takes the maximum `min_employees` and combines other requirements (e.g., employee types, keyholder status).

## Scheduling Process

The system generates schedules by:

1.  **Loading Resources:** Gathering data on employees, shift templates, coverage requirements, and availability.
2.  **Determining Needs:** Calculating the required staffing for each time interval based on `Coverage` definitions.
3.  **Assigning Shifts:** Matching available employees to shifts to fulfill the coverage needs, while respecting various constraints (employee contracts, availability, preferences, working hour limits, rest periods, etc.).
4.  **Validation:** Checking the generated schedule against all defined rules and constraints.

## Other Important Terms

*   **Employee Types/Groups:** Categories of employees (e.g., "TL" - Team Lead, "VZ" - Full-time, "TZ" - Part-time, "GFB" - Mini-job). These can be used in coverage requirements.
*   **Keyholder:** An employee who has keys to the store and can open or close. Coverage requirements can specify if a keyholder is needed.
*   **Store Opening/Closing Times:** Defines the regular operational hours of the store.
*   **Keyholder Before/After Minutes:** Specifies how long a keyholder needs to be present before the store opens and after it closes.
*   **Min/Max Employees per Shift:** While `Coverage` defines interval-based needs, `ShiftTemplate`s might also have their own min/max employee settings, though the interval-based coverage is the primary driver for staffing levels.

This document provides a high-level overview. More detailed information can be found in the respective code modules and task descriptions.
