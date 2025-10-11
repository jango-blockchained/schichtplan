# Application Description: Schichtplan

This document provides a high-level overview of the Schichtplan application, a tool designed for managing employee work schedules.

## Architecture

Schichtplan utilizes a modern client-server architecture:

1.  **Backend:** (Actively Migrating from Python/Flask to Bun/TypeScript)
    *   **Language/Runtime:** TypeScript running on Bun.
    *   **Framework:** ElysiaJS.
    *   **Database:** SQLite, accessed via the native `bun:sqlite` module.
    *   **Schema Management:** Manual SQL scripts (`src/bun-backend/db/init-schema.sql`) managed via Bun scripts (see `src/bun-backend/package.json`). (Replaces previous Python/Alembic system).
    *   **API:** Provides a RESTful API (`/api/...`) for the frontend.
    *   **Location:** `src/bun-backend/`

2.  **Frontend:**
    *   **Framework/Library:** React.
    *   **Language:** TypeScript.
    *   **Build Tool:** Vite.
    *   **Styling:** Tailwind CSS with shadcn-ui components.
    *   **Data Fetching:** React Query.
    *   **Testing:** Bun Test (Unit/Integration), Playwright (End-to-End).
    *   **Location:** `src/frontend/`

## Core Functionality

*   **Employee Management:** Manage employee details, including roles/groups (e.g., VZ, TZ, GfB, TL) and weekly hour limits.
*   **Shift Templates:** Define standard shift types (e.g., Early, Middle, Late) with start/end times and break durations.
*   **Schedule Management:**
    *   Create, view, and edit work schedules based on date ranges.
    *   **Versioning:** Supports multiple versions of a schedule (Draft, Published, Archived) allowing for planning and historical tracking.
*   **Schedule Generation:** (Logic being ported from Python)
    *   Automated generation considering employee availability, shift templates, and coverage needs.
    *   Enforces business rules (e.g., keyholder requirements for specific shifts).
    *   Validates against German labor laws (e.g., minimum rest periods, break times).
*   **Employee Availability:** Allows tracking and respecting employee available/unavailable times.
*   **Store Configuration:** Manage store-specific settings (e.g., opening hours).
*   **Coverage Planning:** Define staffing requirements for different times/shifts.
*   **Authentication:** Uses session cookies.

## Project Structure Highlights

*   `src/bun-backend/`: Contains the current TypeScript backend code (ElysiaJS).
    *   `db/`: Database connection, schema interfaces, migration scripts.
    *   `routes/`: API endpoint definitions.
    *   `services/`: Business logic implementation.
*   `src/frontend/`: Contains the React frontend application.
    *   `src/components/`: Reusable UI components.
    *   `src/pages/`: Top-level page components.
    *   `src/services/`: Frontend API interaction logic.
    *   `src/hooks/`: Custom React hooks.
*   `src/backend/`: **(Deprecated)** Contains the old Python/Flask backend code. Planned for removal after migration is complete.
*   `docs/`: Contains project documentation (like this file, API docs, etc.).
*   `start.sh`: Script to simplify starting both backend and frontend development servers (uses tmux).

## Getting Started

Refer to the main `README.md` and the documentation within the `docs/` directory (e.g., `development-workflow.mdc`, `run-server.mdc`) for detailed setup and development instructions for the current Bun/React stack. The `start.sh` script provides the easiest way to start the development environment. 