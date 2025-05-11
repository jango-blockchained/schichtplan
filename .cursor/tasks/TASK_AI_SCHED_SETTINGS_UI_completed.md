# Task: Implement AI Schedule Generation Settings UI

**ID:** TASK_AI_SCHED_SETTINGS_UI
**Status:** inprogress
**Priority:** Medium
**Category:** Frontend Feature

**Description:**
Add options to the frontend settings page to manage the AI-based schedule generation feature.

**Progress:**
- Initial UI elements (enable toggle, API key input) added to `SettingsPage.tsx`.
- Local component state in `SettingsPage.tsx` updated to manage these settings.
- `Settings` type in `types/index.ts` updated with `ai_scheduling` field.
- `DEFAULT_SETTINGS` in `useSettings.ts` updated with `ai_scheduling` field.
- Backend `Settings` model (`src/backend/models/settings.py`) updated with `ai_scheduling` JSON column.
- Backend model's `to_dict()` and `update_from_dict()` methods updated to handle `ai_scheduling`.
- Database migration created and applied for the new `ai_scheduling` column.
- Backend API routes (`/api/settings`) are expected to handle the new settings field correctly due to model updates.

**Next Steps:**
- Thoroughly test UI functionality, including saving and reloading AI scheduling settings to ensure backend persistence works as expected.
- If issues arise, investigate API routes and model interactions further.
- Consider security implications of storing API keys if not already fully addressed (e.g., encryption at rest, access controls).

**UI Elements:**
1.  **Enable/Disable Toggle:** A switch or checkbox to enable or disable the AI schedule generation feature.
2.  **API Key Input:** A text field for users to enter their Gemini API key. This field should securely store the key (consider implications, possibly backend stores it and frontend just sets it).

**Frontend Components to Modify/Create:**
- `src/frontend/src/pages/SettingsPage.tsx` (modified).
- Potentially new components in `src/frontend/src/components/settings/` for these specific options.

**State Management:**
- Update frontend state (e.g., using Zustand, Context API, or local component state) to manage the toggle's state and the API key value (Done for local component state).
- Handle persistence of these settings (e.g., by saving to backend or local storage, though backend is preferred for API keys) (Backend part pending).

**API Integration (for settings persistence):**
- If settings are stored in the backend, ensure API calls are made to fetch and save these settings (Pending).

**Acceptance Criteria:**
- User can enable/disable the AI schedule generation feature from the settings page (UI part done).
- User can input and save their Gemini API key (UI part done, saving relies on backend).
- The UI elements are clearly presented and functional.
- API key input should ideally offer some level of masking if displayed, or be write-only.