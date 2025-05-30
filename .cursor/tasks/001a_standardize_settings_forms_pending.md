---
ID: 001a
Description: Standardize UI/UX for all settings pages/components, focusing on layouts, form structures, and non-Card component usage.
Status: pending
Priority: medium
Project Context: Schichtplan Application - Frontend Settings
Depends On: 001_review_frontend_settings_completed.md (implicitly, as it continues that work)
User Request (from Task 001):
- Completely review all parts of the frontend settings page and subpages or components. The goal should be that all settings are working (changes get saved) and all pages use the same design and components.

Steps/Plan:
  - Phase 1: Ingestion & Understanding (Done - context from Task 001)
  - Phase 2: Planning & Resource Gathering
    - Step 1: Review `UnifiedSettingsPage.tsx` and its child section components (`GeneralStoreSetupSection.tsx`, `SchedulingEngineSection.tsx`, `EmployeeShiftDefinitionsSection.tsx`, `AvailabilityConfigurationSection.tsx`, `AppearanceDisplaySection.tsx`, `IntegrationsAISection.tsx`, `DataManagementSection.tsx`, `NotificationsSection.tsx`).
    - Step 2: Identify specific inconsistencies in:
        - Layouts within Cards (e.g., grid usage, spacing, alignment).
        - Form structures (e.g., usage of `react-hook-form` vs. manual state, consistent field presentation).
        - Usage of shadcn/ui components other than `Card` (e.g., `Input`, `Select`, `Switch`, `Button`, `Label`, `Separator`, `Dialog`, `Table`).
        - Feedback mechanisms (e.g., toast notifications, inline validation messages, loading states for specific actions within sections).
    - Step 3: Define a consistent approach/style guide for the items in Step 2.
    - Step 4: Create a detailed plan for refactoring each identified component/section.
  - Phase 3: Execution & Monitoring
    - Action: Refactor layouts in each settings section component for consistency.
    - Action: Standardize form handling (e.g., adopt `react-hook-form` more broadly if beneficial, ensure consistent error display).
    - Action: Ensure consistent styling and usage of common shadcn/ui components.
    - Action: Refine feedback mechanisms within sections for clarity.
  - Phase 4: Verification, Self-Correction & Updates
    - Manually test all settings pages thoroughly after changes.
    - Validate UI consistency across all sections.
  - Phase 5: Completion & Reporting
    - Document changes and outcomes.

OutputFile: None
Logs/Errors: None yet.
---
