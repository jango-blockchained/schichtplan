---
ID: T001
Description: Update API URLs project-wide from old schema to api/v2/
Status: in_progress
Priority: high
Project Context: Schichtplan
Revised Steps:
  1. Backend Route Identification & Modification (Python):
     a. In `src/backend/app.py`:
        i. Change `app.register_blueprint(..., url_prefix="/api")` to `app.register_blueprint(..., url_prefix="/api/v2")` for all relevant blueprints.
        ii. Change `app.register_blueprint(..., url_prefix="/api/somepath")` to `app.register_blueprint(..., url_prefix="/api/v2/somepath")` (e.g., for demo-data, logs).
        iii. Change direct routes like `@app.route("/api/health")` to `@app.route("/api/v2/health")`.
     b. For blueprints registered in `app.py` *without* a `url_prefix` OR with a `url_prefix` that itself needs to be versioned (e.g. already `/api/something`):
        i. Examine the blueprint definition file (e.g., `src/backend/routes/availability.py`).
        ii. If the `Blueprint("name", ..., url_prefix="/api/subpath")` definition exists, change it to `url_prefix="/api/v2/subpath"`.
        iii. If `Blueprint("name", ..., url_prefix="/somepath_not_api")` or no prefix, no change needed here unless its routes are hardcoded with `/api/`.
  2. Frontend API Call Identification (TypeScript/TSX):
     a. Search for string literals or constructed URLs that call backend APIs, e.g., looking for `fetch("/api/` or `axios.get("/api/` or similar patterns in `*.ts` and `*.tsx` files under `$WORKSPACE/src/frontend`.
  3. Frontend API Call Modification (TypeScript/TSX):
     a. Update identified API calls to use the new `/api/v2/` prefix.
  4. Test Code Update (Python):
     a. Search for API call patterns in backend tests (e.g., `client.get("/api/`) in `*.py` files under `$WORKSPACE/src/backend/tests`.
     b. Update test API calls to use `/api/v2/`.
  5. Application Testing:
     a. Manually test the application to ensure all functionalities reliant on these APIs are working correctly.

Files confirmed to need `url_prefix` changes:
  - `src/backend/app.py` (multiple blueprint registrations and direct routes)
  - `src/backend/routes/availability.py` (Blueprint definition: `url_prefix="/api/availability"`)
  - ... (others to be checked based on app.py registrations: auth.py, coverage.py, api/settings.py, api/schedules.py etc.)

Logs:
  - Task created.
  - Task status changed to in_progress.
  - Initial regex searches were insufficient.
  - Analysis of `src/backend/app.py` and `src/backend/routes/availability.py` clarified that changes are needed in `url_prefix` attributes in `app.register_blueprint` calls and in `Blueprint` definitions themselves, as well as direct `@app.route` calls.
  - Plan updated with more specific backend modification steps.
  - Automated steps for backend modifications completed.
---
