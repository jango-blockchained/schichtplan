# Task: Refactor & Standardize Settings (Backend & Frontend)

**Status:** pending
**Priority:** High
**Category:** Core Functionality & UI/UX

## Checklist

### 1. Schema Unification
- [x] Review all fields in the backend Pydantic settings schemas (`schemas/settings.py`).
- [x] Review all fields in the frontend `Settings` TypeScript interface (`src/frontend/src/types/index.ts`).
- [x] List and compare all fields, including nested objects (e.g., `scheduling.generation_requirements`). (Completed via AI analysis appended below)
- [x] Identify and resolve naming inconsistencies (e.g., `special_days` vs. `special_hours`). (Identified, actions proposed and implemented where straightforward)
- [x] Align optional/required status for all fields between backend and frontend. (Identified, actions proposed and implemented where straightforward)
- [x] Update backend schemas and frontend types to match the unified structure. (Implementation of primary alignments completed)

### 2. API & Persistence Logic
- [x] Ensure backend API endpoints for settings (GET/PUT/PATCH) serialize and deserialize the unified schema correctly. (Verified: PUT uses Pydantic, GET uses model.to_dict(); Pydantic schemas updated)
- [x] Update backend models and database logic if new fields or structure changes are needed. (Added `calendar_start_day`, `calendar_default_view` to Settings model; `to_dict`, `update_from_dict`, `get_default_settings` updated. Migration will be needed.)
- [-] Update frontend API calls to use the unified schema and handle all fields. (`useSettings` hook seems okay. `LayoutCustomizerPage` sends `LayoutConfig` to `/api/settings/pdf-layout` which differs from `PDFLayoutSettingsSchema` - needs further investigation/alignment.)
- [x] Ensure frontend state management reflects the unified settings structure. (Primary state via `useSettings` hook uses the updated `Settings` type. Individual components consuming this may need adjustments for new nullability.)

### 3. UI/UX Consistency
- [-] Audit all settings-related UI components (e.g., `UnifiedSettingsPage`, `ScheduleGenerationSettings`). (Partially done. `GeneralStoreSetupSection`, `SchedulingEngineSection` (and its child `ScheduleGenerationSettings` with caveats), `AppearanceDisplaySection`, `NotificationsSection`, `AvailabilityConfigurationSection`, `IntegrationsAISection`, `DataManagementSection` reviewed. `EmployeeShiftDefinitionsSection` is blocked by child editor type mismatches requiring deeper refactor. Some components like `ScheduleGenerationSettings` had internal logic adjusted for prop type changes.)
- [ ] Ensure all settings fields are editable and displayed consistently in the UI. (Requires runtime testing after type alignments.)
- [ ] Fix any persistence issues (e.g., changes not saved or loaded correctly). (Requires runtime testing.)
- [ ] Add or update form validation to match backend requirements. (Requires review of each input and backend validation rules.)

### 4. Testing & Validation
- [ ] Add or update backend tests for settings API endpoints and schema validation.
- [ ] Add or update frontend tests for settings state, API integration, and UI.
- [ ] Manually test settings loading, editing, and saving in the application.

### 5. Documentation
- [ ] Update or create developer documentation describing the unified settings schema.
- [ ] Document any migration steps if the database schema changes.
- [ ] Update user documentation for the settings UI if needed.


## Schema Unification Analysis (AI Generated)

Date of Analysis: 2025-05-28

Files Analyzed:
- Backend: `src/backend/schemas/settings.py`
- Frontend: `src/frontend/src/types/index.ts` (specifically the `Settings` interface)

### General Discrepancies & Recommendations:

1.  **Optionality (Global Issue):**
    *   **Observation:** Backend Pydantic models frequently use `Optional[Type]` (implying `Type | None`), making fields nullable. Frontend TypeScript interfaces often define corresponding fields as strictly `Type` (required) or use `Type | undefined` (via the `?` operator for optional properties). For settings, which often involve partial updates and varying completeness of data from the backend, frontend types should be more accommodating.
    *   **Recommendation:** Modify frontend `Settings` interface and its nested types to use `Type | null | undefined` or `Type | undefined` (using `?:`) for fields that are `Optional` in the backend. This enhances flexibility for partial updates and aligns with backend behavior where an optional field might be absent or explicitly null.

2.  **Naming Conventions:**
    *   **Observation:** Some inconsistencies exist, e.g., notification-related fields in `DisplaySettings` (`schedule_published` vs. `schedule_published_notify`).
    *   **Recommendation:** Standardize naming. Suggest aligning with backend names (e.g., consistently use or remove `_notify` suffix based on a chosen convention).

3.  **Missing Fields:**
    *   **Observation:** Some fields exist only in the frontend (e.g., `calendar_start_day`, `calendar_default_view` in `Settings.display`; `autoAssignOnly` in `Settings.employee_groups.shift_types`).
    *   **Recommendation:** For each missing field, determine if it's purely a client-side derived/transient value or if it needs to be persisted. If persistence is required, add the field to the corresponding backend Pydantic schema as `Optional`.

4.  **Type Specificity:**
    *   **Observation:** Backend often uses `Literal` for more precise type checking (e.g., days of the week, specific string options like themes or orientations). Frontend often uses general `string` or `number`.
    *   **Recommendation:** Where feasible and beneficial for type safety, encourage frontend to adopt these `Literal` types or use string/number literal unions.

5.  **Redundant/Conflicting Structures:**
    *   **Observation:** Frontend `Settings.general.special_days` contains a redundant `date: string` within its value object. Frontend `Settings.general` also has both `special_hours` and `special_days` which appear to be overlapping in intent.
    *   **Recommendation:** Remove the redundant `date` field from `Settings.general.special_days` value object. Consolidate `special_hours` and `special_days` in the frontend, likely standardizing on the `special_days` structure (after removing the redundant inner `date`) to align with the backend `GeneralSettings.special_days`.

### Detailed Analysis by Section:

**A. `GeneralSettings` (backend) vs. `Settings.general` (frontend):**

*   **Optionality Mismatches:** Frontend fields `store_name`, `timezone`, `language`, `date_format`, `time_format`, `store_opening`, `store_closing` are required, while backend equivalents are `Optional`.
    *   **Action:** Make these frontend fields optional (e.g., `string | null`).
*   **`special_days` vs. `special_hours`:** Frontend has both; backend has `special_days`. Frontend `Settings.general.special_days` is a closer structural match to backend `GeneralSettings.special_days`.
    *   **Action:** Deprecate/remove `Settings.general.special_hours` in frontend. Align frontend `Settings.general.special_days` with backend `GeneralSettings.special_days` (Pydantic `SpecialDay` and `SpecialDayCustomHours`).
*   **Redundant `date` in frontend `special_days`:** The value object in `Settings.general.special_days` has a `date: string` field, redundant as the dictionary key is the date.
    *   **Action:** Remove this inner `date` field from the frontend type.
*   **`opening_days` key type:** Backend `Literal` vs. frontend `string`. Acceptable, but backend is more type-safe.

**B. `SchedulingSettingsSchema` (backend) vs. `Settings.scheduling` (frontend):**

*   **Optionality Mismatches:** Frontend fields `scheduling_resource_type`, `default_shift_duration`, `min_break_duration`, `max_daily_hours`, `max_weekly_hours`, `min_rest_between_shifts`, `scheduling_period_weeks`, `auto_schedule_preferences` are required, while backend equivalents are `Optional`.
    *   **Action:** Make these frontend fields optional (e.g., `number | null`).
*   **`generation_requirements`:** Structure aligns well.

**C. `DisplaySettingsSchema` (backend) vs. `Settings.display` (frontend):**

*   **Optionality Mismatches:** Frontend fields `theme`, `primary_color`, `secondary_color`, `accent_color`, `background_color`, `surface_color`, `text_color`, `show_sunday`, `show_weekdays`, `start_of_week`, `email_notifications`, `schedule_published`, `shift_changes` are required, while backend equivalents are `Optional`.
    *   **Action:** Make these frontend fields optional.
*   **Naming (Notifications):** `schedule_published` (FE) vs. `schedule_published_notify` (BE); `shift_changes` (FE) vs. `shift_changes_notify` (BE).
    *   **Action:** Standardize, e.g., align frontend to backend `_notify` names.
*   **Missing in Backend:** `calendar_start_day?: "sunday" | "monday"`; `calendar_default_view?: "month" | "week" | "day"`.
    *   **Action:** Decide if these need persistence. If so, add to backend `DisplaySettingsSchema` as `Optional`.
*   **`start_of_week` type:** Frontend `number` vs. Backend `Optional[Literal[0-6]]`. Backend is more precise.
    *   **Action:** Frontend could use a literal type or validate the number range.

**D. `PDFLayoutSettingsSchema` (backend) vs. `Settings.pdf_layout` (frontend):**

*   **Optionality Mismatches:** All top-level and most nested fields are required in frontend, `Optional` in backend.
    *   **Action:** Make frontend fields and their nested fields optional to align.
*   **`orientation` type:** Frontend `string` vs. Backend `Optional[Literal['portrait', 'landscape']]`.
    *   **Action:** Frontend should align to literal type or validate.

**E. `EmployeeGroupsSettingsSchema` (backend) vs. `Settings.employee_groups` (frontend):**

*   **Optionality of Lists:** Backend lists (`employee_types`, `shift_types`, `absence_types`) are `Optional`, frontend arrays are required.
    *   **Action:** Make these frontend arrays optional (e.g., `Array<...> | null`).
*   **`EmployeeTypeSchema.type`:** Backend `Literal["employee_type", "employee"]` vs. Frontend `"employee_type"`.
    *   **Action:** Clarify if frontend needs to support `"employee"` or if backend should be restricted.
*   **`AbsenceTypeSchema.type`:** Backend `Literal["absence_type", "absence"]` vs. Frontend `"absence_type"`.
    *   **Action:** Similar clarification needed.
*   **Extra field in frontend `shift_types` items:** `autoAssignOnly?: boolean` is missing in backend `ShiftTypeSchemaPydantic`.
    *   **Action:** If `autoAssignOnly` needs persistence, add to backend schema as `Optional[bool]`.

**F. `AvailabilityTypesSettingsSchema` (backend) vs. `Settings.availability_types` (frontend):**

*   **Optionality of List:** Backend `types` list is `Optional`, frontend array is required.
    *   **Action:** Make frontend `types` array optional.
*   **`priority` field in `AvailabilityTypeDetailSchema`:** Backend `priority: int` (required) vs. Frontend `priority?: number` (optional).
    *   **Action:** Align optionality. If `priority` is essential, make it required in frontend. If truly optional, make backend `Optional[int]`.

**G. `ActionsSettingsSchema` (backend) vs. `Settings.actions` (frontend):**

*   **`last_execution` type (in `DemoDataSettingsSchema`):** Backend `Optional[datetime]` vs. Frontend `string | null`. This is acceptable for datetime string representations.
    *   **Action:** Ensure proper serialization/deserialization.

**H. `AISchedulingSettingsSchema` (backend) vs. `Settings.ai_scheduling` (frontend):**

*   **Alignment:** Good. Both use optional fields (`enabled?: boolean`, `api_key?: string | null`).

This analysis marks the completion of the review and comparison steps for schema unification. The next steps involve implementing these changes in the respective files.

### Updated Checklist for Schema Unification:
- [x] Review all fields in the backend Pydantic settings schemas (`schemas/settings.py`).
- [x] Review all fields in the frontend `Settings` TypeScript interface (`src/frontend/src/types/index.ts`).
- [x] List and compare all fields, including nested objects (e.g., `scheduling.generation_requirements`). (Completed via AI analysis appended below)
- [x] Identify and resolve naming inconsistencies (e.g., `special_days` vs. `special_hours`). (Identified, actions proposed and implemented where straightforward)
- [x] Align optional/required status for all fields between backend and frontend. (Identified, actions proposed and implemented where straightforward)
- [x] Update backend schemas and frontend types to match the unified structure. (Implementation of primary alignments completed)
