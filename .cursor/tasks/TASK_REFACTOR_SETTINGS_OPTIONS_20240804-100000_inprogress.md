---
task_id: TASK_REFACTOR_SETTINGS_OPTIONS_20240804-100000
description: Refactor and merge SettingsPage.tsx and OptionsPage.tsx into a single, improved settings/options management page.
status: pending
priority: high
project: Schichtplan Frontend
date_created: 2024-08-04
assignee: AI/User
---

## Task: Refactor and Merge Settings & Options Pages

**Objective:** Consolidate all settings and options currently present in `src/frontend/src/pages/SettingsPage.tsx` and `src/frontend/src/pages/OptionsPage.tsx` into a new, unified page (e.g., `src/frontend/src/pages/UnifiedSettingsPage.tsx`). The goal is to improve organization, usability, and maintainability.

### 1. Define Detailed Requirements & Design (User Input Crucial)

*   **1.1. New Page Structure:**
    *   **Proposed Name:** `UnifiedSettingsPage.tsx` (or similar).
    *   **Layout Strategy:**
        *   _(User to decide)_: Will the new page use a tabbed interface (like the current `SettingsPage`), a single long scrollable page with clear sections, or another approach (e.g., side navigation)?
        *   _(User to specify)_: If tabs/sections, please list the main categories and what settings/options from the current pages will fall under each. For example:
            *   `Tab/Section 1: General Store Setup` (Store Name, Address, Contact, Hours, Opening Days)
            *   `Tab/Section 2: Scheduling Engine` (Core rules, constraints, generation parameters, diagnostics)
            *   `Tab/Section 3: Employee & Shift Definitions` (Employee Types, Absence Types, Shift Types - consolidated from `OptionsPage` and `SettingsPage.employee_groups`)
            *   `Tab/Section 4: Availability Configuration` (Availability Types - from `OptionsPage`)
            *   `Tab/Section 5: Appearance & Display` (Theme, Colors, Calendar preferences, PDF Layout)
            *   `Tab/Section 6: Integrations & AI` (AI Tools, API Keys)
            *   `Tab/Section 7: Data Management & Actions` (Demo Data, DB Backup/Restore/Wipe)
            *   `Tab/Section ... (User to add/modify)`

*   **1.2. Content and Functionality Review:**
    *   _(User to specify)_: Go through each item in the current `SettingsPage.tsx` and `OptionsPage.tsx`. For each item/group of items:
        *   **Keep As-Is?**
        *   **Modify?** (If so, how? e.g., different UI, different grouping, changed logic)
        *   **Move to which new Tab/Section?**
        *   **Remove?**
    *   _(User to specify)_: Are there any **new** settings or options that need to be added during this refactor?
    *   **Consolidation Notes:**
        *   `Employee Types`, `Absence Types`, `Shift Types`: Currently, these exist in `OptionsPage.tsx` and `SettingsPage.tsx` touches `employee_groups` (which contains employee and absence types). Decide on a single, clear editor and location for these within the new page.
        *   `Availability Types`: Currently in `OptionsPage.tsx`. Determine its placement in the new structure.

*   **1.3. UI/UX Enhancements:**
    *   _(User to specify)_: Are there any specific UI/UX improvements desired beyond merging (e.g., better visual grouping within sections, improved input controls for certain settings, clearer descriptions)?

*   **1.4. Mockup/Wireframe (Optional but Recommended):**
    *   A simple sketch or digital wireframe of the proposed new page layout would be highly beneficial.

### 2. Implementation - Phase 1: Setup New Page and Basic Structure

*   Create the new page file (e.g., `src/frontend/src/pages/UnifiedSettingsPage.tsx`).
*   Set up basic React routing for the new page. It can coexist with old pages during development.
*   Implement the top-level layout (tabs, sections, etc.) based on decisions from Step 1.

### 3. Implementation - Phase 2: Migrate and Refactor Settings Sections

*   Iterate through each new tab/section defined in Step 1.
*   Identify corresponding components, logic, and state management from `SettingsPage.tsx` and `OptionsPage.tsx`.
*   Carefully migrate UI elements to the new page structure.
*   Adapt and consolidate state management:
    *   Review React Query calls (`getSettings`, `updateSettings`).
    *   Consolidate `useState`, `useEffect`, and event handlers.
    *   Ensure the `settings` object structure is handled consistently.
*   Refactor shared/reusable components (e.g., `EmployeeSettingsEditor`, `ShiftTypesEditor`, `PDFLayoutEditor`, `ScheduleGenerationSettings`) as needed to fit the new consolidated page and remove any redundancy.
*   Ensure save mechanisms (debounced updates, immediate saves via buttons) are correctly implemented for each part of the new page.

### 4. Implementation - Phase 3: Implement Specific Edits, Additions, Removals

*   Apply reordering of settings elements as specified in Step 1.2.
*   Add any new settings or functionalities identified in Step 1.2.
*   Remove any settings or functionalities marked for deprecation in Step 1.2.
*   Implement specific UI/UX enhancements from Step 1.3.

### 5. Testing

*   **Unit Tests:**
    *   Update `SettingsPage.test.tsx` if parts are reused, or adapt its tests for the new page.
    *   Write new unit tests for `UnifiedSettingsPage.tsx` and any new/significantly modified sub-components. Cover different states and interactions.
*   **Integration Tests (if applicable):**
    *   Verify that data fetching, display, modification, and saving work end-to-end for all settings.
*   **Manual QA:**
    *   Thoroughly test all functionalities from both original pages in the new unified page.
    *   Verify layout responsiveness across different screen sizes.
    *   Assess usability, clarity, and flow of the new design.
    *   Test error handling (e.g., failed saves, invalid inputs).
    *   Test edge cases.

### 6. Finalize and Cleanup

*   Update the main application routing to use `UnifiedSettingsPage.tsx` as the primary settings page.
*   Remove the old `src/frontend/src/pages/SettingsPage.tsx` and `src/frontend/src/pages/OptionsPage.tsx` files.
*   Remove associated test files for the old pages.
*   Clean up any dead code, unused imports, or obsolete comments.
*   Review and update any relevant project documentation that refers to settings.

### 7. Review and Merge

*   Conduct a thorough code review of all changes.
*   Address feedback and make necessary adjustments.
*   Merge the changes into the main development branch.

**Dependencies:**
*   User input for Step 1 (Detailed Requirements & Design).

**Estimated Effort:** (To be filled in after Step 1)

**Notes:**
*   This is a significant refactor. Proceed methodically, section by section.
*   Frequent commits and testing are recommended.
*   Pay close attention to the existing `Settings` type in `src/types/index.ts` and how data is structured and saved to the backend.
