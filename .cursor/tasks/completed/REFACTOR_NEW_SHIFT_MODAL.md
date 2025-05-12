# Refactor New Shift Modal

The goal is to improve the user experience and data integrity of the new shift entry modal by reordering inputs, implementing cascading selections with availability checks, and ensuring the `availability_type` is correctly captured.

## I. Backend API Adjustments

*   [x] **Analyze existing API endpoints:**
    *   [x] Identify endpoints for fetching employees.
    *   [x] Identify endpoints for fetching shifts/shift templates.
    *   [x] Identify endpoints for fetching employee availability (`EmployeeAvailability` model data).
    *   [x] Identify endpoint for creating new schedule entries.
*   [x] **Design/Modify API for Employee Availability on Date:**
    *   [x] Create or modify an endpoint that, given a date, returns a list of employees with their detailed availability status for that day (e.g., "Available", "Absence: [Type]", "Shift: [Details]", "Unavailable"). (Implemented `GET /api/availability/by_date`)
    *   [x] Ensure this endpoint considers absences and existing shift assignments.
*   [x] **Design/Modify API for Shifts Available to Employee on Date:**
    *   [x] Create or modify an endpoint that, given a date and an employee ID, returns a list of applicable shift templates. (Implemented `GET /api/availability/shifts_for_employee`)
    *   [x] This endpoint must filter shifts based on the employee's general availability times for that day of the week (from `EmployeeAvailability`).
    *   [x] For each applicable shift, the endpoint should also return the employee's `availability_type` (FIXED, PREFERRED, AVAILABLE) for that specific shift on that date.
*   [x] **Update Schedule Creation Endpoint:**
    *   [x] Ensure the endpoint for creating/updating schedule entries accepts and stores the `availability_type`. (Updated `update_schedule` in `schedules.py`)
    *   [x] Verify the `schedules` table in the database has an `availability_type` column (as per user's initial finding). If not, add migration. (Column exists)

## II. Frontend Modal Implementation (`AddScheduleDialog.tsx`)

*   [x] **Project Setup & Type Definitions:**
    *   [x] Update TypeScript types (`src/frontend/src/types/index.ts`) for employee availability status, shift availability with `availability_type`, and the new schedule entry payload.
*   [x] **Reorder Inputs:**
    *   [x] Modify the modal's JSX to render inputs in the order: Date, Employee, Shift.
*   [x] **Date Input (`DatePicker` or similar):**
    *   [x] Ensure on date selection, state is updated and employee input is triggered/reset.
*   [x] **Employee Input (`ComboBox`, `Select` or similar):**
    *   [x] **State:** Added state for selected date, list of employees (with their availability status), and selected employee.
    *   [x] **Data Fetching:** Implemented a hook/function to call the new/modified backend API to fetch employees and their availability status when the date changes.
    *   [x] **Display & Logic:** Updated Select to populate with employee names & status, disable unavailable employees. On employee selection, update state and trigger shift input reset/update.
    *   [x] **Pre-selection:** Handled pre-selection based on `defaultEmployeeId` prop.
*   [x] **Shift Input (`ComboBox`, `Select` or similar):**
    *   [x] **State:** Added state for the list of available shifts (with their `availability_type`) and the selected shift.
    *   [x] **Data Fetching:** Implemented a hook/function to call the new/modified backend API to fetch available shifts and their corresponding `availability_type` for the selected employee on the selected date.
    *   [x] **Display & Logic:** Updated Select to populate with available shift names & availability type. Ensure the dropdown is disabled or shows a message if no date/employee is selected, or if no shifts are available. Set `selectedAvailabilityType` on selection.
*   [x] **Form State & Submission:**
    *   [x] Consolidate selected date, employee, shift, and the determined `availability_type` into the form's state.
    *   [x] On submit, send this data to the backend endpoint for creating schedule entries.
    *   [x] Handle success (e.g., close modal, refresh schedule view) and error responses.
*   [x] **UI/UX Enhancements:**
    *   [x] Add loading indicators for dropdowns while data is being fetched.
    *   [x] Provide clear messages if no employees/shifts are available.
    *   [x] Ensure consistent styling with Shadcn UI.

## III. Testing

*   [~] **Backend Unit Tests:** (Tests added for new endpoints in `test_api.py`, but some pre-existing linter errors remain)
    *   [~] Test new/modified API endpoints for correct data fetching and filtering logic (employee availability, shift availability, availability type).
*   [x] **Frontend Unit/Integration Tests (Jest/React Testing Library):** (Completed)
    *   [x] Test the `AddScheduleDialog` component (Basic render, presence of elements).
    *   [~] Verify correct input reordering (Covered by presence in render test, visual confirmation often used for exact order).
    *   [x] Mock API calls and test cascading logic:
        *   [x] Employee dropdown populates and disables correctly based on date.
        *   [x] Shift dropdown populates correctly based on date and employee.
        *   [x] `availability_type` is correctly inferred and stored (as part of form submission).
    *   [x] Test form submission with the correct payload.
    *   [x] Test handling of pre-selected values.
    *   [x] Test loading and error states.

## IV. Documentation (If Applicable)

*   [ ] Update any internal documentation regarding the modal's functionality or related API endpoints. 