# Copilot Instructions Update Summary

## Date

October 10, 2025

## Overview

Updated `.github/copilot-instructions.md` with enhanced guidance for AI coding agents based on comprehensive codebase analysis.

## Key Enhancements

### 1. Branch Context Addition

- Added **Current Branch** context (`feature/week-navigation-only`) to help agents understand branch-specific focus
- Provides immediate orientation for branch-specific work

### 2. Enhanced Frontend API Integration Documentation

Added crucial details about the API client that weren't previously documented:

- **Browser console logging** - All requests/responses logged for debugging
- **Timeout configuration** - Via `API_TIMEOUT` constants in `@/constants`
- **Validate status function** - Proper HTTP status handling pattern
- **Type safety mandate** - Never duplicate type definitions, always import canonical types

### 3. Expanded Design System Guidelines

Enhanced layout component documentation with:

- **Detailed component descriptions** for each layout component
- **Spacing system specifics** - 4px-based system with explicit guidance
- **Complete example patterns** showing breadcrumbs, header actions, ContentGrid usage
- More prescriptive guidance on color semantics (`bg-muted`, `text-destructive`, etc.)

### 4. MCP Server Architecture Clarification

Added critical distinction between two MCP server variants:

- **Standard MCP** (`mcp_server.py`) - 16 tools, 7 resources, 6 prompts for basic AI integration
- **Conversational AI** (`start_conversational_ai.py`) - Multi-provider orchestration with state persistence
- Helps agents choose the right server for their needs

### 5. New AI Integration Architecture Section

Added comprehensive AI integration guidance covering:

**Frontend Components:**

- `GlobalAIAssistant.tsx` - Omnipresent assistant with keyboard shortcut (Cmd+/)
- `ConversationalAIChat.tsx` - Multi-turn conversations
- `enhancedAIService.ts` - Service layer patterns
- `AIContext.tsx` - Context-aware interactions

**Backend Services:**

- AI routes (`ai_routes.py`, `enhanced_ai_routes.py`)
- Conversational MCP service
- Enhanced agent registry with load balancing
- Specialized AI agents

**Development Guidelines:**

- Always read `AI_INTEGRATION_MASTER_INDEX.md` first
- Use established patterns from EnhancedAIService
- Include page context in all AI requests
- Prefer streaming responses via SSE
- Use background tasks for long operations
- Graceful degradation for AI failures

### 6. Critical Constraints Additions

Added two new "gotchas" that agents frequently encounter:

**#9 - Type Safety:**

- Frontend enforces strict TypeScript
- Canonical imports from `@/types/index.ts` and `@/services/api.ts`
- Never duplicate type definitions

**#10 - AI Context Awareness:**

- All AI features must use `AIContext`
- Never make AI requests without context summary
- Essential for proper AI assistant behavior

## Impact

These enhancements provide AI coding agents with:

1. **Immediate orientation** - Branch context and current focus areas
2. **Debugging workflows** - Console logging, timeout handling, validation
3. **Architecture understanding** - Clear distinction between MCP variants, AI integration layers
4. **Pattern enforcement** - Type safety, context awareness, layout components
5. **Common pitfalls** - Explicit warnings about type duplication, missing context

## Files Modified

- `.github/copilot-instructions.md` - Enhanced with 6 major improvements

## Validation

The updated instructions were validated against:

- Existing codebase patterns in 40+ key files
- Project documentation in `docs/` (50+ files analyzed)
- VS Code task configurations
- Package configurations (`pyproject.toml`, `package.json`, `bunfig.toml`)
- Recent implementation patterns in AI integration
- Logging and debugging infrastructure

## Next Steps for Users

**Review Areas to Consider:**

1. Does the current branch description accurately reflect your work focus?
2. Are there any project-specific commands or workflows not documented?
3. Are there recent architectural decisions that should be captured?
4. Are there any team-specific conventions that differ from the documented patterns?

**Feedback Requested:**

- Any unclear or incomplete sections?
- Missing workflows or commands you frequently use?
- Additional gotchas or constraints encountered in practice?
- AI integration patterns that differ from documented approach?

## Maintenance

To keep this file current:

1. Update branch context when switching major feature branches
2. Document new architectural patterns as they emerge
3. Add new gotchas as they're discovered
4. Update command references when workflows change
5. Review after major dependency updates (Bun, Python, etc.)
