# Application Wiring Documentation

## Overview
This document describes the complete application wiring structure for the Schichtplan application, including backend routing, frontend integration, and the fixes applied to resolve duplicate route registrations.

## Backend Architecture

### Blueprint Structure

The backend uses Flask blueprints to organize routes. The main structure is:

```
app.py (Flask app)
  └── api_bp (Main API blueprint at /api/v2)
       ├── ping_bp (/api/v2/ping)
       ├── shifts (/api/v2/shifts)
       ├── settings (/api/v2/settings)
       ├── schedules (/api/v2/schedules)
       ├── availability (/api/v2/availability)
       ├── employees (/api/v2/employees)
       ├── absences_bp (/api/v2/absences)
       ├── logs_bp (/api/v2/logs)
       ├── debug_bp (/api/v2/debug)
       ├── ai_schedule_bp (/api/v2/ai-schedule)
       ├── ai_conversation_bp (/api/v2/ai-conversation)
       └── auth_bp (/api/v2/auth)
```

### Route Registration Order

**Primary Registration (through api_bp):**
- shifts
- settings
- schedules
- employees
- availability
- absences
- auth
- logs
- debug
- ai_schedule
- ai_conversation
- ping

**Secondary Registration (direct to app):**
These blueprints are registered directly to the Flask app because they:
1. Have their own URL prefixes defined in the blueprint
2. Provide additional functionality not part of the core API
3. Need separate handling (e.g., CSV import with different CORS rules)

- absences_validation_bp
- holidays_bp
- holiday_bp
- holiday_import_bp
- special_days_bp
- coverage_bp (url_prefix="/api/v2/coverage")
- coverage_profiles_bp (url_prefix="/api/v2/coverage-profiles")
- csv_import_bp (url_prefix="/api/csv-import")
- pdf_settings_bp (url_prefix="/api/v2/pdf-settings")
- api_settings_bp (url_prefix="/api/v2/settings", name="api_settings")
- demo_data_bp (url_prefix="/api/v2/demo-data")
- api_schedules_bp (url_prefix="/api/v2/schedules", name="api_schedules")
- week_navigation_bp (url_prefix="/api/v2/week-navigation")
- vacation_pdf_bp (url_prefix="/api/v2/vacation-pdf")
- additional_pdf_bp (url_prefix="/api/v2/additional-pdf")
- mcp_bp (url_prefix="/api/v2/mcp", only in non-testing mode)
- mcp_health_bp (only in non-testing mode)
- ai_bp (url_prefix="/api/v2/ai")

### Legacy Path Rewriter

The application includes a middleware that rewrites legacy `/api/*` paths to `/api/v2/*` for backward compatibility:

```python
class _LegacyApiPathRewriter:
    def __call__(self, environ, start_response):
        path = environ.get("PATH_INFO", "")
        # Exclude paths like /api/csv-import/
        if path.startswith("/api/") and not path.startswith("/api/v2/"):
            environ["PATH_INFO"] = path.replace("/api/", "/api/v2/", 1)
        return self.wsgi_app(environ, start_response)
```

### Intentional Route Duplicates

Some blueprints intentionally define multiple routes for the same endpoint to support different URL patterns:

**Absences Blueprint:**
- `/` and `/absences/` - Direct absence creation
- `/employees/<id>/absences` and `/absences/employees/<id>/absences` - Employee-specific absences

**Employees Blueprint:**
- `/employees` and `/employees/` - List/create employees
- `/employees/<id>` and `/employees/<id>/` - Get/update/delete employee
- `/api/employees/<id>/availability` - Legacy availability path

These duplicates are intentional for backward compatibility with existing API clients.

## Frontend Architecture

### API Service Layer

The frontend communicates with the backend through a centralized API service (`src/frontend/src/services/api.ts`):

```typescript
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
  withCredentials: true,
  timeout: API_TIMEOUT.DEFAULT,
});
```

### Key Endpoints Used by Frontend

| Frontend Feature | Backend Endpoint | Method | Purpose |
|-----------------|------------------|--------|---------|
| Settings | `/api/v2/settings/` | GET, PUT | Application configuration |
| Employees | `/api/v2/employees/employees` | GET, POST, PUT, DELETE | Employee management |
| Shifts | `/api/v2/shifts/shifts` | GET, POST, PUT, DELETE | Shift templates |
| Schedules | `/api/v2/schedules/schedules` | GET, POST | Schedule data |
| Absences | `/api/v2/absences/` | GET, POST, PUT, DELETE | Absence tracking |
| Availability | `/api/v2/availability/` | GET, POST, PUT | Employee availability |
| Coverage | `/api/v2/coverage/` | GET, POST, PUT | Coverage requirements |
| Coverage Profiles | `/api/v2/coverage-profiles/` | GET, POST, PUT | Coverage profiles |
| AI Conversation | `/api/v2/ai-conversation/conversation` | POST | AI chat |
| AI Agents | `/api/v2/ai/agents` | GET | AI agent info |

### Type Safety

The frontend uses strict TypeScript types defined in `src/frontend/src/types/index.ts`:

```typescript
export interface Employee {
  id: number;
  employee_id: string;
  first_name: string;
  last_name: string;
  employee_group: string;
  contracted_hours: number;
  vacation_per_year: number;
  is_keyholder: boolean;
  is_active: boolean;
  // ... other fields
}

export interface Absence {
  id: number;
  employee_id: number;
  absence_type_id: string;
  start_date: string;
  end_date: string;
  status: string;
  note?: string;
}
```

All API responses are validated against these types.

## CORS Configuration

The backend is configured to accept requests from the frontend development server:

```python
CORS(
    app,
    resources={
        r"/api/*": {
            "origins": ["http://localhost:5173", "http://127.0.0.1:5173"],
            "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            "allow_headers": ["Content-Type", "Authorization", "Accept", "X-Requested-With"],
            "supports_credentials": True,
        },
    },
)
```

## Testing

### Backend Tests

Run all backend tests:
```bash
./src/backend/.venv/bin/python -m pytest tests/backend/ -v
```

Test specific endpoints:
```bash
./src/backend/.venv/bin/python -m pytest tests/backend/ -k "test_employees"
```

### Frontend Build

Build the frontend:
```bash
cd src/frontend && bun run build
```

### Integration Testing

Test the complete stack:
```bash
# Start backend
./src/backend/.venv/bin/python -m flask --app src.backend.app:create_app run

# Start frontend (in another terminal)
cd src/frontend && bun dev
```

Access the application at http://localhost:5173

## Fixes Applied

### Issue 1: Duplicate Route Registrations

**Problem:** Blueprints were registered both in `api_bp` (in `src/backend/routes/__init__.py`) and directly in `app.py`, causing 92 duplicate route registrations.

**Solution:** 
1. Removed duplicate registrations from `app.py`
2. Keep only one registration path per blueprint
3. Maintained intentional duplicates for backward compatibility

**Result:** Reduced from 92 duplicates to 44 (remaining duplicates are intentional)

### Issue 2: Frontend TypeScript Compilation Errors

**Problems:**
1. Missing `Absence` export in `api.ts`
2. Missing `status` field in Absence objects
3. Missing `vacation_per_year` field in Employee mocks
4. Incorrect method call `toISODateString()` instead of `substring()`
5. Spread operator on potentially non-object values
6. Checkbox `indeterminate` prop not supported
7. Duplicate identifier in test setup
8. Readonly property assignment attempts

**Solutions:** All issues fixed with appropriate type corrections and code fixes

**Result:** Frontend builds successfully with no TypeScript errors

## Monitoring and Debugging

### Check Registered Routes

Use this script to see all registered routes:
```python
from src.backend.app import create_app
app = create_app('testing')
with app.app_context():
    for rule in app.url_map.iter_rules():
        print(f"{rule.endpoint}: {rule}")
```

### API Request Logging

The frontend API service includes request/response interceptors that log all API calls to the browser console in development mode.

### Backend Logging

Backend logs are written to:
- `instance/logs/app.log` - General application logs
- `instance/logs/schedule.log` - Scheduler-specific logs
- `instance/logs/errors.log` - Error tracking
- `instance/logs/user_actions.log` - Audit trail

## Best Practices

1. **Always use the centralized API service** in the frontend - never make direct axios calls
2. **Import types from `@/types/index.ts`** - don't duplicate type definitions
3. **Test route changes** with the integration test script before deploying
4. **Use the legacy path rewriter** for backward compatibility when changing routes
5. **Document intentional duplicates** to avoid future confusion

## Troubleshooting

### Route Not Found (404)

1. Check the route is registered in the correct blueprint
2. Verify the blueprint is registered in `app.py`
3. Check for typos in the URL path
4. Use the route debugging script above

### CORS Errors

1. Verify the frontend origin is in the CORS configuration
2. Check the request includes proper headers
3. Ensure `withCredentials: true` is set in axios config

### Type Errors

1. Ensure types are imported from `@/types/index.ts`
2. Check API response matches expected type
3. Use TypeScript strict mode to catch issues early

## Future Improvements

1. Consider consolidating all blueprints under `api_bp` for consistency
2. Remove unnecessary route duplicates after verifying no clients depend on them
3. Add API versioning strategy for breaking changes
4. Implement rate limiting for public endpoints
5. Add OpenAPI/Swagger documentation for the API
