# Task: Increase Frontend Unit & Component Test Coverage

**ID:** TASK_4_3_Increase_Frontend_Unit_Component_Test_Coverage
**Status:** in_progress
**Priority:** High
**Category:** Testing

**Description:**
Write unit tests for frontend hooks, utility functions, and components (using React Testing Library/Jest). Focus on testing component rendering, user interactions, and state changes.

**Implementation Plan & Progress:**

1.  **Review Existing Tests for `UnifiedSettingsPage.tsx`:**
    *   Located test file: `src/frontend/src/pages/__tests__/UnifiedSettingsPage.test.tsx`.
    *   **CRITICAL PRE-REQUISITE:** The `mockSettings` object used in this test file MUST be updated to conform to the latest unified `Settings` type from `src/frontend/src/types/index.ts`. This includes all changes made during `TASK_20250521_settings_refactor_standardization` (e.g., nullable fields, renamed notification fields, new calendar display fields, structure of `special_days`, removal of `store_contact`, addition of `store_phone`/`store_email`, etc.).
    *   Once `mockSettings` is updated, re-run existing tests to ensure they pass or identify necessary adjustments.

2.  **Write/Update Tests for Individual Settings Section Components:**
    *   Focus on components modified or reviewed during `TASK_20250521`.
    *   **Example Plan for `NotificationsSection.tsx`:**
        *   Create `src/frontend/src/components/UnifiedSettingsSections/__tests__/NotificationsSection.test.tsx`.
        *   **Test Cases:**
            *   Renders correctly when `settings` prop (display settings) is provided.
            *   Handles `settings` prop being `undefined` (shows loading/fallback).
            *   Displays switches for `email_notifications`, `schedule_published_notify`, `shift_changes_notify`, `time_off_requests_notify`.
            *   Switch `checked` state correctly reflects the values from `settings` prop (handling `null` as `false`).
            *   Toggling each switch calls the `onDisplaySettingChange` prop with the correct key (e.g., `"schedule_published_notify"`) and the new boolean value.

3.  **Write/Update Tests for `GeneralStoreSetupSection.tsx`:**
    *   Create/update tests for this component.
    *   **Test Cases:**
        *   Renders all input fields (store name, address, phone, email, opening/closing times, keyholder minutes).
        *   Correctly displays values from `settings.general` prop, handling nulls with fallbacks (e.g., `value={settings.store_name || ""}`).
        *   Calls `onInputChange` with correct key, value, and `isNumeric` flag when inputs are changed.
        *   Renders `SpecialDaysManagement` and passes `settings.general.special_days` to it.
        *   Correctly renders and handles opening day switches.

4.  **Write/Update Tests for other reviewed/modified sections:**
    *   `AppearanceDisplaySection.tsx`
    *   `SchedulingEngineSection.tsx` (and its child `ScheduleGenerationSettings.tsx` - may need careful mocking if its `onUpdate` issues persist from type checking).
    *   `AvailabilityConfigurationSection.tsx`
    *   `IntegrationsAISection.tsx`

5.  **Address `EmployeeShiftDefinitionsSection.tsx` Tests:**
    *   Defer comprehensive tests until child editor components (`EmployeeSettingsEditor`, `ShiftTypesEditor`) are refactored to align with unified `Settings` types. Basic rendering tests might be possible.

6.  **General Utility Functions & Hooks:**
    *   Identify critical utility functions (e.g., in `dateUtils.ts` if not already covered) and hooks (`useSettings.ts` already has some tests via `UnifiedSettingsPage.test.tsx` but direct hook testing might be beneficial for edge cases).
    *   Write unit tests for their logic.

**Notes:**
*   Use `@testing-library/react` for component interactions.
*   Mock API calls and child components where necessary to isolate units under test.
*   Aim for good coverage of component states, props, and user interactions.
