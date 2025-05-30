# Project Knowledge Graph - Schichtplan Application

Last Updated: 2025-05-29

## Core Concepts:

*   **Settings Management:**
    *   **Central Model:** Most application settings are stored in a single `Settings` model/table (`src/backend/models/settings.py`).
    *   **Frontend Access:**
        *   `UnifiedSettingsPage.tsx`: Main page for most settings, divided into sections. Uses `/api/v2/settings/` (GET and PUT) for data operations.
        *   `LayoutCustomizerPage.tsx`: For PDF layout customization.
        *   `PDFSettings.tsx`: For PDF layout and preset management. Uses `/api/v2/pdf-settings/...`.
    *   **Backend APIs:**
        *   `src/backend/api/settings.py`: Handles general settings CRUD via `/api/v2/settings/`.
        *   `src/backend/api/pdf_settings.py`: Handles specific PDF layout and preset operations via `/api/v2/pdf-settings/...`.
    *   **Data Structure:** The `Settings` model uses a `to_dict()` method to create a nested JSON structure for the frontend and `update_from_dict()` to parse incoming JSON.
    *   **Key Settings Areas:** General store info, scheduling engine parameters, employee/shift/absence type definitions, availability configuration, appearance/display, PDF layout, integrations/AI, data management, notifications.
    *   **Saving Mechanisms:** Mixed approach currently. `UnifiedSettingsPage.tsx` uses debounced auto-save. PDF-related pages tend to use explicit save actions.
*   **PDF Generation:**
    *   Likely handled by `services/pdf_generator.py` (inferred from `pdf_settings.py`).
    *   Configuration for PDF output is part of the `Settings` model and editable through the frontend.

## Key Files & Modules:

*   **Frontend Settings UI:**
    *   `src/frontend/src/pages/UnifiedSettingsPage.tsx`: Hub for most settings.
    *   `src/frontend/src/pages/LayoutCustomizerPage.tsx`: Specific PDF layout UI.
    *   `src/frontend/src/pages/PDFSettings.tsx`: Specific PDF settings and presets UI.
    *   `src/frontend/src/components/EmployeeSettingsEditor.tsx`: Component for editing employee/absence types.
    *   `src/frontend/src/components/LayoutCustomizer.tsx`: Component for PDF layout adjustments.
    *   `src/frontend/src/components/UnifiedSettingsSections/*`: Various components for different sections within `UnifiedSettingsPage.tsx`.
*   **Backend Settings Logic:**
    *   `src/backend/models/settings.py`: Defines the `Settings` SQLAlchemy model.
    *   `src/backend/api/settings.py`: API routes for general settings.
    *   `src/backend/api/pdf_settings.py`: API routes for PDF-specific settings.
*   **Frontend API Service:**
    *   `src/frontend/src/services/api.ts`: Contains functions (`getSettings`, `updateSettings`) for interacting with the backend settings API.

## Current Tasks & Observations (Ref: Task 001):

*   **Task 001:** Review and refactor frontend settings pages.
    *   **Goal:** Ensure all settings save correctly, UI is consistent, and features like auto-save, constraints, and special days function as expected.
    *   **Observation:** API endpoint usage for PDF settings is inconsistent between `LayoutCustomizerPage.tsx` (incorrect) and `PDFSettings.tsx` (uses dedicated PDF API, but frontend calls might need prefixing).
    *   **Observation:** Potential overlap/conflict in how PDF layout settings are managed (via main settings API vs. dedicated PDF settings API).
    *   **Observation:** UI design and component usage are generally based on shadcn/ui, but consistency across different settings pages/sections needs verification.
    *   **Observation:** Saving mechanisms are mixed (auto-save vs. explicit). A unified strategy is desirable.

## To Investigate Further:

*   The exact implementation details of `services/pdf_generator.py`.
*   The full extent of UI component usage and consistency across all settings sections.
*   The best approach to unify PDF settings management (central API vs. dedicated API).
