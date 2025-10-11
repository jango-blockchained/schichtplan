# Project Instructions: Schichtplan

## 1. Tech Stack

- **Python** (main backend logic, scripts)
- **Bun** (JavaScript runtime, see `bun.lock`, `bunfig.toml`)
- **Shell scripts** (automation, e.g., `start.sh`)
- **Log files** (for diagnostics and monitoring)
- **VS Code/Cursor IDE** (recommended for development)

## 2. General Coding Standards

- **PEP8** for Python code (indentation, naming, docstrings)
- **Type hints** in Python where possible
- **Descriptive variable and function names**
- **Modular code**: prefer small, reusable functions and classes
- **Comprehensive docstrings** for all public functions/classes
- **Error handling**: always handle exceptions, log errors to appropriate log files
- **Consistent code formatting** (use `black` or similar for Python, Prettier for JS/TS)
- **Version control**: commit early, commit often, use meaningful commit messages
- **Tests**: add/maintain tests for all critical logic (see `test_*.py`)
- **No secrets in code**: never commit passwords, API keys, or sensitive data

## 3. Special Project Behaviours & Points of Attention

- **Database Checks**: Use `check_database_entities.py` and `check_db.py` to validate DB state before running main logic.
- **Schedule Logic**: `check_schedule.py` and logs in `instance/logs/schedule.log` are critical for debugging scheduling issues.
- **Diagnostics**: All diagnostics are logged in `instance/logs/diagnostics/`. Always check these logs when troubleshooting.
- **Backups & Migrations**: Use the `backups/` and `migrations/` folders for DB and code migrations. Never edit migration files directly—use migration scripts.
- **Frontend/Backend Separation**: Code is organized under `src/backend/` and `src/frontend/`. Keep logic separated and use clear interfaces.
- **Recurring Tasks**: Some scripts or processes may be scheduled or recurring. Check for templates or cron jobs.
- **Error Logging**: All errors should be logged to `instance/logs/errors.log` with timestamps and context.
- **User Actions**: User actions are tracked in `instance/logs/user_actions.log` for auditability.
- **Configuration**: All configuration should be environment-based and never hardcoded. Use `.env` or config files.
- **Testing**: Use `pytest` for Python tests. Place tests in files prefixed with `test_`.
- **Documentation**: Update `docs/` for any new features, changes, or important decisions.
- **AI Integration**: See `docs/AI_INTEGRATION_MASTER_INDEX.md` for comprehensive AI feature documentation. All AI-related code follows specific patterns for context awareness, streaming responses, and background tasks.

## 4. AI Integration Patterns

### Overview

The application features deep AI integration with conversational capabilities, context awareness, and intelligent assistance throughout the UI. All AI features are documented comprehensively in the AI Integration documentation set.

### Key Components

**Frontend:**

- **GlobalAIAssistant** (`src/frontend/src/components/ai/GlobalAIAssistant.tsx`): Omnipresent floating AI assistant accessible from every page via bottom-right button or Cmd+/ shortcut
- **EnhancedAIService** (`src/frontend/src/services/enhancedAIService.ts`): Service layer providing streaming responses, background tasks, context-aware requests, and proactive suggestions
- **AIContext** (`src/frontend/src/contexts/AIContext.tsx`): Tracks current page, route, and user actions for context-aware AI interactions
- **ConversationalAIChat** (`src/frontend/src/components/ai/ConversationalAIChat.tsx`): Core chat interface with multi-turn conversation support

**Backend:**

- **AI Routes** (`src/backend/routes/ai_routes.py`): REST endpoints for chat, agents, workflows, tools, analytics
- **Conversational MCP Service** (`src/backend/services/conversational_mcp_service.py`): Multi-turn conversation orchestration with state persistence
- **MCP Service** (`src/backend/services/mcp_service.py`): Model Context Protocol integration with 16 tools, 7 resources, 6 prompts
- **AI Agents**: ScheduleOptimizerAgent, EmployeeManagerAgent with specialized scheduling capabilities

### Development Guidelines

**When Working with AI Features:**

1. **Read Documentation First**: Always check `docs/AI_INTEGRATION_MASTER_INDEX.md` before making AI-related changes
2. **Follow Patterns**: Use established patterns from EnhancedAIService for new AI integrations
3. **Context Awareness**: Always include page context in AI requests using `AIContext.getContextSummary()`
4. **Streaming Support**: Prefer streaming responses for better UX; use Server-Sent Events (SSE) pattern
5. **Background Tasks**: Use background task system for long-running operations (>3 seconds)
6. **Error Handling**: AI failures should gracefully degrade, never block user workflows
7. **Testing**: Test AI features with both successful and error scenarios

**Quick Actions Pattern:**

- Page-specific actions (e.g., "Optimize Schedule" on calendar page)
- Use EnhancedAIService methods: `optimizeSchedule()`, `resolveConflicts()`, `balanceWorkload()`, etc.
- Always provide feedback during execution (loading states, progress indicators)
- Handle errors gracefully with user-friendly messages

**Proactive Suggestions:**

- System generates context-aware suggestions automatically
- Displayed in GlobalAIAssistant badge and suggestion list
- Users can dismiss or act on suggestions
- Backend analyzes current page/state to generate relevant suggestions

### Key Files for AI Work

**Essential Documentation:**

- `docs/AI_INTEGRATION_MASTER_INDEX.md` - Start here! Central navigation for all AI docs
- `docs/AI_INTEGRATION_GETTING_STARTED.md` - Quick start guide
- `docs/AI_INTEGRATION_ENHANCEMENT_PLAN.md` - Complete technical specification (800+ lines)
- `docs/AI_INTEGRATION_IMPLEMENTATION_ROADMAP.md` - Task checklist with progress tracking

**Core Code:**

- Frontend AI: `src/frontend/src/components/ai/`, `src/frontend/src/services/enhancedAIService.ts`
- Backend AI: `src/backend/routes/ai_routes.py`, `src/backend/services/conversational_mcp_service.py`
- Context: `src/frontend/src/contexts/AIContext.tsx`

### MCP Integration

The application uses Model Context Protocol (MCP) for AI tool integration:

- **16 Tools**: CRUD operations for employees, schedules, absences, shift templates, etc.
- **7 Resources**: Read-only access to system config, employees, schedules, coverage, etc.
- **6 Prompts**: Guided workflows for schedule analysis, optimization, conflict resolution, etc.

See `docs/MCP_INTEGRATION_GUIDE.md` for complete MCP API reference.

### Current Status (October 2025)

- ✅ Phase 1 (Core Infrastructure): 40% complete
- ✅ GlobalAIAssistant: Fully implemented and integrated
- ✅ EnhancedAIService: Complete with streaming/tasks/context support
- 🚧 Backend streaming endpoint: In progress
- 🔴 Background task system: Not started
- 🔴 Page-specific AI integrations: Planned

## 5. Additional Notes

- **Do not modify files outside your responsibility without coordination.**
- **Always check for existing scripts or utilities before writing new ones.**
- **Review logs regularly for silent failures or warnings.**
- **If in doubt, document your decisions in `docs/core_concepts.md` or a new file.**

---

_Last updated: 2025-10-10_
