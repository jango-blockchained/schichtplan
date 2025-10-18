# Copilot Instructions for Schichtplan

## Project Overview
Schichtplan is a full-stack employee scheduling system with AI-powered optimization via Model Context Protocol (MCP). The system handles complex shift planning for retail environments with multiple employee types, keyholders, coverage requirements, and compliance rules.

**Stack:** Python/Flask backend, React/TypeScript frontend (Vite + Bun runtime), SQLite database, MCP integration for AI tools.

**Important:** This project uses **Bun** (not npm) as the JavaScript runtime. All frontend commands use `bun` instead of `npm`. See `bunfig.toml` for Bun configuration.

**Current Branch:** `feature/week-navigation-only` - This branch focuses on week-based navigation features.

## Architecture & Key Concepts

### Core Domain Model
The scheduling system revolves around **interval-based coverage** (not just shift templates):
- **Coverage Requirements** define staffing needs per time interval (e.g., every 15-60 minutes) within time blocks
- When multiple Coverage records overlap, system takes MAX(`min_employees`) and combines requirements
- **ShiftTemplates** define shift properties (start/end time, active days, keyholder needs)
- **Schedules** have **versions** for comparing alternatives before publishing
- **Keyholder logic** requires specific employees to be present X minutes before store opens and after closing

**Critical files for understanding domain:**
- `docs/core_concepts.md` - Essential terminology and scheduling process
- `src/backend/models/` - Database entities (Employee, Schedule, Coverage, ShiftTemplate, etc.)
- `src/backend/services/scheduler/generator.py` - Main scheduling algorithm (1772 lines)

### Service Architecture
```
Frontend (React/Vite) 
    ↓ REST API
Backend (Flask)
    ↓ SQLAlchemy ORM
SQLite Database
    ↓ FastMCP
MCP Server (AI integration)
```

**Key integration points:**
- Frontend API client: `src/frontend/src/services/api.ts` (1715 lines - comprehensive API surface)
- Backend routes: `src/backend/routes/` and `src/backend/api/` (dual routing structure for legacy reasons)
- Backend app initialization: `src/backend/app.py` (main Flask app, blueprint registration)
- MCP server: `src/backend/mcp_server.py` - Exposes 16 tools, 7 resources, 6 prompts for AI integration
- MCP service: `src/backend/services/mcp_service.py` - Implements MCP protocol handlers
- Conversational AI: `src/backend/services/conversational_mcp_service.py` - Multi-provider AI orchestration

### Database & Migrations
- **Location:** `instance/app.db` (SQLite)
- **Migrations:** Use Alembic via Flask-Migrate: `flask db upgrade`
- **Tools:** `src/backend/tools/migrations/` contains schema management scripts
- **DO NOT** edit migration files directly - use migration scripts or `flask db migrate`

## Development Workflows

### Starting the Application
```bash
# Full stack (backend + frontend):
./start.sh

# With MCP server for AI features:
./start.sh --with-mcp

# With Conversational AI MCP server (advanced AI orchestration):
python start_conversational_ai.py --transport sse --port 8001

# Backend only (port 5000):
./src/backend/.venv/bin/python -m src.backend.run runserver

# Frontend only (port 5173):
cd src/frontend && bun dev

# MCP standalone (for AI tool integration):
python src/backend/mcp_server.py --transport sse --port 8001
```

**Use VS Code tasks** (see `.vscode/tasks.json`) for common workflows instead of manual commands.

**Note on MCP servers:** Two MCP server variants exist:
- `mcp_server.py` - Standard MCP server for AI tool integration (16 tools, 7 resources, 6 prompts)
- `start_conversational_ai.py` - Advanced conversational AI with multi-provider orchestration (OpenAI, Anthropic, Gemini)

### Testing
```bash
# Backend tests with pytest:
./src/backend/.venv/bin/python -m pytest -v

# Frontend tests:
cd src/frontend && bun test

# Specific test suites:
pytest tests/backend/scheduler/  # Scheduler tests
```

**Important:** `pytest.ini` excludes `src/backend/tools` directory from test discovery.

### Running Backend Commands
**ALWAYS activate the virtual environment first:**
```bash
# Correct:
./src/backend/.venv/bin/python -m src.backend.run <command>

# Wrong:
python src/backend/run.py  # May use wrong Python version
```

### Database Operations
```bash
# Check database schema:
python check_db_schema.py

# Validate database entities:
python check_database_entities.py

# Generate demo data:
python src/backend/tools/data_generators/update_demo_data.py

# Rebuild database (DESTRUCTIVE):
python src/backend/tools/rebuild_db.py
```

### Code Quality
```bash
# Lint Python code:
./src/backend/.venv/bin/python -m ruff check .

# Format Python code:
./src/backend/.venv/bin/python -m ruff format .
```

**Python standards:** Follow PEP8, use type hints, comprehensive docstrings. Configuration in `pyproject.toml`.

## Project-Specific Patterns

### Backend: Centralized Logging
**DO NOT** create ad-hoc loggers. Use the centralized logger:
```python
# Correct pattern (used throughout codebase):
from src.backend.utils.logger import logger

logger.info("Message")
logger.error("Error", exc_info=True)

# All logs go to structured locations:
# - instance/logs/app.log - Application logs
# - instance/logs/schedule.log - Scheduler-specific logs
# - instance/logs/diagnostics/ - Detailed diagnostic output
# - instance/logs/errors.log - Error tracking
# - instance/logs/user_actions.log - Audit trail
```

See `src/backend/utils/logger.py` for logger setup. Uses RotatingFileHandler for log management.

### Frontend: Type-Safe API Integration
Frontend uses **strict TypeScript types** from `src/types/index.ts`. API service exports canonical types:
```typescript
// Use re-exported types from api.ts:
import { Employee, Schedule, Shift, Settings } from '@/services/api';

// API client with interceptors for debugging:
import { api } from '@/services/api';

// All API responses are validated and logged via interceptors
```

**API client features:**
- Automatic request/response logging (check browser console for detailed request info)
- Timeout handling (configurable via `API_TIMEOUT` constants in `@/constants`)
- Error handling with AxiosError type guards
- Credential support (withCredentials: true)
- Validate status function for correct HTTP status handling

**Never create duplicate type definitions.** Always import from the canonical source.

### Frontend: Design System
Follow `docs/design_concept.md` and `src/frontend/DESIGN_SYSTEM.md`:
- Use Shadcn UI components from `@/components/ui/`
- **Layout components:** `PageLayout`, `ContentCard`, `ContentGrid`, `SettingsLayout` from `@/layouts`
  - `PageLayout`: Main page wrapper with title, description, breadcrumbs, header actions
  - `ContentCard`: Consistent card layout for sections
  - `ContentGrid`: Responsive grid system with automatic column handling
  - `SettingsLayout`: Specialized layout for settings pages with tab navigation
- 4px-based spacing system (use multiples of 4 for consistent spacing)
- Semantic colors for states (`border-border`, `bg-muted`, `text-destructive`, etc.)
- Clean, professional aesthetic for workforce management

**Schedule page layout order:** Date Selection → Version Table → Statistics → Actions → Schedule Table → Color Legend

**Example pattern:**
```typescript
import { PageLayout, ContentCard, ContentGrid } from "@/layouts";

<PageLayout 
  title="My Page" 
  description="..." 
  breadcrumbs={[
    { href: "/", label: "Home" },
    { label: "Current Page", isCurrentPage: true }
  ]}
  headerActions={<Button>Action</Button>}
>
  <ContentGrid cols={2}>
    <ContentCard title="Section">
      {/* Content */}
    </ContentCard>
  </ContentGrid>
</PageLayout>
```

### Scheduler: Modular Package
Refactored from monolithic file into `src/backend/services/scheduler/`:
- `generator.py` - Main ScheduleGenerator class (coordinates generation)
- `resources.py` - ScheduleResources (data loading and access)
- `validator.py` - ScheduleValidator (rule validation)
- `utility.py` - Utility functions (is_early_shift, requires_keyholder, etc.)

**When debugging schedule generation:**
1. Check `instance/logs/schedule.log` for detailed scheduler logs
2. Use diagnostic tools in `src/backend/tools/debug/`
3. Review `src/backend/tools/scheduler/` for test harnesses

### MCP Integration Patterns
MCP server supports **three transports** (stdio, SSE, HTTP) for different AI tool integrations:
```python
# Tools follow consistent pattern:
@mcp.tool()
async def manage_employees(operation: str, employee_data: dict = None, ...):
    """CRUD operations with dry_run support."""
    # All tools support dry_run parameter for validation
    # All tools return structured responses with status info
```

**MCP resources** provide read-only access: `config://system`, `employees://{id}`, `schedules://{start}/{end}`.

**MCP prompts** guide AI assistants: Schedule Analysis, Employee Scheduling, Optimization, etc.

**Two MCP server variants:**
1. **Standard MCP** (`src/backend/mcp_server.py`): 16 tools, 7 resources, 6 prompts for basic AI integration
2. **Conversational AI** (`start_conversational_ai.py`): Multi-provider orchestration (OpenAI, Anthropic, Gemini) with state persistence

See `docs/MCP_INTEGRATION_GUIDE.md` for complete API reference.

### AI Integration Architecture
The system features deep AI integration with multiple layers:

**Frontend AI Components:**
- `GlobalAIAssistant.tsx`: Omnipresent floating assistant (bottom-right button, Cmd+/ shortcut)
- `ConversationalAIChat.tsx`: Multi-turn conversation interface with streaming support
- `enhancedAIService.ts`: Service layer for streaming responses, background tasks, context-aware requests
- `AIContext.tsx`: Tracks page context, route, and user actions for context-aware interactions

**Backend AI Services:**
- `routes/ai_routes.py`, `routes/enhanced_ai_routes.py`: REST endpoints for chat, agents, workflows
- `services/conversational_mcp_service.py`: Multi-turn conversation orchestration
- `services/enhanced_agent_registry.py`: Agent load balancing, performance tracking, capability matching
- AI Agents: ScheduleOptimizerAgent, EmployeeManagerAgent for specialized tasks

**AI Development Guidelines:**
- Always read `docs/AI_INTEGRATION_MASTER_INDEX.md` before making AI-related changes
- Use established patterns from EnhancedAIService for consistency
- Include page context in all AI requests using `AIContext.getContextSummary()`
- Prefer streaming responses via SSE for better UX
- Use background task system for operations >3 seconds
- AI failures must gracefully degrade, never block workflows

## Critical Constraints & Gotchas

1. **Coverage is interval-based:** Don't assume shift templates alone define staffing needs. The system calculates required staff for EACH time interval within coverage blocks.

2. **Keyholder timing:** Keyholders must arrive X minutes before opening and stay Y minutes after closing (configured in Settings). This is enforced by scheduler validation.

3. **Dual routing structure:** Both `src/backend/routes/` (legacy Flask blueprints) and `src/backend/api/` (newer API structure) exist. When adding endpoints, check both locations for existing patterns.

4. **Virtual environment isolation:** Backend has isolated venv at `src/backend/.venv`. Always use this Python interpreter to avoid dependency conflicts.

5. **Frontend state management:** Uses React Query for server state, local state for UI. Check existing hooks in `src/frontend/hooks/` before creating new data fetching logic.

6. **Database paths:** All paths use `Config.INSTANCE_DIR` from `src/backend/config.py`. Never hardcode paths to `instance/`.

7. **Migration safety:** Never directly edit generated migration files. Use `flask db migrate` to generate, then review before applying with `flask db upgrade`.

8. **Bun vs npm:** Frontend uses Bun as the JavaScript runtime. Always use `bun` commands, not `npm`. See `bunfig.toml` for configuration.

9. **Type safety:** Frontend enforces strict TypeScript with canonical type imports from `@/types/index.ts` and `@/services/api.ts`. Never duplicate type definitions.

10. **AI Context Awareness:** All AI features must use `AIContext` for page-aware interactions. Never make AI requests without context summary.

## Debugging Checklist

When investigating issues:
- [ ] Check relevant log file in `instance/logs/` (app.log, schedule.log, errors.log)
- [ ] Verify database schema with `check_db_schema.py`
- [ ] Review diagnostic output in `instance/logs/diagnostics/`
- [ ] Check Flask app initialization in `src/backend/app.py` (error handling, blueprint registration)
- [ ] Verify frontend API calls in browser Network tab (interceptors log all requests)
- [ ] For scheduler issues, use tools in `src/backend/tools/scheduler/` and `src/backend/tools/debug/`

## Documentation Sources

**Start here for major features:**
- `docs/core_concepts.md` - Domain model and terminology
- `docs/instructions.md` - Project-wide coding standards
- `docs/MCP_INTEGRATION_GUIDE.md` - AI integration documentation
- `docs/design_concept.md` - UI/UX design principles
- `src/backend/services/scheduler/README.md` - Scheduler architecture
- `src/frontend/README.md` - Frontend features and structure

**Task documentation:** See `docs/` for implementation summaries (e.g., `KEYHOLDER_IMPLEMENTATION_SUMMARY.md`, `MCP_BEST_PRACTICES_IMPLEMENTATION_SUMMARY.md`).

## Common Commands Reference

```bash
# Development
./start.sh --with-mcp              # Start everything with AI features
flask db upgrade                   # Apply migrations
python check_database_entities.py  # Validate database

# Testing
pytest -v -k test_scheduler       # Run scheduler tests
bun test                          # Frontend tests

# Code Quality  
./src/backend/.venv/bin/python -m ruff check .   # Lint
./src/backend/.venv/bin/python -m ruff format .  # Format

# Tools
python src/backend/tools/data_generators/update_demo_data.py  # Generate test data
python src/backend/tools/rebuild_db.py                        # Reset database (DESTRUCTIVE)
```

**When in doubt:** Check `docs/instructions.md` for project behavior guidelines, or review existing implementations in similar components before creating new patterns.
