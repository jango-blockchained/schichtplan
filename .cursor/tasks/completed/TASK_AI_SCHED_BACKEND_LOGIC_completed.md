# Task: Implement AI Schedule Generation Backend Logic

**ID:** TASK_AI_SCHED_BACKEND_LOGIC
**Status:** completed
**Priority:** Medium
**Category:** Backend Feature

**Description:**
Implement the backend logic to support AI-based schedule generation using the Gemini API. The AI should return a CSV formatted text which gets loaded into the app.

**Core Functionality:**
1.  **API Endpoint:** Create a new API endpoint to trigger AI schedule generation.
2.  **Data Collection:**
    - Gather all necessary information from application settings (e.g., scheduling rules, employee constraints, coverage needs).
    - Collect required resources (e.g., employee list, shift templates, availability data) as text.
3.  **System Prompt Construction:** Formulate a comprehensive system prompt for the Gemini model, including the collected settings and resources.
4.  **Gemini API Integration:**
    - Make an API call to the specified Gemini model (`gemini-2.5-pro-exp-03-25`) using the provided API key (from settings).
    - Handle API responses, including potential errors.
5.  **CSV Processing:**
    - Parse the CSV formatted text response from the AI.
    - Validate the structure and content of the CSV.
6.  **Schedule Creation/Update:**
    - Transform the parsed CSV data into schedule assignments.
    - Store these assignments in the database, potentially as a new version or by updating an existing one.

**Key Backend Files Potentially Affected:**
- New route in `src/backend/routes/`.
- New service in `src/backend/services/` for AI generation logic.
- Modifications to `src/backend/models/` if new storage fields are needed (e.g., to flag AI-generated schedules).
- Utility functions for data collection, prompt formatting, and CSV parsing.

**Acceptance Criteria:**
- Backend can successfully call the Gemini API.
- AI-generated CSV can be parsed and transformed into valid schedule data.
- Generated schedules are correctly stored in the database.
- Appropriate error handling and logging are in place.
