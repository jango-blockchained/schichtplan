# AI features – overview and current status

This document summarizes the AI capabilities currently present in the project, their implementation locations (frontend and backend), and status.

## Backend capabilities

- MCP server and tools

  - What: Model Context Protocol service exposing the app as tools, prompts and health data.
  - Where:
    - `src/backend/mcp_server.py` (entrypoint CLI; stdio/SSE/HTTP)
    - `src/backend/services/mcp_service.py` (registers tools/prompts; health/status; handles requests)
    - `src/backend/routes/mcp_routes.py` (Flask endpoints: `/api/v2/mcp/status`, `/api/v2/mcp/tools`, `/api/v2/mcp/health`, `/api/v2/mcp/test-tool`, `/api/v2/mcp/config`)
    - Tool categories registered from:
      - `src/backend/services/mcp_tools/schedule_analysis.py`
      - `src/backend/services/mcp_tools/employee_management.py`
      - `src/backend/services/mcp_tools/coverage_optimization.py`
      - `src/backend/services/mcp_tools/crud_operations.py`
      - `src/backend/services/mcp_tools/ai_schedule_generation.py`
      - `src/backend/services/mcp_tools/ml_optimization.py`
      - `src/backend/services/mcp_tools/schedule_scenario.py`
  - Status: Implemented and wired; HTTP/SSE listed as “deprecated for compatibility” in run methods but available. Health/status and tool discovery endpoints implemented.

- Conversational AI (multi‑step schedule generation)

  - What: Server‑side conversation manager for guided schedule generation flow with states (analyze → recommendations → generate → adjust → finalize), plus preview of optimized data pack.
  - Where:
    - `src/backend/services/ai_conversation_service.py` (core logic/state machine)
    - `src/backend/routes/ai_conversation_routes.py` (`/api/v2/ai-conversation/conversation[...])` and preview endpoint
  - Status: Implemented with graceful fallbacks. Generation uses `AISchedulerService`, requires provider API key for full AI path; returns friendly errors if missing.

- General AI routes, agents, workflows (v2)

  - What: Unified AI API for chat, agents registry, workflow coordinator, analytics, and MCP tool execution.
  - Where: `src/backend/routes/ai_routes.py`
    - Key endpoints (under `/api/v2/ai`): `/chat`, `/agents`, `/workflows/*`, `/tools` and `/tools/execute`, `/settings`, `/services/status`, etc.
    - Initializes services: `SchichtplanMCPService`, `AgentRegistry`, `WorkflowCoordinator`, and a simple conversation manager via `init_ai_services` in app start (`src/backend/app.py`).
  - Status: Endpoints present; services init guarded and tolerant to missing providers; routing to MCP service for chat implemented. Agent/workflow pieces are present and currently “basic/experimental”.

- AI provider orchestration and adapters
  - What: Abstractions for OpenAI/Anthropic/Gemini, model selection, tool calling, streaming.
  - Where: `src/backend/services/ai_integration.py`
  - Status: Implemented as provider layer; usage by higher‑level services depends on configured API keys.

## Frontend capabilities

- AI Dashboard

  - What: A central page to access chat, MCP tools, agents, workflows, analytics and settings.
  - Where: `src/frontend/src/pages/AIDashboardPage.tsx`
    - Components:
      - `components/ai/ConversationalAIChat.tsx` – chat UI (calls `aiService.sendChatMessage`)
      - `components/ai/MCPToolsPanel.tsx` – tool browser/executor (currently mock data)
      - `components/ai/AgentDashboard.tsx`, `components/ai/WorkflowOrchestrator.tsx`, `components/ai/AIAnalytics.tsx`, `components/ai/AISettingsPanel.tsx`
  - Status: Implemented UI. Chat is functional via backend `/api/v2/ai/chat`. MCP tools UI uses mocked tool data; planned to connect to `/api/v2/mcp/tools`.

- Global AI hooks and services

  - `src/frontend/src/services/aiService.ts` – wrapper for `/api/v2/ai/*` endpoints (chat, agents, workflows, settings)
  - `src/frontend/src/services/aiConversationService.ts` – wrapper for `/api/v2/ai-conversation/*` multi‑step flow
  - `src/frontend/services/mcpClient.ts` – MCP client service (health, tools, status dashboard). Not yet widely used in pages.
  - `src/frontend/src/hooks/useAIConversation.ts` – client‑side conversation state (local persistence) with pluggable `onSendPrompt`.
  - Status: Implemented. Integrations are in place for dashboard and schedule flows; MCP client is foundational but not connected across the app.

- Schedule page AI integration
  - What: AI generation modals and prompts during planning.
  - Where: `src/frontend/src/pages/SchedulePage.tsx` plus:
    - `components/Schedule/ClassicAIGenerationDialog.tsx`
    - `components/modals/DetailedAIGenerationModal.tsx`
    - `components/Schedule/AIConversationGenerationDialog.tsx`
    - `components/dock/ActionDock.tsx` (quick AI prompt templates; emits `onAIPrompt`)
    - `hooks/useScheduleActions.ts` (AI preview/import)
  - Status: Implemented UI with partial backend integration: preview data and imports connect to API; prompt‑to‑action wiring exists but not centralized; uses `useAIConversation` locally in modals.

## Feature status summary

- Conversational AI (chat)

  - Backend: `/api/v2/ai/chat` implemented; uses MCP for reasoning/tool routing; conversations saved via simple manager.
  - Frontend: Chat component on AI Dashboard only; schedule modals use a separate local hook.
  - Status: Partial – works on dashboard and within modals, not available globally on every page.

- MCP tool discovery and execution

  - Backend: Implemented – `/api/v2/mcp/tools`, `/api/v2/mcp/status`, `/api/v2/mcp/health`, and `/api/v2/mcp/test-tool`.
  - Frontend: MCPToolsPanel UI present but using mocked data; `mcpClient.ts` can query real endpoints.
  - Status: Partial – needs wiring to live endpoints and an execution UX.

- AI schedule generation (guided)

  - Backend: `ai_conversation_service.py` + routes; uses `AISchedulerService` and DB.
  - Frontend: Dialogs/modals exist; preview/import flows implemented; requires API key for full AI generation.
  - Status: Partial – works in parts, blocked if provider keys absent.

- Agents and workflows
  - Backend: AgentRegistry/WorkflowCoordinator stubs and endpoints present; MCP handle_request supports workflow or agent paths.
  - Frontend: Dashboard components exist; primarily visualization.
  - Status: Experimental/Partial – ready for incremental enablement.

## Notable integration points

- App bootstrap: `src/backend/app.py` registers AI and MCP blueprints and initializes AI services on startup (non‑testing).
- Frontend routing: AI dashboard at `/ai` (`src/frontend/src/App.tsx`).
- Page layouts: no global chat widget yet; candidates: `src/frontend/src/layouts/MainLayout.tsx` or `PageLayout.tsx`.

## Known gaps and opportunities

- Global availability: Conversational AI is not mounted across all pages.
- MCP UI: Tools panel uses mock; no live discovery/execute path.
- Context sharing: Page context (date range, version, selection) isn’t injected by default into chat/tool calls.
- Multiple AI entry points: Chat (dashboard), schedule modals, AI conversation – need consolidation and shared state.
- Provider config: Clear UI to reflect missing API keys and offer non‑AI fallbacks.
