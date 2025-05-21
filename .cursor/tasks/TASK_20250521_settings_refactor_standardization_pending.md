# Task: Refactor & Standardize Settings (Backend & Frontend)

**Status:** pending
**Priority:** High
**Category:** Core Functionality & UI/UX

## Checklist

### 1. Schema Unification
- [ ] Review all fields in the backend Pydantic settings schemas (`schemas/settings.py`).
- [ ] Review all fields in the frontend `Settings` TypeScript interface (`src/frontend/src/types/index.ts`).
- [ ] List and compare all fields, including nested objects (e.g., `scheduling.generation_requirements`).
- [ ] Identify and resolve naming inconsistencies (e.g., `special_days` vs. `special_hours`).
- [ ] Align optional/required status for all fields between backend and frontend.
- [ ] Update backend schemas and frontend types to match the unified structure.

### 2. API & Persistence Logic
- [ ] Ensure backend API endpoints for settings (GET/PUT/PATCH) serialize and deserialize the unified schema correctly.
- [ ] Update backend models and database logic if new fields or structure changes are needed.
- [ ] Update frontend API calls to use the unified schema and handle all fields.
- [ ] Ensure frontend state management reflects the unified settings structure.

### 3. UI/UX Consistency
- [ ] Audit all settings-related UI components (e.g., `UnifiedSettingsPage`, `ScheduleGenerationSettings`).
- [ ] Ensure all settings fields are editable and displayed consistently in the UI.
- [ ] Fix any persistence issues (e.g., changes not saved or loaded correctly).
- [ ] Add or update form validation to match backend requirements.

### 4. Testing & Validation
- [ ] Add or update backend tests for settings API endpoints and schema validation.
- [ ] Add or update frontend tests for settings state, API integration, and UI.
- [ ] Manually test settings loading, editing, and saving in the application.

### 5. Documentation
- [ ] Update or create developer documentation describing the unified settings schema.
- [ ] Document any migration steps if the database schema changes.
- [ ] Update user documentation for the settings UI if needed.
