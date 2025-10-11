# AI Components Availability Action Plan

**Date:** October 11, 2025  
**Context:** AI components currently unavailable but core tools are available  
**Goal:** Restore full AI functionality while maintaining core tool stability

---

## 🎯 Situation Analysis

### Current Status

- ✅ **Core MCP Tools:** Available and functional (16+ tools)
- ✅ **Backend Infrastructure:** MCP routes, AI routes, services present
- ⚠️ **AI Components:** Currently unavailable (UI shows as unavailable)
- ✅ **Database:** Connected and operational
- ✅ **API Endpoints:** Registered and responding

### Root Cause Analysis

AI components may be unavailable due to:

1. Missing AI provider API keys (OpenAI/Anthropic/Gemini)
2. Service initialization failures
3. Frontend-backend communication issues
4. Service health check failures

---

## 📋 Action Plan

### Phase 1: Diagnostics (5-10 minutes)

#### Task 1.1: Check Service Health

**What to do:**

```bash
# Check backend logs
tail -f instance/logs/app.log

# Test MCP health
curl http://localhost:5000/api/v2/mcp/health

# Test AI services status
curl http://localhost:5000/api/v2/ai/services/status

# Check MCP status
curl http://localhost:5000/api/v2/mcp/status
```

**Expected outputs:**

- MCP health: `{"status": "healthy", "mcp_service": "active"}`
- AI services: List of services with availability status
- MCP status: Dashboard with tool count and health

**Files to check:**

- `instance/logs/app.log` - Application startup logs
- `instance/logs/errors.log` - Error logs
- Backend console output

#### Task 1.2: Verify Service Initialization

**Check in code:**

```python
# File: src/backend/app.py
# Look for init_ai_services() call
# Check if services are initialized on startup
```

**What to verify:**

- Are AI services initialized in `create_app()`?
- Are there any import errors?
- Are environment variables set?

#### Task 1.3: Check API Key Configuration

**Locations to check:**

1. Environment variables:

   ```bash
   echo $OPENAI_API_KEY
   echo $ANTHROPIC_API_KEY
   echo $GEMINI_API_KEY
   ```

2. Backend settings:

   - Settings UI: Navigate to `/settings`
   - Check AI provider configuration section
   - Verify API key status

3. Configuration files:
   - `.env` file in project root
   - `src/backend/config.py`

---

### Phase 2: Quick Fixes (10-15 minutes)

#### Task 2.1: Enable Basic AI Services

**File:** `src/backend/app.py`

**Action:** Ensure services are initialized even without API keys (graceful degradation)

```python
def init_ai_services(app):
    """Initialize AI services with graceful degradation."""
    global mcp_service, agent_registry, workflow_coordinator, conversation_manager

    try:
        # Initialize MCP service (always available)
        mcp_service = SchichtplanMCPService(app)
        logger.info("✅ MCP Service initialized")

        # Initialize conversation manager (no API key required for basic functionality)
        conversation_manager = SimpleConversationManager()
        logger.info("✅ Conversation Manager initialized")

        # Initialize agent registry (basic functionality)
        agent_registry = AgentRegistry()
        logger.info("✅ Agent Registry initialized")

        # Initialize workflow coordinator (basic functionality)
        workflow_coordinator = WorkflowCoordinator()
        logger.info("✅ Workflow Coordinator initialized")

        logger.info("🎉 All AI services initialized successfully")

    except Exception as e:
        logger.error(f"⚠️ AI services initialization error: {e}")
        logger.info("🔧 AI services will operate in limited mode")
```

**Expected result:** Services available in basic mode even without API keys

#### Task 2.2: Update Service Status Endpoint

**File:** `src/backend/routes/ai_routes.py`

**Action:** Ensure status endpoint returns accurate availability

```python
@ai_bp.route("/services/status", methods=["GET"])
def get_services_status():
    """Get detailed status of all AI services."""
    try:
        status = {
            "overall_health": "healthy",
            "timestamp": datetime.now().isoformat(),
            "services": {
                "conversation_manager": {
                    "available": conversation_manager is not None,
                    "status": "active" if conversation_manager else "inactive",
                    "mode": "limited" if not has_api_keys() else "full"
                },
                "mcp_service": {
                    "available": mcp_service is not None,
                    "status": "active" if mcp_service else "inactive",
                    "mode": "core_tools_only"
                },
                # ... rest of services
            },
            "api_keys": {
                "openai": bool(os.getenv("OPENAI_API_KEY")),
                "anthropic": bool(os.getenv("ANTHROPIC_API_KEY")),
                "gemini": bool(os.getenv("GEMINI_API_KEY"))
            }
        }
        return jsonify(status)
    except Exception as e:
        logger.error(f"Service status error: {e}")
        return jsonify({"error": str(e)}), 500
```

#### Task 2.3: Add Fallback Responses

**File:** `src/backend/routes/ai_routes.py`

**Action:** Provide helpful fallback when API keys missing

```python
@ai_bp.route("/chat", methods=["POST"])
def chat():
    """Chat endpoint with graceful fallback."""
    try:
        data = request.get_json()
        message = data.get("message", "")

        # Check if AI providers available
        if not has_api_keys():
            return jsonify({
                "status": "limited",
                "response": "AI chat is currently in limited mode. To enable full AI capabilities, please configure API keys in Settings. You can still use MCP tools and basic scheduling features.",
                "available_actions": [
                    "Use MCP tools in AI Dashboard → Tools tab",
                    "Configure API keys in Settings",
                    "Use manual schedule generation"
                ]
            })

        # Normal AI processing...

    except Exception as e:
        logger.error(f"Chat error: {e}")
        return jsonify({"error": str(e)}), 500
```

---

### Phase 3: Frontend Updates (10-15 minutes)

#### Task 3.1: Update AI Service Status Display

**File:** `src/frontend/src/components/ai/AISettingsPanel.tsx`

**Action:** Show clear status and guidance

```typescript
// Add status display
{
  providerStatus.length === 0 && (
    <Alert>
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>AI Providers Not Configured</AlertTitle>
      <AlertDescription>
        To enable full AI capabilities, please configure at least one AI
        provider:
        <ul className="mt-2 ml-4 list-disc">
          <li>OpenAI (GPT-4, GPT-3.5)</li>
          <li>Anthropic (Claude)</li>
          <li>Google Gemini</li>
        </ul>
        <Button
          className="mt-2"
          variant="outline"
          onClick={() => setShowKeyConfig(true)}
        >
          Configure API Keys
        </Button>
      </AlertDescription>
    </Alert>
  );
}
```

#### Task 3.2: Add Graceful Degradation in UI

**File:** `src/frontend/src/components/ai/ConversationalAIChat.tsx`

**Action:** Show availability status

```typescript
// Add at top of chat interface
{
  !aiAvailable && (
    <Alert variant="warning" className="mb-4">
      <Info className="h-4 w-4" />
      <AlertTitle>Limited AI Mode</AlertTitle>
      <AlertDescription>
        AI chat is currently unavailable. You can still: • Use MCP tools for
        schedule management • Access core scheduling features • Configure AI
        providers in Settings
      </AlertDescription>
    </Alert>
  );
}
```

#### Task 3.3: Update GlobalAIChat Status

**File:** `src/frontend/src/components/ai/GlobalAIChat.tsx`

**Action:** Show service status indicator

```typescript
// Add status indicator
const [serviceStatus, setServiceStatus] = useState<
  "available" | "limited" | "unavailable"
>("checking");

useEffect(() => {
  (async () => {
    try {
      const response = await fetch("/api/v2/ai/services/status");
      const data = await response.json();

      if (data.overall_health === "healthy" && data.api_keys) {
        setServiceStatus("available");
      } else {
        setServiceStatus("limited");
      }
    } catch {
      setServiceStatus("unavailable");
    }
  })();
}, []);
```

---

### Phase 4: Testing & Verification (5-10 minutes)

#### Task 4.1: Test Core Tools

```bash
# Test MCP tool execution
curl -X POST http://localhost:5000/api/v2/mcp/execute-tool \
  -H "Content-Type: application/json" \
  -d '{"tool": "manage_employees", "parameters": {"operation": "list"}}'

# Expected: Tool executes successfully
```

#### Task 4.2: Test Service Status

```bash
# Check all services
curl http://localhost:5000/api/v2/ai/services/status

# Expected: Returns status with availability information
```

#### Task 4.3: Test Frontend

**Manual testing:**

1. Open AI Dashboard (`/ai`)
2. Check Overview tab - should show status
3. Check Tools tab - should list available tools
4. Try executing a tool
5. Check Settings tab - should show configuration options

---

### Phase 5: API Key Configuration (If needed)

#### Task 5.1: Configure API Keys

**Option 1: Via UI (Recommended)**

1. Navigate to `/settings`
2. Go to AI Settings section
3. Enter API keys for desired providers
4. Click "Save" and "Test Connection"

**Option 2: Via Environment Variables**

```bash
# Add to .env file
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GEMINI_API_KEY=...

# Restart backend
```

**Option 3: Via Settings File**

```python
# File: src/backend/config.py
class Config:
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
    ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
```

#### Task 5.2: Verify API Keys

```python
# Test script
import os
from src.backend.services.ai_integration import create_ai_orchestrator

# Check if keys are set
print("OpenAI:", "✅" if os.getenv("OPENAI_API_KEY") else "❌")
print("Anthropic:", "✅" if os.getenv("ANTHROPIC_API_KEY") else "❌")
print("Gemini:", "✅" if os.getenv("GEMINI_API_KEY") else "❌")

# Test connection
try:
    orchestrator = create_ai_orchestrator()
    print("AI Orchestrator:", "✅ Created successfully")
except Exception as e:
    print(f"AI Orchestrator: ❌ {e}")
```

---

## 🔍 Troubleshooting Guide

### Issue 1: MCP Tools Not Working

**Symptoms:** Tools panel empty or tools fail to execute

**Solutions:**

1. Check MCP service status: `curl http://localhost:5000/api/v2/mcp/status`
2. Verify MCP routes registered: Check app.py blueprint registration
3. Check logs: `tail -f instance/logs/app.log | grep MCP`
4. Restart backend: `./start.sh`

### Issue 2: AI Chat Returns Errors

**Symptoms:** Chat shows error messages or "unavailable"

**Solutions:**

1. Check service status: `/api/v2/ai/services/status`
2. Verify conversation manager initialized
3. Check for API key issues
4. Try with mock/fallback responses enabled

### Issue 3: Services Show as Inactive

**Symptoms:** Settings panel shows services as unavailable

**Solutions:**

1. Check service initialization in app.py
2. Verify no import errors: Check logs at startup
3. Ensure services initialized before first request
4. Try restarting with `--with-mcp` flag: `./start.sh --with-mcp`

### Issue 4: Frontend Shows "Unavailable"

**Symptoms:** UI displays "AI components unavailable"

**Solutions:**

1. Check browser console for errors
2. Verify API endpoints responding: Network tab
3. Check CORS configuration: ai_routes.py
4. Verify frontend service calls: aiService.ts

---

## 📊 Success Criteria

### Core Tools ✅ (Already Working)

- [ ] MCP tools panel shows 16+ tools
- [ ] Tools execute successfully
- [ ] Execution logs display
- [ ] Error handling works

### AI Services 🎯 (Target)

- [ ] Service status endpoint returns accurate data
- [ ] Services initialize even without API keys
- [ ] Graceful degradation messages shown
- [ ] Clear guidance for configuration

### User Experience 🌟 (Goal)

- [ ] Users understand current limitations
- [ ] Clear path to enable full functionality
- [ ] Core features remain accessible
- [ ] No confusing error messages

---

## 🚀 Quick Start Checklist

**For immediate basic functionality:**

1. **Check backend is running:**

   ```bash
   curl http://localhost:5000/api/v2/mcp/health
   ```

2. **Verify MCP tools available:**

   ```bash
   curl http://localhost:5000/api/v2/mcp/tools
   ```

3. **Test a tool:**

   ```bash
   curl -X POST http://localhost:5000/api/v2/mcp/execute-tool \
     -H "Content-Type: application/json" \
     -d '{"tool": "manage_employees", "parameters": {"operation": "list"}}'
   ```

4. **Check service status in UI:**

   - Navigate to `/ai` (AI Dashboard)
   - Go to "Overview" tab
   - Check service status indicators

5. **If issues found:**
   - Check logs: `instance/logs/app.log`
   - Restart: `./start.sh --with-mcp`
   - Follow troubleshooting guide above

---

## 📝 Implementation Priority

**Immediate (Do Now):**

1. ✅ Verify MCP tools working
2. ✅ Check service health endpoints
3. ✅ Review initialization logs
4. ⚠️ Update service status display

**Short-term (Next Hour):**

1. Implement graceful degradation
2. Add clear status messages
3. Update frontend components
4. Test all flows

**Long-term (Next Session):**

1. Configure API keys (if desired)
2. Enable full AI features
3. Test advanced features
4. Update documentation

---

## 🎯 Expected Outcomes

### Without API Keys (Basic Mode)

- ✅ MCP tools fully functional
- ✅ Core scheduling features working
- ✅ Service status visible
- ⚠️ AI chat in limited mode
- ⚠️ No AI-powered generation
- ℹ️ Clear upgrade path shown

### With API Keys (Full Mode)

- ✅ All features above
- ✅ AI chat fully functional
- ✅ AI-powered schedule generation
- ✅ Natural language processing
- ✅ Advanced analytics

---

## 📞 Next Steps

1. **Run diagnostics** (Phase 1)
2. **Implement quick fixes** (Phase 2)
3. **Update UI** (Phase 3)
4. **Test thoroughly** (Phase 4)
5. **Configure API keys if desired** (Phase 5)

**Timeline:** 30-45 minutes for basic restoration  
**Difficulty:** Medium (requires code changes)  
**Risk:** Low (core tools remain functional)

---

**Created by:** GitHub Copilot  
**Date:** October 11, 2025  
**Status:** Ready for implementation  
**Priority:** Medium (core tools working, AI enhancement)
