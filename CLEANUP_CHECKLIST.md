# AI Code Cleanup Checklist

**Status:** Ready for Implementation  
**Date:** 2025-10-23  
**Conservative Scope:** 3 Files to Delete, ~1,000 lines to comment out

---

## PHASE 1: Frontend Component Cleanup (3 Files)

### Delete these files:

- [ ] `src/frontend/src/components/ai/GlobalAIAssistant.tsx`

  - Size: 655 lines
  - Reason: Duplicate of UnifiedFloatingMenu
  - Already removed from: MainLayout.tsx import ✓
  - Status: Safe to delete

- [ ] `src/frontend/src/components/ai/ConversationalAIChatEnhanced.tsx`

  - Reason: Duplicate of ConversationalAIChat.tsx
  - Size: Unknown (duplicate)
  - Status: Safe to delete

- [ ] `src/frontend/src/components/ai/AISchedulerPanel.tsx`
  - Reason: Unused duplicate scheduler UI
  - Size: Unknown
  - Status: Safe to delete

**Verification after deletion:**

```bash
# Frontend should still compile
cd src/frontend && bun build

# No import errors
grep -r "GlobalAIAssistant\|ConversationalAIChatEnhanced\|AISchedulerPanel" src/frontend/src --exclude-dir=node_modules
```

---

## PHASE 2: Backend Route File Cleanup

### File 1: Comment out entire file

**File:** `src/backend/routes/enhanced_ai_routes.py` (800+ lines)

**Action:**

1. Add comment at top of file:

```python
"""
DEPRECATED: Phase 2 experimental features
Commented out for cleanup - contains:
- Voice endpoints (not implemented)
- File upload endpoints (not implemented)
- Real-time analytics (experimental)
- WebSocket handlers (experimental)
These can be re-enabled if features are needed later.
"""

# COMMENTED OUT - Phase 2 Features
# ========================================
# To re-enable, remove this block and uncomment the code below

"""
```

2. Comment out entire file content:

```bash
# Simple bash approach:
sed -i '1s/^/"""\n# COMMENTED OUT - Phase 2 Experimental Features\n"""\n\n/' src/backend/routes/enhanced_ai_routes.py
```

### File 2: Selective endpoint removal

**File:** `src/backend/routes/ai_routes.py` (~200 lines to comment)

**Keep these endpoints (ACTIVE):**

- `POST /ai/chat` - Main chat
- `POST /ai/chat/stream` - Streaming chat
- `POST /ai/tasks/background` - Background tasks
- `GET /ai/tasks/<task_id>/progress` - Task progress

**Comment out (Debug/Experimental):**

Find and comment:

```python
# Debug endpoints - rarely used
# @ai_bp.route("/health", methods=["GET"])
# @ai_bp.route("/test", methods=["GET"])
# @ai_bp.route("/debug/info", methods=["GET"])

# Experimental agent system - not implemented
# @ai_bp.route("/agents", methods=["GET"])
# @ai_bp.route("/agents/<agent_id>", methods=["GET"])
# @ai_bp.route("/agents/<agent_id>/details", methods=["GET"])
# @ai_bp.route("/agents/<agent_id>/toggle", methods=["POST"])

# Experimental workflow system - not implemented
# @ai_bp.route("/workflows/templates", methods=["GET"])
# @ai_bp.route("/workflows/execute", methods=["POST"])
# @ai_bp.route("/workflows/executions", methods=["GET"])

# Experimental tool execution - not implemented
# @ai_bp.route("/tools/execute", methods=["POST"])

# Experimental settings - not implemented
# @ai_bp.route("/settings", methods=["GET"])
# @ai_bp.route("/settings", methods=["POST"])

# Experimental analytics - not implemented
# @ai_bp.route("/analytics", methods=["GET"])
# @ai_bp.route("/performance", methods=["GET"])
# @ai_bp.route("/services/status", methods=["GET"])
# @ai_bp.route("/tools/analytics", methods=["GET"])
# @ai_bp.route("/agents/enhanced", methods=["GET"])
# @ai_bp.route("/agents/<agent_id>/performance", methods=["GET"])
```

**Verification:**

```bash
# Check that essential endpoints still exist
grep -n "@ai_bp.route(\"/chat\"" src/backend/routes/ai_routes.py
grep -n "@ai_bp.route(\"/tasks" src/backend/routes/ai_routes.py

# Try to start the server
python -m src.backend.run runserver
```

---

## PHASE 3: Backend Service Cleanup

### File 1: Comment out `ai_integration.py`

**File:** `src/backend/services/ai_integration.py`

**Action:**

1. Open file
2. Add comment block at top:

```python
"""
DEPRECATED: AI Orchestrator Integration
Commented out for cleanup - contains:
- create_ai_orchestrator() function not used anywhere
- Abandoned experimental AI features
Can be re-enabled if needed in the future.
"""

# COMMENTED OUT - Not used in current implementation
# ========================================
"""
[rest of file content wrapped in triple quotes]
"""
```

3. Or use Python comment wrap:

```bash
# Wrap entire file in triple quotes
sed -i '1i"""' src/backend/services/ai_integration.py
echo '"""' >> src/backend/services/ai_integration.py
```

### File 2: Comment out `enhanced_ai_conversation_handler.py`

**File:** `src/backend/services/enhanced_ai_conversation_handler.py`

**Action:** Same as above - add deprecation notice and comment out

### File 3: Comment out `enhanced_agent_registry.py`

**File:** `src/backend/services/enhanced_agent_registry.py`

**Action:** Same as above - add deprecation notice and comment out

**Verification:**

```bash
# Backend should still import without errors
python -c "from src.backend.app import create_app; app = create_app(); print('✓ App imports successfully')"

# Check that core services still work
python -c "from src.backend.services.conversational_mcp_service import create_conversational_mcp_service; print('✓ Core services import successfully')"
```

---

## PHASE 4: Testing & Verification

### Frontend Tests

```bash
cd src/frontend

# Build check
bun build

# Type check
bun run type-check

# Unit tests (if available)
bun test
```

### Backend Tests

```bash
cd src/backend

# Activate venv
source .venv/bin/activate

# Run tests
pytest -v

# Check that AI endpoints still work
curl -X POST http://localhost:5000/api/v2/ai/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"test"}'
```

### Manual Testing Checklist

- [ ] Start backend: `./start.sh`
- [ ] Start frontend: `cd src/frontend && bun dev`
- [ ] Check that AI chat opens (click menu button in bottom right)
- [ ] Send test message to AI
- [ ] Verify response returns
- [ ] No console errors
- [ ] Check that schedule generation works

---

## ROLLBACK INSTRUCTIONS

If anything breaks, easily rollback commented code:

### For commented files:

```bash
# Remove the comment block and uncomment
git checkout <file>
```

### For deleted files:

```bash
# Restore from git
git checkout <file>
```

### For partial endpoint comments:

```bash
# Restore specific endpoints
git checkout src/backend/routes/ai_routes.py
```

---

## BEFORE/AFTER METRICS

### Before Cleanup:

- AI-related files: 28
- Total AI code lines: ~6,500
- Unused/experimental: ~5,500 lines (85%)
- Active production: ~1,000 lines (15%)

### After Cleanup:

- AI-related files: 25 (3 deleted)
- Total AI code lines: ~5,500 (commented sections don't count)
- Unused/experimental: ~4,500 lines (commented)
- Active production: ~1,000 lines (unchanged)
- Size reduction: ~1,000 lines (15%)

---

## SIGN-OFF CHECKLIST

**Pre-Cleanup:**

- [ ] Code changes already applied (menu, width, FastMCP) ✓
- [ ] All 3 issues fixed and tested ✓
- [ ] Audit documentation complete ✓
- [ ] Conservative scope approved

**Cleanup Phase 1 (Frontend):**

- [ ] Delete 3 component files
- [ ] Frontend builds successfully
- [ ] No import errors
- [ ] Git status clean

**Cleanup Phase 2 (Backend Routes):**

- [ ] Comment out enhanced_ai_routes.py
- [ ] Comment out experimental endpoints in ai_routes.py
- [ ] Backend app imports successfully
- [ ] Active routes still work

**Cleanup Phase 3 (Backend Services):**

- [ ] Comment out ai_integration.py
- [ ] Comment out enhanced_ai_conversation_handler.py
- [ ] Comment out enhanced_agent_registry.py
- [ ] Backend app imports successfully

**Testing:**

- [ ] Backend tests pass: `pytest -v`
- [ ] Frontend builds: `bun build`
- [ ] Manual AI chat test passes
- [ ] Schedule generation works

**Final:**

- [ ] All changes committed
- [ ] Documentation updated
- [ ] Team notified
- [ ] PR created (if applicable)

---

## ESTIMATED TIME

- Frontend cleanup: 5 minutes
- Backend route cleanup: 10 minutes
- Backend service cleanup: 5 minutes
- Testing & verification: 15 minutes
- **Total: ~35 minutes**

---

## NOTES

- Conservative approach: Only remove true duplicates and debug code
- Keep all experimental features (may be implemented later)
- Keep all MCP tools (may be used by external clients)
- All changes are easily reversible with git
- Zero production impact expected

---

**Ready to proceed with cleanup? Follow the checklists above phase by phase.**
