---
id: TASK_20240727_100000
description: Optimize settings pages, fix data persistence, and standardize UI/UX.
status: pending
priority: high
projectContext: Schichtplan
labels: [settings, UI, UX, backend, frontend, bugfix, enhancement]

---

# Task: Optimize Settings Pages

**Goal:** Refactor and standardize the settings pages (and subpages) to resolve UI/UX inconsistencies, fix data persistence issues for several fields, and establish a unified approach to settings management.

## Phase 1: Analysis & Investigation

**Objective:** Thoroughly understand the current state, identify all issues, and gather necessary information for planning.

*   **Subtask 1.1: Identify Settings Pages & Components**
    *   Action: List all frontend routes, pages, and components related to application settings.
    *   File(s): `src/frontend/src/pages/`, `src/frontend/src/components/` (look for files related to settings).
    *   Output: Document listing all relevant settings UI parts.
    *   **Identified Potential Settings Pages & Components (Initial List):**
        *   **Pages (`src/frontend/src/pages/`):**
            *   `LayoutCustomizerPage.tsx`
            *   `PDFSettings.tsx`
            *   `UnifiedSettingsPage.tsx` (Likely central)
        *   **Components (`src/frontend/src/components/`):**
            *   `EmployeeSettingsEditor.tsx`
            *   `LayoutCustomizer.tsx`
            *   `PDFLayoutEditor.tsx`
            *   `ScheduleGenerationSettings.tsx`
            *   `ShiftTypesEditor.tsx`
            *   `TableStyleEditor.tsx`
            *   Directory: `UnifiedSettingsSections/` (Requires further inspection of its contents)
        *   **Contents of `UnifiedSettingsSections/`:**
            *   `AppearanceDisplaySection.tsx`
            *   `AvailabilityConfigurationSection.tsx`
            *   `DataManagementSection.tsx`
            *   `EmployeeShiftDefinitionsSection.tsx`
            *   `GeneralStoreSetupSection.tsx`
            *   `IntegrationsAISection.tsx`
            *   `NotificationsSection.tsx`
            *   `SchedulingEngineSection.tsx`
            *   `SpecialDaysManagement.tsx`
*   **Subtask 1.2: Document UI/UX Inconsistencies**
    *   Action: Review all identified settings pages and document variations in:
        *   Save mechanisms (auto-save vs. manual submit buttons per container/page).
        *   Input field styles and usage (e.g., "store opening and closing time has two inputs each").
        *   Layout and information architecture.
    *   Output: A report detailing inconsistencies with screenshots or descriptions.
    *   **Initial Findings for UnifiedSettingsPage.tsx:**
        *   Employs an auto-save mechanism via `debouncedUpdate` (2-second delay) for most settings changes.
        *   An `handleImmediateUpdate` function exists, passed to some child components, allowing for instant saves.
    *   **Findings for GeneralStoreSetupSection.tsx (child of UnifiedSettingsPage):**
        *   **Save Inconsistency:** Uses a mixed approach. Text inputs call `onImmediateUpdate` (prop from parent) on `onBlur` (auto-save on field exit). Additionally, explicit "Save Store Information" and "Save Hours & Opening Days" buttons exist within `CardFooter`s, also calling `onImmediateUpdate`. This differs from the parent's general debounced auto-save.
        *   **Opening/Closing Times:** Uses a `<TimePicker>` component for `store_opening` and `store_closing`. Each `TimePicker` appears as a single logical input in this component. The user comment about "two inputs each" needs clarification – it might refer to the internal structure of `TimePicker` or a misunderstanding.
        *   **Special Days:** Handled by `SpecialDaysManagement.tsx`, which also uses `onImmediateUpdate`.
    *   **Findings for SchedulingEngineSection.tsx (child of UnifiedSettingsPage):**
        *   **Save Inconsistency:** Similar mixed approach. Numeric inputs save on `onBlur` via `onImmediateUpdate`. Switches like `auto_schedule_preferences` use parent's debounced save. An explicit "Save Scheduling Rules" button calls `onImmediateUpdate`. The child `ScheduleGenerationSettings` component also triggers `onImmediateUpdate` on its changes.
        *   **Enable Diagnostics:** A `<Switch>` for `enable_diagnostics` exists. It uses `onDiagnosticsChange`. In the parent (`UnifiedSettingsPage.tsx`), `handleDiagnosticsChange` currently relies on the debounced auto-save. This could be a reason for perceived save issues if changes are not persisted before navigation or if an immediate save is expected.
        *   **Constraints:** Many direct input fields map to constraint values (e.g., `min_break_duration`). The `ScheduleGenerationSettings` component likely handles the numerous boolean toggles under `generation_requirements` (e.g., `enforce_minimum_coverage`). Issues with "all constraints" not saving could stem from these `generation_requirements` not persisting correctly, possibly due to how `ScheduleGenerationSettings` updates them or how they are handled by the parent's save logic.
    *   **Findings for SpecialDaysManagement.tsx (child of GeneralStoreSetupSection):**
        *   **Save Inconsistency:** Primarily uses immediate saves. CRUD operations (add, edit, delete, import special days) call `onUpdate` (to parent) and then `onImmediateUpdate` (direct save). It also has an explicit "Save Special Days Configuration" button. This is another variation in save behavior.
        *   **Special Opening Days Data (`SpecialDay` type):** The data structure (`date`, `description`, `is_closed`, optional `custom_hours`) seems suitable. If data isn't saving, the issue is likely in how the parent `UnifiedSettingsPage` handles updates to `general.special_days` or in the backend processing of this nested object.
    *   **Analysis of Settings Data Structure and API Call:**
        *   The `Settings` type (`src/frontend/src/types/index.ts`) is deeply nested (e.g., `general.special_days`, `scheduling.enable_diagnostics`, `scheduling.generation_requirements`).
        *   `UnifiedSettingsPage.tsx` correctly updates its `localSettings` state, maintaining the nested structure.
        *   The `api.updateSettings` function (`src/frontend/src/services/api.ts`) sends the *entire current `localSettings` object* (full `Settings` structure) to the backend PUT `/api/settings/` endpoint.
    *   **Hypothesis for Data Saving Issues (Subtask 1.3):**
        *   **Backend Model (`src/backend/models/settings.py`):**
            *   `enable_diagnostics`: Exists as a `Boolean` column.
            *   `special_days`: Stored as `_special_days` (`JSON` column) with a property setter. Appears correct.
            *   `generation_requirements` (constraints): Exists as a `JSON` column under `scheduling`. Appears correct.
            *   The model's `update_from_dict` method has logic to update these, including merging for `generation_requirements`.
        *   **Revised Hypothesis:** Since the model fields exist, saving issues for these specific nested/JSON fields likely stem from:
            *   **Pydantic Validation Schema Mismatch (Strongest Hypothesis):** The `CompleteSettings` Pydantic schema used in the `PUT /api/settings/` route (`src/backend/routes/settings.py`, imported from `src/backend/schemas/settings.py`) might not accurately define or be missing definitions for the nested structures of `general.special_days`, `scheduling.enable_diagnostics`, or `scheduling.generation_requirements`. If the schema strips or misinterprets these fields during validation (`validated_data = settings_schema.dict()`), then `Settings.update_from_dict()` would receive incomplete data for these parts, leading to them not being saved correctly, even if the model itself and its `update_from_dict` method are correct.
            *   The interaction between the API route handler and `Settings.update_from_dict()` – if the Pydantic schema is correct, then perhaps there's an issue in how `validated_data` is passed or how `update_from_dict` handles it, though this is less likely if the schema aligns with the model method's expectations.
            *   A subtle issue within `Settings.update_from_dict` or the `special_days` property setter when processing the incoming (potentially Pydantic-validated) data structure.
            *   Less likely: Alembic migrations issues or slight divergence between frontend `Settings` type and backend model expectations if not caught by Pydantic.
*   **Subtask 1.3: Investigate Data Persistence Issues**
    *   Action: For each reported field (enable diagnostics, special opening days, all constraints, store opening/closing times), trace the data flow from frontend to backend to database.
    *   File(s):
        *   Frontend: Relevant component files in `src/frontend/src/components/` and `src/frontend/src/pages/`, API call services in `src/frontend/src/api/` or `src/frontend/src/services/`.
        *   Backend: API route handlers in `src/backend/routes/`, service logic in `src/backend/services/`, SQLAlchemy models in `src/backend/models/`.
    *   Confirm which specific constraints are affected.
    *   Clarify the "two inputs each" issue for store opening/closing times and determine if it's a data model or UI problem.
    *   Output: Detailed findings on why each field is not saving correctly, including missing DB fields, model attributes, or API handling errors.
*   **Subtask 1.4: Map Frontend Fields to Backend**
    *   Action: Create a mapping table for all settings fields: Frontend Component/Field -> Backend API Endpoint -> Service Logic -> SQLAlchemy Model.Attribute -> DB Table.Column.
    *   Output: Mapping document highlighting gaps or mismatches.

## Phase 2: Standardization & Design

**Objective:** Define a clear, consistent approach for settings UI/UX and plan necessary backend changes.

**Subtask 2.1: Define UI/UX Strategy for Settings**
    *   Action: Based on Phase 1 findings and user preference for "auto-save":
        *   **Standard Save Mechanism:** Implement a consistent, global auto-save mechanism for all settings fields. A debounced save (e.g., 1-2 seconds after last change) triggered on field value change should be the primary method. This aligns with the `UnifiedSettingsPage.tsx` parent model.
        *   **Eliminate/Reduce Explicit Save Buttons:** Remove individual per-section or per-card explicit "Save" buttons where auto-save is implemented. Consider retaining a single, global "Save All Settings" button only if there are highly critical settings or complex modal interactions where an explicit final confirmation is beneficial. If kept, it should call the same `onImmediateUpdate` or a similar robust save function.
        *   **Input Field for Store Opening/Closing Times:** The current `<TimePicker>` component used in `GeneralStoreSetupSection.tsx` appears to be a single logical input. The user's concern about "two inputs each" needs clarification. If the `<TimePicker>` component itself is problematic internally (e.g., poor UX, difficult to use), investigate replacing it with simpler, standard text inputs with HH:MM format validation, or explore alternative Shadcn time picker components if available and more user-friendly. Default to standardizing on the existing `<TimePicker>` if it's functionally sound and the "two inputs" is a misunderstanding.
        *   **User Feedback for Auto-Save:** Provide clear visual feedback for auto-save actions (e.g., a subtle "Saving..." then "Saved" indicator, or a toast notification for successful save, and clear error messages via toast for failures).
    *   Output: Updated UI/UX guidelines document for settings pages, to be added to this task file.

**Subtask 2.2: Design Database Schema Modifications**
    *   Action: Based on Phase 1, the backend model `models/settings.py` appears to have the necessary columns. No direct database schema changes (Alembic migrations) are anticipated *at this stage*. This subtask is on hold. If correcting the Pydantic schemas (Subtask 2.3) reveals that some frontend fields still lack a corresponding model attribute, this subtask will be revisited.
    *   Output: (Currently on hold) A list of new fields, type changes, or new tables needed.

**Subtask 2.3: Plan API Endpoint Modifications (Focus on Pydantic Schemas)**
    *   Action: The primary backend change is to correct and complete the Pydantic schemas in `src/backend/schemas/settings.py` to align with the frontend `Settings` type and the backend `models.settings.Settings` structure. This involves:
        *   **Define Missing Pydantic Sub-Models:** For each top-level key in the frontend `Settings` type that is missing from `CompleteSettings` Pydantic model (e.g., `scheduling`, `display`, `pdf_layout`, `employee_groups`, `availability_types`, `actions`, `ai_scheduling`), create a new Pydantic `BaseModel` class in `schemas/settings.py`. These models must accurately reflect the structure and types of their corresponding fields in the frontend `Settings` type.
            *   Example: Create `SchedulingSettingsSchema(BaseModel)` containing `enable_diagnostics: Optional[bool]` and `generation_requirements: Optional[GenerationRequirements] = None` (using the existing `GenerationRequirements` schema).
        *   **Update `CompleteSettings` Pydantic Model:** Add attributes for these new Pydantic sub-models to the `CompleteSettings` class. For example: `scheduling: Optional[SchedulingSettingsSchema] = None`.
        *   **Align `generation_requirements`:** Ensure that the `generation_requirements` field is consistently handled. The frontend sends it under `scheduling.generation_requirements`. The Pydantic schema `AdvancedSettings` has a `generation_requirements` field. The backend model also has a top-level `generation_requirements` field directly on the `Settings` model, and also `scheduling_advanced` as a JSON blob. This needs to be unified. Recommendation: The main `generation_requirements` should live under a `scheduling` Pydantic model to match the frontend and the model's `to_dict`/`update_from_dict` structure. The `scheduling_advanced` field in Pydantic and the model can be kept for genuinely advanced/separate settings if any exist, or deprecated if redundant.
        *   **Verify All Fields:** Systematically compare the frontend `Settings` type, the backend `models.settings.Settings.to_dict()` output, and the (to be updated) Pydantic `CompleteSettings` schema to ensure all fields, types, and nesting levels match.
    *   File(s): `src/backend/schemas/settings.py`.
    *   Output: A detailed plan for modifying Pydantic schemas, to be added to this task file. The `PUT /api/settings/` route logic in `src/backend/routes/settings.py` itself should not require changes if the Pydantic schema is corrected comprehensively, as it already uses `settings.update_from_dict(validated_data)`.
    *   **STATUS: COMPLETED.** Pydantic schemas in `src/backend/schemas/settings.py` have been extensively refactored and updated as per the detailed plan below.
    *   **Detailed Pydantic Schema Modification Plan (`src/backend/schemas/settings.py`):**

        1.  **`GenerationRequirements(BaseModel)` (Existing):**
            *   Verify all `Optional[bool]` fields align with frontend `Settings.scheduling.generation_requirements` and `models.Settings.generation_requirements` default structure.

        2.  **`SpecialDayCustomHours(BaseModel)` (Existing):** Appears correct.
        3.  **`SpecialDay(BaseModel)` (Existing):** Appears correct.

        4.  **`GeneralSettings(BaseModel)` (Existing):**
            *   Ensure it includes all fields from `models.Settings` that are grouped under "general" in `Settings.to_dict()` and match `frontend Settings.general`.
            *   Key fields: `store_name`, `store_address`, `store_contact` (note: frontend has `store_phone`, `store_email` which `GeneralSettings` schema is missing), `timezone`, `language`, `date_format`, `time_format`, `store_opening`, `store_closing`, `keyholder_before_minutes`, `keyholder_after_minutes`, `opening_days` (Dict[str, bool]), `special_days` (Dict[str, SpecialDay]).
            *   Align field names (e.g., `store_phone` vs `store_contact`).

        5.  **NEW: `SchedulingSettingsSchema(BaseModel)`:**
            *   `scheduling_resource_type: Optional[str]` (e.g., Literal[\"shifts\", \"coverage\"])
            *   `default_shift_duration: Optional[float]`
            *   `min_break_duration: Optional[int]`
            *   `max_daily_hours: Optional[float]`
            *   `max_weekly_hours: Optional[float]`
            *   `min_rest_between_shifts: Optional[float]`
            *   `scheduling_period_weeks: Optional[int]`
            *   `auto_schedule_preferences: Optional[bool]`
            *   `enable_diagnostics: Optional[bool]` (This is a key missing field)
            *   `generation_requirements: Optional[GenerationRequirements]` (Reuse existing schema; ensure this is the primary place for these constraints).

        6.  **NEW: `DisplaySettingsDarkThemeSchema(BaseModel)**:**
            *   `primary_color: Optional[str]`
            *   `secondary_color: Optional[str]`
            *   `accent_color: Optional[str]`
            *   `background_color: Optional[str]`
            *   `surface_color: Optional[str]`
            *   `text_color: Optional[str]`

        7.  **NEW: `DisplaySettingsSchema(BaseModel)**:**
            *   `theme: Optional[str]`
            *   `primary_color: Optional[str]`
            *   `secondary_color: Optional[str]`
            *   `accent_color: Optional[str]`
            *   `background_color: Optional[str]`
            *   `surface_color: Optional[str]`
            *   `text_color: Optional[str]`
            *   `dark_theme: Optional[DisplaySettingsDarkThemeSchema]`
            *   `show_sunday: Optional[bool]`
            *   `show_weekdays: Optional[bool]`
            *   `start_of_week: Optional[int]`
            *   `email_notifications: Optional[bool]`
            *   `schedule_published: Optional[bool]` (Frontend: `schedule_published`, Model: `schedule_published_notify` - Align)
            *   `shift_changes: Optional[bool]` (Frontend: `shift_changes`, Model: `shift_changes_notify` - Align)
            *   `time_off_requests: Optional[bool]` (Frontend: `time_off_requests`, Model: `time_off_requests_notify` - Align)

        8.  **NEW: `PDFMarginsSchema(BaseModel)**:**
            *   `top: Optional[float]`
            *   `right: Optional[float]`
            *   `bottom: Optional[float]`
            *   `left: Optional[float]`

        9.  **NEW: `PDFTableStyleSchema(BaseModel)**:**
            *   `header_bg_color: Optional[str]`
            *   `border_color: Optional[str]`
            *   `text_color: Optional[str]`
            *   `header_text_color: Optional[str]`

        10. **NEW: `PDFFontsSchema(BaseModel)**:**
            *   `family: Optional[str]`
            *   `size: Optional[float]`
            *   `header_size: Optional[float]`

        11. **NEW: `PDFContentSchema(BaseModel)**:**
            *   `show_employee_id: Optional[bool]`
            *   `show_position: Optional[bool]`
            *   `show_breaks: Optional[bool]`
            *   `show_total_hours: Optional[bool]`

        12. **NEW: `PDFLayoutSettingsSchema(BaseModel)**:**
            *   `page_size: Optional[str]`
            *   `orientation: Optional[str]`
            *   `margins: Optional[PDFMarginsSchema]`
            *   `table_style: Optional[PDFTableStyleSchema]`
            *   `fonts: Optional[PDFFontsSchema]`
            *   `content: Optional[PDFContentSchema]`

        13. **NEW: `EmployeeTypeSchema(BaseModel)**:**
            *   `id: str`
            *   `name: str`
            *   `abbr: Optional[str] = None`
            *   `min_hours: float`
            *   `max_hours: float`
            *   `type: str` # Literal[\"employee\"]

        14. **NEW: `ShiftTypeSchemaPydantic(BaseModel)**:** (Avoid name clash if `ShiftType` is enum/type elsewhere)
            *   `id: str`
            *   `name: str`
            *   `color: str`
            *   `type: str` # Literal[\"shift\"]

        15. **NEW: `AbsenceTypeSchema(BaseModel)**:**
            *   `id: str`
            *   `name: str`
            *   `color: str`
            *   `type: str` # Literal[\"absence\"]

        16. **NEW: `EmployeeGroupsSettingsSchema(BaseModel)**:**
            *   `employee_types: Optional[List[EmployeeTypeSchema]] = None`
            *   `shift_types: Optional[List[ShiftTypeSchemaPydantic]] = None`
            *   `absence_types: Optional[List[AbsenceTypeSchema]] = None`

        17. **NEW: `AvailabilityTypeDetailSchema(BaseModel)**:**
            *   `id: str`
            *   `name: str`
            *   `description: str`
            *   `color: str`
            *   `priority: int`
            *   `is_available: bool`

        18. **NEW: `AvailabilityTypesSettingsSchema(BaseModel)**:**
            *   `types: Optional[List[AvailabilityTypeDetailSchema]] = None`

        19. **NEW: `DemoDataSettingsSchema(BaseModel)**:**
            *   `selected_module: Optional[str] = None`
            *   `last_execution: Optional[str] = None` # Or datetime

        20. **NEW: `ActionsSettingsSchema(BaseModel)**:**
            *   `demo_data: Optional[DemoDataSettingsSchema] = None`

        21. **NEW: `AISchedulingSettingsSchema(BaseModel)**:**
            *   `enabled: Optional[bool] = None`
            *   `api_key: Optional[str] = None`

        22. **Update `CompleteSettings(BaseModel)**:**
            *   `general: Optional[GeneralSettings]` (Existing - verify and align content with frontend type `Settings.general` and model's `to_dict().general`)
            *   **REMOVE `store_hours: Optional[StoreHoursSettings]`** if its content is fully covered by `general` (e.g. `general.store_opening`, `general.opening_days`). The model `Settings.py` has `store_opening`/`closing`/`opening_days` fields directly, which `to_dict()` puts into its `general` key. Frontend also has this under `general`. Consolidate here.
            *   **ADD: `scheduling: Optional[SchedulingSettingsSchema] = None`**
            *   `scheduling_advanced: Optional[AdvancedSettings]` (Existing - Review if `AdvancedSettings.generation_requirements` is still needed or if `SchedulingSettingsSchema.generation_requirements` becomes the sole source. Simplify/remove `AdvancedSettings` if its other fields like `scheduling_algorithm` are not actually used/sent by frontend under this key).
            *   **ADD: `display: Optional[DisplaySettingsSchema] = None`**
            *   **ADD: `pdf_layout: Optional[PDFLayoutSettingsSchema] = None`**
            *   **ADD: `employee_groups: Optional[EmployeeGroupsSettingsSchema] = None`**
            *   **ADD: `availability_types: Optional[AvailabilityTypesSettingsSchema] = None`**
            *   **ADD: `actions: Optional[ActionsSettingsSchema] = None`**
            *   **ADD: `ai_scheduling: Optional[AISchedulingSettingsSchema] = None`**
            *   **REMOVE `custom_settings: Optional[Dict[str, Any]]`** once all settings are explicitly modeled.

        **Alignment Notes:**
        *   Carefully align field names and structures between frontend `Settings` type (`src/frontend/src/types/index.ts`), these Pydantic schemas, and how `models.Settings.update_from_dict()` processes them.
        *   Pay attention to where `generation_requirements` is sourced from the frontend and ensure it maps to a single, unambiguous place in the Pydantic schema (preferably under the new `SchedulingSettingsSchema`).
        *   The `StoreHoursSettings` schema seems redundant if `GeneralSettings` handles all store opening/closing and day settings. The frontend `Settings` type has `store_opening`/`closing` at the root AND within `general`. The backend model has them at the root but its `to_dict` puts them into `general`. It's best to make the Pydantic `CompleteSettings.general` the source of truth for these, matching the `to_dict()` and ensuring `update_from_dict()` also expects them there.

*   **Subtask 2.1: Define UI/UX Strategy for Settings**
    *   Action: Based on findings and best practices (auto-save recommended by user), establish a standard for:
        *   Save mechanisms (e.g., auto-save as default, specific conditions for manual save buttons).
        *   Placement and appearance of manual save buttons (if any).
        *   Consistent input field components (e.g., a single, clear component for time inputs).
        *   Error handling and user feedback.
    *   Output: UI/UX guidelines document for settings pages.
*   **Subtask 2.2: Design Database Schema Modifications**
    *   Action: Based on Subtask 1.3, list all required additions or modifications to the database schema.
    *   File(s): `src/backend/models/` (for identifying where changes are needed).
    *   Output: A list of new fields, type changes, or new tables needed.
*   **Subtask 2.3: Plan API Endpoint Modifications**
    *   Action: Determine changes needed for backend API endpoints to support the new fields and UI strategy.
    *   File(s): `src/backend/routes/`.
    *   Output: Specification for API changes.

## Phase 3: Backend Implementation

**Objective:** Implement the necessary backend changes to support the redesigned settings.

*   **Subtask 3.1: Update SQLAlchemy Models**
    *   Action: Add missing fields/attributes to the relevant SQLAlchemy models.
    *   File(s): `src/backend/models/*.py`.
    *   Output: Updated model files.
    *   **STATUS: COMPLETED.** Initial updates to `src/backend/models/settings.py` made to align with new Pydantic schemas. `to_dict()` and `update_from_dict()` are assumed to be fully aligned with the `CompleteSettings` Pydantic schema structure based on previous refactoring notes and successful API endpoint updates (Subtask 3.3).
        *   Removed `store_contact` column.
        *   Added `store_phone` and `store_email` columns.
        *   Removed `scheduling_advanced` column.
        *   Added `scheduling_algorithm` and `max_generation_attempts` columns.
        *   Refactored `to_dict()` and `update_from_dict()` to align with Pydantic structures, including mapping for `opening_days` keys.
*   **Subtask 3.2: Create and Apply Database Migrations**
    *   Action: Generate Alembic migration scripts for the schema changes. Apply migrations to the database.
    *   Tool: Alembic.
    *   File(s): `src/backend/migrations/versions/` (Note: Actual path seems to be `src/instance/migrations/versions/`).
    *   Output: New migration script(s); updated database schema.
    *   **STATUS: COMPLETED.** Migration script `src/instance/migrations/versions/57b7b9078143_update_settings_model_for_pydantic_.py` generated and applied.
*   **Subtask 3.3: Update API Endpoints**
    *   Action: Refactor API endpoints to use the new Pydantic schemas. Ensure `GET /settings/` and `PUT /settings/` align with `CompleteSettings`. Update individual category endpoints (e.g., `GET/PUT /settings/<category>`) to use their specific Pydantic models or handle them appropriately if deprecated.
    *   File(s): `src/backend/routes/settings.py`.
    *   Output: Updated API route handlers.
    *   **STATUS: COMPLETED.**
        *   Corrected local imports within `update_category_settings`.
        *   Refactored `GET /settings/scheduling/generation` to directly use `settings_obj.generation_requirements` and default values.
        *   Refactored `PUT /settings/scheduling/generation` to directly update `settings_obj.generation_requirements`.
        *   Updated main imports in `src/backend/routes/settings.py` to include all new specific Pydantic schemas.
        *   Refactored the validation block in `update_category_settings` to use the new specific Pydantic schemas and handle deprecated categories.
        *   `GET /settings/` and `PUT /settings/` are confirmed to be compatible with `CompleteSettings` and the updated model methods without further changes to their direct logic.

## Phase 4: Frontend Implementation

**Objective:** Refactor frontend settings pages to align with the new UI/UX strategy and backend changes.

*   **Subtask 4.1: Standardize Save Mechanisms**
    *   Action: Implement a consistent, global auto-save for all settings. Remove explicit "Save" buttons where auto-save is implemented. Add clear visual feedback for auto-save.
    *   File(s):
        *   `src/frontend/src/pages/UnifiedSettingsPage.tsx`
        *   `src/frontend/src/components/UnifiedSettingsSections/GeneralStoreSetupSection.tsx`
        *   `src/frontend/src/components/UnifiedSettingsSections/SchedulingEngineSection.tsx`
    *   Output: Updated frontend files with standardized save logic.
    *   **STATUS: COMPLETED.**
        *   Added a "Saving..." indicator with a spinner to `UnifiedSettingsPage.tsx` header, visible when `mutation.isLoading` is true.
        *   Refined the `useQuery` in `UnifiedSettingsPage.tsx` to perform a more robust deep merge of fetched settings with `DEFAULT_SETTINGS` to ensure `localSettings` state is always fully populated.
        *   Removed explicit "Save Store Information" and "Save Hours & Opening Days" buttons from `GeneralStoreSetupSection.tsx`.
        *   Removed `onBlur={onImmediateUpdate}` handlers from `Input` components in `GeneralStoreSetupSection.tsx`, relying on `onChange` for debounced auto-save via parent.
        *   Removed `onImmediateUpdate` prop from being passed to `SpecialDaysManagement` within `GeneralStoreSetupSection.tsx`.
        *   Removed explicit "Save Scheduling Rules" button from `SchedulingEngineSection.tsx`.
        *   Removed `onBlur={onImmediateUpdate}` handlers from `Input` components in `SchedulingEngineSection.tsx`.
        *   Corrected `ScheduleGenerationSettings` invocation in `SchedulingEngineSection.tsx` to remove its internal `onImmediateUpdate` call, ensuring it uses the parent's debounced auto-save via its `onUpdate` prop.
*   **Subtask 4.2: Update API Calls and Data Handling**
    *   Action: Modify frontend API service calls to send/receive new/modified fields. Ensure frontend state correctly manages all settings data.
    *   File(s): `src/frontend/src/services/api.ts`, `src/frontend/src/types/index.ts`, relevant components using settings.
    *   Output: Updated API service functions and type definitions.
    *   **STATUS: COMPLETED.**
        *   Refactored the main `Settings` interface in `src/frontend/src/types/index.ts` to align with the new backend data structure. This involved:
            *   Moving previously top-level fields (e.g., `store_name`, `timezone`, `opening_days`, `special_hours`, `availability_types`, `shift_types`) into their respective nested categories (`general`, `scheduling`, `employee_groups`, `availability_types`, etc.), keeping only `id` top-level.
            *   Updating `Settings.general` to use `store_phone: string | null` and `store_email: string | null` instead of `store_contact`.
            *   Removing the deprecated top-level `scheduling_advanced` field.
            *   Adding new fields from backend Pydantic schemas (e.g., `scheduling_algorithm`, `max_generation_attempts` to `Settings.scheduling`).
            *   Making several fields within nested objects optional to align with Pydantic `Optional` types.
        *   Verified that `getSettings` and `updateSettings` functions in `src/frontend/src/services/api.ts` use the `Settings` type and `Partial<Settings>` correctly. No direct changes to these functions were needed as their typings are now correct due to the `Settings` type update.

## Phase 5: Testing & Validation

**Objective:** Ensure all changes are working correctly and the settings pages are robust.

*   **Subtask 5.1: Backend Unit & Integration Tests**
    *   Action: Write/update Pytests for:
        *   SQLAlchemy models (field additions, `to_dict`, `update_from_dict`).
        *   API endpoints (handling new data, validation for `/api/settings/` and category-specific ones).
        *   Service logic involved in saving settings.
    *   File(s): `src/backend/tests/test_models.py`, `src/backend/tests/test_api.py` (or new `test_settings_api.py`).
    *   Output: New/updated test files.
    *   **STATUS: IN PROGRESS.** Added comprehensive tests for the `Settings` model to `src/backend/tests/test_models.py`. Added API tests for `/api/settings/` (GET, PUT full/partial) and `/api/settings/scheduling/generation` (GET, PUT) to `src/backend/tests/test_api.py`. Further backend tests for service logic might be needed if settings involve complex services beyond direct model/API interaction.
*   **Subtask 5.2: Frontend Unit & Integration Tests**
    *   Action: Write/update frontend tests (e.g., Jest, React Testing Library) for:
        *   Settings components UI and interaction.
        *   Data binding and display.
        *   Auto-save or manual save functionality.
    *   File(s): `src/frontend/src/__tests__/` or component-specific test folders, especially `src/frontend/src/pages/__tests__/UnifiedSettingsPage.test.tsx`.
    *   Output: New/updated frontend test files.
    *   **STATUS: IN PROGRESS.** Updated `src/frontend/src/pages/__tests__/UnifiedSettingsPage.test.tsx`: 
        *   Revised `mockSettings` to align with the new `Settings` data structure.
        *   Improved test for initial data display in the general section.
        *   Added a new test case for debounced auto-save functionality, verifying `api.updateSettings` calls with correct payload and timing.
        Further tests for other sections, complex inputs, and UI feedback (e.g., "Saving..." indicator) can be added.
*   **Subtask 5.3: End-to-End Manual Testing**
    *   Action: Perform thorough manual testing of all settings pages and functionalities:
        *   Verify all fields (especially previously problematic ones: diagnostics, special opening days, constraints, opening/closing times) save and load correctly.
        *   Confirm UI consistency across all settings areas.
        *   Test save mechanisms thoroughly.
        *   Check responsiveness and error handling.
    *   Output: Test execution report, bug reports for any issues found.
    *   **Note:** Resolved a runtime error in `UnifiedSettingsPage.tsx` related to incorrect import and usage of the `PageHeader` component from `src/frontend/src/components/PageHeader.tsx`. This was blocking page rendering and further testing.

## Phase 6: Documentation & Review

**Objective:** Finalize the changes and ensure they are well-documented.

*   **Subtask 6.1: Update Documentation (if applicable)**
    *   Action: If any internal or user-facing documentation exists for settings, update it to reflect the changes.
    *   Output: Updated documentation.
*   **Subtask 6.2: Code Review and Merge**
    *   Action: Conduct a thorough code review of all backend and frontend changes. Merge to the main development branch once approved.
    *   Output: Merged code.

---
**Initial Analysis Notes from User:**
- Some fields are not saved correctly (missing db field): enable diagnostics, special opening days, all constraints.
- Some containers have submit (save) buttons, some use auto-save (user recommends auto-save).
- Store opening and closing time has two inputs each (needs clarification/redesign).
---
