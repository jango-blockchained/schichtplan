"""
DEPRECATED: Enhanced AI Conversation Handler

This module is a duplicate of ConversationalSchichtplanMCPService and is not used.
It is preserved for reference only.

The EnhancedAIConversationHandler class is not instantiated or imported anywhere.
Use ConversationalSchichtplanMCPService (src/backend/services/conversational_mcp_service.py) instead.

Last Updated: 2025-10-23 (Marked for removal)
"""

# ============================================================================
# COMMENTED OUT - DUPLICATE CONVERSATION HANDLER
# ============================================================================
# This entire module is deprecated (duplicate). See docstring above.
# To re-enable, uncomment the code below and update any imports.
# ============================================================================

"""
import json
import os
import re
from datetime import datetime, timedelta
from typing import Any

from src.backend.services.ai_integration import AIOrchestrator, AIRequest
from src.backend.services.conversation_manager import ConversationManager
from src.backend.services.mcp_service import SchichtplanMCPService
from src.backend.utils.logger import logger


class EnhancedAIConversationHandler:
    """Enhanced conversation handler with intelligent tool usage."""

    def __init__(
        self,
        mcp_service: SchichtplanMCPService,
        conversation_manager: ConversationManager,
        ai_orchestrator: AIOrchestrator | None = None,
    ):
        self.mcp_service = mcp_service
        self.conversation_manager = conversation_manager
        self.ai_orchestrator = ai_orchestrator
        self.tool_registry = self._initialize_tool_registry()

        # Load user AI prompt
        self.user_ai_prompt = self._load_user_ai_prompt()

    def _initialize_tool_registry(self) -> dict[str, dict[str, Any]]:
        """Initialize the tool registry with available tools."""
        return {
            "analyze_schedule_conflicts": {
                "description": "Analyze schedule for conflicts and issues",
                "parameters": ["start_date", "end_date"],
                "use_cases": ["conflicts", "problems", "issues", "analyze"],
                "priority": 1,
            },
            "get_employee_availability": {
                "description": "Get employee availability information",
                "parameters": ["employee_id", "start_date", "end_date"],
                "use_cases": ["availability", "free time", "when available"],
                "priority": 2,
            },
            "optimize_schedule_ai": {
                "description": "AI-powered schedule optimization",
                "parameters": ["start_date", "end_date", "optimization_goals"],
                "use_cases": ["optimize", "improve", "better schedule"],
                "priority": 1,
            },
            "get_coverage_requirements": {
                "description": "Get staffing coverage requirements",
                "parameters": ["query_date"],
                "use_cases": ["coverage", "staffing", "requirements"],
                "priority": 2,
            },
            "get_schedule_statistics": {
                "description": "Get comprehensive schedule analytics",
                "parameters": ["start_date", "end_date"],
                "use_cases": ["statistics", "analytics", "reports", "metrics"],
                "priority": 2,
            },
        }

    async def handle_conversation(
        self, message: str, conversation_id: str, context: dict[str, Any] | None = None
    ) -> dict[str, Any]:
        """Handle a conversation message with intelligent tool usage."""

        try:
            # Analyze the message to determine intent and required tools
            analysis = self._analyze_message_intent(message)

            # Get conversation context
            conversation = await self.conversation_manager.get_conversation(
                conversation_id
            )
            if not conversation:
                conversation = await self.conversation_manager.create_conversation(
                    user_id="web_user",
                    session_id=conversation_id,
                    title=f"Chat {datetime.now().strftime('%Y-%m-%d %H:%M')}",
                )

            # Execute tools if needed
            tool_results = {}
            if analysis["tools_needed"]:
                tool_results = await self._execute_tools(
                    analysis["tools_needed"], analysis["parameters"]
                )

            # Generate AI response
            response = await self._generate_intelligent_response(
                message, analysis, tool_results, conversation
            )

            return {
                "response": response["content"],
                "conversation_id": conversation_id,
                "metadata": {
                    "agent": response.get("agent", "enhanced_ai"),
                    "status": "success",
                    "tools_used": list(tool_results.keys()),
                    "processing_time": response.get("processing_time", 0),
                    "confidence": response.get("confidence", 0.8),
                    "intent": analysis["intent"],
                    "complexity": analysis["complexity"],
                },
            }

        except Exception as e:
            logger.app_logger.error(f"Enhanced conversation handling error: {e}")
            return {
                "response": "I encountered an error while processing your request. Please try again.",
                "conversation_id": conversation_id,
                "metadata": {
                    "agent": "system",
                    "status": "error",
                    "error_type": "conversation_handling_error",
                    "error": str(e),
                },
            }

    def _analyze_message_intent(self, message: str) -> dict[str, Any]:
        """Analyze message to determine intent and required tools."""

        message_lower = message.lower()

        # Intent classification
        intent = "general"
        if any(word in message_lower for word in ["optimize", "improve", "better"]):
            intent = "optimization"
        elif any(word in message_lower for word in ["conflict", "problem", "issue"]):
            intent = "conflict_resolution"
        elif any(
            word in message_lower for word in ["available", "availability", "free"]
        ):
            intent = "availability_query"
        elif any(
            word in message_lower for word in ["statistics", "analytics", "report"]
        ):
            intent = "analytics"
        elif any(
            word in message_lower for word in ["coverage", "staffing", "requirements"]
        ):
            intent = "coverage_analysis"

        # Determine complexity
        complexity = "simple"
        if len(message.split()) > 20:
            complexity = "complex"
        elif any(
            word in message_lower for word in ["comprehensive", "detailed", "full"]
        ):
            complexity = "detailed"

        # Determine tools needed
        tools_needed = []
        parameters = {}

        for tool_id, tool_info in self.tool_registry.items():
            if any(use_case in message_lower for use_case in tool_info["use_cases"]):
                tools_needed.append(tool_id)

        # Extract date parameters
        date_patterns = [
            r"next week",
            r"this week",
            r"next month",
            r"this month",
            r"\d{4}-\d{2}-\d{2}",
            r"\d{1,2}/\d{1,2}/\d{4}",
        ]

        dates_found = []
        for pattern in date_patterns:
            matches = re.findall(pattern, message_lower)
            dates_found.extend(matches)

        if dates_found:
            parameters["dates"] = dates_found
        else:
            # Default to next week
            today = datetime.now().date()
            start_of_week = today - timedelta(days=today.weekday())
            next_week_start = start_of_week + timedelta(days=7)
            next_week_end = next_week_start + timedelta(days=6)

            parameters["start_date"] = next_week_start.strftime("%Y-%m-%d")
            parameters["end_date"] = next_week_end.strftime("%Y-%m-%d")

        return {
            "intent": intent,
            "complexity": complexity,
            "tools_needed": sorted(
                tools_needed, key=lambda t: self.tool_registry[t]["priority"]
            ),
            "parameters": parameters,
            "confidence": 0.8,  # Could be enhanced with ML model
        }

    async def _execute_tools(
        self, tools_needed: list[str], parameters: dict[str, Any]
    ) -> dict[str, Any]:
        """Execute the required tools and collect results."""

        tool_results = {}

        for tool_id in tools_needed:
            try:
                # Prepare tool parameters
                tool_params = {}
                tool_info = self.tool_registry[tool_id]

                for param in tool_info["parameters"]:
                    if param in parameters:
                        tool_params[param] = parameters[param]
                    elif param == "start_date" and "start_date" in parameters:
                        tool_params[param] = parameters["start_date"]
                    elif param == "end_date" and "end_date" in parameters:
                        tool_params[param] = parameters["end_date"]

                # Execute tool via MCP service
                request_data = {
                    "tool_id": tool_id,
                    "parameters": tool_params,
                    "user_id": "web_user",
                    "request_type": "tool_execution",
                }

                result = await self.mcp_service.handle_request(request_data)
                tool_results[tool_id] = result

                logger.app_logger.info(f"Executed tool {tool_id} with result: {result}")

            except Exception as e:
                logger.app_logger.error(f"Tool execution error for {tool_id}: {e}")
                tool_results[tool_id] = {"error": str(e), "status": "failed"}

        return tool_results

    async def _generate_intelligent_response(
        self,
        message: str,
        analysis: dict[str, Any],
        tool_results: dict[str, Any],
        conversation: Any,
    ) -> dict[str, Any]:
        """Generate an intelligent response based on analysis and tool results."""

        start_time = datetime.now()

        # If we have AI orchestrator, use it for enhanced responses
        if self.ai_orchestrator and tool_results:
            try:
                # Prepare context for AI
                context = {
                    "user_message": message,
                    "intent": analysis["intent"],
                    "tool_results": tool_results,
                    "conversation_history": self._get_recent_messages(conversation),
                }

                # Create AI request
                ai_request = AIRequest(
                    conversation_id=conversation.id,
                    prompt=self._build_full_prompt(
                        self._create_enhanced_prompt(message, analysis, tool_results)
                    ),
                    tools=[],  # Tools already executed
                    context=context,
                    max_tokens=1000,
                    temperature=0.7,
                )

                # Get AI response
                ai_response = await self.ai_orchestrator.process_request(ai_request)

                return {
                    "content": ai_response.content,
                    "agent": "enhanced_ai_orchestrator",
                    "processing_time": (datetime.now() - start_time).total_seconds(),
                    "confidence": ai_response.confidence or 0.8,
                }

            except Exception as e:
                logger.app_logger.warning(
                    f"AI orchestrator failed, using fallback: {e}"
                )

        # Fallback: Generate response based on analysis and tool results
        return self._generate_fallback_response(
            message, analysis, tool_results, start_time
        )

    def _create_enhanced_prompt(
        self, message: str, analysis: dict[str, Any], tool_results: dict[str, Any]
    ) -> str:
        """Create an enhanced prompt for AI processing."""

        prompt = f"""You are an AI assistant specialized in employee scheduling and workforce management.

User Message: {message}

Analysis:
- Intent: {analysis["intent"]}
- Complexity: {analysis["complexity"]}
- Tools Used: {list(tool_results.keys())}

Tool Results:
"""

        for tool_id, result in tool_results.items():
            tool_desc = self.tool_registry[tool_id]["description"]
            prompt += f"\n{tool_id} ({tool_desc}):\n{json.dumps(result, indent=2)}\n"

        prompt += """
Based on the user's message and the tool results above, provide a helpful, detailed response that:
1. Addresses the user's specific request
2. Summarizes key findings from the tool results
3. Provides actionable recommendations
4. Uses a conversational, professional tone
5. Offers follow-up suggestions when appropriate

Response:"""

        return prompt

    def _get_recent_messages(
        self, conversation: Any, limit: int = 5
    ) -> list[dict[str, Any]]:
        """Get recent messages from conversation for context."""
        try:
            if hasattr(conversation, "messages"):
                recent_messages = (
                    conversation.messages[-limit:] if conversation.messages else []
                )
                return [
                    {
                        "type": msg.message_type,
                        "content": msg.content[:200],  # Truncate for context
                        "timestamp": msg.timestamp.isoformat()
                        if hasattr(msg, "timestamp")
                        else None,
                    }
                    for msg in recent_messages
                ]
        except Exception:
            pass
        return []

    def _generate_fallback_response(
        self,
        message: str,
        analysis: dict[str, Any],
        tool_results: dict[str, Any],
        start_time: datetime,
    ) -> dict[str, Any]:
        """Generate a fallback response when AI orchestrator is not available."""

        intent = analysis["intent"]

        if tool_results:
            # Generate response based on tool results
            if intent == "optimization":
                response = self._generate_optimization_response(tool_results)
            elif intent == "conflict_resolution":
                response = self._generate_conflict_response(tool_results)
            elif intent == "availability_query":
                response = self._generate_availability_response(tool_results)
            elif intent == "analytics":
                response = self._generate_analytics_response(tool_results)
            else:
                response = self._generate_general_response(tool_results)
        else:
            # No tools executed, provide general response
            response = f"""I understand you're asking about {intent.replace("_", " ")}. 
            
While I can help with scheduling tasks, I may need more specific information to provide detailed assistance. 

Could you please specify:
- The time period you're interested in (e.g., next week, specific dates)
- Which employees or departments are involved
- What specific outcomes you're looking for

I have access to tools for schedule analysis, optimization, availability checking, and reporting that can provide detailed insights once I have more context."""

        return {
            "content": response,
            "agent": "enhanced_fallback",
            "processing_time": (datetime.now() - start_time).total_seconds(),
            "confidence": 0.7,
        }

    def _generate_optimization_response(self, tool_results: dict[str, Any]) -> str:
        """Generate response for optimization requests."""
        response = (
            "I've analyzed your schedule optimization request. Here's what I found:\n\n"
        )

        for tool_id, result in tool_results.items():
            if tool_id == "optimize_schedule_ai":
                response += "🎯 **Schedule Optimization Results:**\n"
                response += f"- Status: {result.get('status', 'completed')}\n"
                if "improvements" in result:
                    response += (
                        f"- Improvements identified: {len(result['improvements'])}\n"
                    )
                response += "\n"
            elif tool_id == "analyze_schedule_conflicts":
                response += "⚠️ **Conflict Analysis:**\n"
                response += (
                    f"- Conflicts found: {result.get('conflicts_count', 'unknown')}\n"
                )
                response += "\n"

        response += "Would you like me to implement these optimizations or would you prefer to review them first?"
        return response

    def _generate_conflict_response(self, tool_results: dict[str, Any]) -> str:
        """Generate response for conflict resolution requests."""
        response = "I've analyzed your schedule for conflicts. Here's the summary:\n\n"

        for tool_id, result in tool_results.items():
            if tool_id == "analyze_schedule_conflicts":
                response += "📋 **Conflict Analysis Results:**\n"
                response += (
                    f"- Total conflicts: {result.get('conflicts_count', 'unknown')}\n"
                )
                response += (
                    f"- Critical issues: {result.get('critical_count', 'unknown')}\n"
                )
                response += "\n"

        response += "I can help resolve these conflicts automatically. Would you like me to proceed with conflict resolution?"
        return response

    def _generate_availability_response(self, tool_results: dict[str, Any]) -> str:
        """Generate response for availability queries."""
        response = "Here's the availability information you requested:\n\n"

        for tool_id, result in tool_results.items():
            if tool_id == "get_employee_availability":
                response += "📅 **Employee Availability:**\n"
                response += f"- Total employees checked: {result.get('employee_count', 'unknown')}\n"
                response += (
                    f"- Available slots: {result.get('available_slots', 'unknown')}\n"
                )
                response += "\n"

        response += (
            "Is there a specific time period or employee you'd like to focus on?"
        )
        return response

    def _generate_analytics_response(self, tool_results: dict[str, Any]) -> str:
        """Generate response for analytics requests."""
        response = "I've generated the analytics report you requested:\n\n"

        for tool_id, result in tool_results.items():
            if tool_id == "get_schedule_statistics":
                response += "📊 **Schedule Statistics:**\n"
                response += f"- Period analyzed: {result.get('period', 'unknown')}\n"
                response += (
                    f"- Total hours scheduled: {result.get('total_hours', 'unknown')}\n"
                )
                response += "\n"

        response += "Would you like me to generate a more detailed report or focus on specific metrics?"
        return response

    def _generate_general_response(self, tool_results: dict[str, Any]) -> str:
        """Generate general response when intent is unclear."""
        response = "I've gathered some information that might be helpful:\n\n"

        for tool_id, result in tool_results.items():
            tool_desc = self.tool_registry[tool_id]["description"]
            response += f"• {tool_desc}: {result.get('status', 'completed')}\n"

        response += "\nHow would you like me to help you with this information?"
        return response

    def _load_user_ai_prompt(self) -> str:
        """Load the user AI assistant prompt from file."""
        prompt_path = os.path.join(
            os.path.dirname(__file__), "prompts", "user_ai_assistant.md"
        )

        try:
            with open(prompt_path, encoding="utf-8") as f:
                prompt_content = f.read()
            logger.info("Successfully loaded user AI assistant prompt")
            return prompt_content
        except FileNotFoundError:
            logger.warning(f"User AI assistant prompt file not found at {prompt_path}")
            return self._get_default_user_ai_prompt()
        except Exception as e:
            logger.error(f"Error loading user AI assistant prompt: {e}")
            return self._get_default_user_ai_prompt()

    def _get_default_user_ai_prompt(self) -> str:
        """Return a default user AI assistant prompt if file loading fails."""
        return """# Schichtplan Assistant - Default Prompt

You are Schichtplan Assistant, a helpful workforce management companion.

## Your Role
- Help employees navigate schedules and understand their shifts
- Assist managers with scheduling decisions and optimization
- Provide clear, professional communication
- Focus on scheduling and workforce management topics

## Guidelines
- Be friendly and professional
- Provide practical, actionable advice
- Reference specific dates, times, and contexts when relevant
- Stay focused on scheduling and workforce management"""

    def _build_full_prompt(self, user_prompt: str) -> str:
        """Build the full prompt by combining user AI prompt with specific request."""
        if self.user_ai_prompt:
            return f"{self.user_ai_prompt}\n\n---\n\n{user_prompt}"
        return user_prompt


async def create_enhanced_conversation_handler(
    mcp_service: SchichtplanMCPService,
    conversation_manager: ConversationManager,
    ai_orchestrator: AIOrchestrator | None = None,
) -> EnhancedAIConversationHandler:
    """Create an enhanced conversation handler."""
    return EnhancedAIConversationHandler(
        mcp_service=mcp_service,
        conversation_manager=conversation_manager,
        ai_orchestrator=ai_orchestrator,
    )

"""
# End of commented out deprecated conversation handler
