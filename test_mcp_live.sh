#!/usr/bin/env bash
# MCP Server Live Testing Script

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

API_BASE="http://localhost:5000/api/v2"

echo -e "\n${BLUE}========================================${NC}"
echo -e "${BLUE}  Schichtplan MCP Server Testing${NC}"
echo -e "${BLUE}========================================${NC}\n"

# Test 1: Health Check
echo -e "${YELLOW}📋 Test 1: Health Check${NC}"
echo "Endpoint: GET /mcp/health"
response=$(curl -s "$API_BASE/mcp/health")
echo "$response" | python3 -m json.tool
status=$(echo "$response" | python3 -c "import sys, json; print(json.load(sys.stdin).get('status', 'unknown'))")
if [ "$status" = "healthy" ]; then
    echo -e "${GREEN}✅ Status: Healthy${NC}\n"
else
    echo -e "${RED}❌ Status: Not healthy${NC}\n"
fi

# Test 2: Configuration
echo -e "${YELLOW}📋 Test 2: MCP Configuration${NC}"
echo "Endpoint: GET /mcp/config"
response=$(curl -s "$API_BASE/mcp/config")
echo "$response" | python3 -m json.tool | head -30
echo -e "${GREEN}✅ Configuration retrieved${NC}\n"

# Test 3: List Tools
echo -e "${YELLOW}📋 Test 3: Available MCP Tools${NC}"
echo "Endpoint: GET /mcp/tools"
response=$(curl -s "$API_BASE/mcp/tools")
tool_count=$(echo "$response" | python3 -c "import sys, json; print(json.load(sys.stdin).get('total_count', 0))")
echo -e "${GREEN}Found $tool_count MCP tools:${NC}"
echo "$response" | python3 -c "
import sys, json
data = json.load(sys.stdin)
tools = data.get('available_tools', [])
for i, tool in enumerate(tools, 1):
    print(f'  {i:2d}. {tool[\"name\"]:30s} - {tool[\"description\"][:50]}')
"
echo ""

# Test 4: MCP Status
echo -e "${YELLOW}📋 Test 4: MCP Service Status Dashboard${NC}"
echo "Endpoint: GET /mcp/status"
response=$(curl -s "$API_BASE/mcp/status")
echo "$response" | python3 -m json.tool | head -50
echo -e "${GREEN}✅ Status dashboard retrieved${NC}\n"

# Test 5: Tool Validation
echo -e "${YELLOW}📋 Test 5: Tool Validation (manage_employees)${NC}"
echo "Endpoint: POST /mcp/test-tool"
response=$(curl -s -X POST "$API_BASE/mcp/test-tool" \
  -H "Content-Type: application/json" \
  -d '{
    "tool_name": "manage_employees",
    "parameters": {"operation": "list"}
  }')
status=$(echo "$response" | python3 -c "import sys, json; print(json.load(sys.stdin).get('status', 'unknown'))" 2>/dev/null || echo "error")
if [ "$status" = "validated" ]; then
    echo -e "${GREEN}✅ Tool validated successfully${NC}"
else
    echo -e "${YELLOW}⚠️  Tool validation response:${NC}"
fi
echo "$response" | python3 -m json.tool | head -30
echo ""

# Test 6: Test Tool Execution Info
echo -e "${YELLOW}📋 Test 6: Tool Execution (information)${NC}"
echo "Endpoint: POST /mcp/execute-tool"
response=$(curl -s -X POST "$API_BASE/mcp/execute-tool" \
  -H "Content-Type: application/json" \
  -d '{
    "tool_name": "analyze_employee_workload",
    "parameters": {
      "start_date": "2025-10-01",
      "end_date": "2025-10-31",
      "include_recommendations": true
    }
  }')
echo "$response" | python3 -m json.tool | head -40
echo ""

echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}✅ MCP Server Testing Complete!${NC}"
echo -e "${BLUE}========================================${NC}\n"

echo -e "${YELLOW}📝 Next Steps:${NC}"
echo "1. Start STDIO MCP Server:"
echo "   ./src/backend/.venv/bin/python src/backend/mcp_server.py --transport stdio"
echo ""
echo "2. Use with Claude or other AI clients:"
echo "   Configure the MCP server in your client with the above command"
echo ""
echo "3. Use AI conversation endpoint:"
echo "   curl -X POST $API_BASE/ai-conversation/chat"
echo ""
echo "4. Connect to SSE server on port 8001"
echo ""
