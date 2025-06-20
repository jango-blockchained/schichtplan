"""
Conversational MCP Service for Schichtplan

This module extends the existing MCP service with conversational AI capabilities,
enabling multi-turn interactions and intelligent tool usage.
"""

import asyncio
import json
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastmcp import Context

from .ai_integration import AIOrchestrator, AIRequest, create_ai_orchestrator
from .conversation_manager import (
    ContextItem,
    ConversationContext,
    ConversationGoal,
    ConversationManager,
    ConversationPriority,
    ConversationState,
    create_conversation_manager,
)
from .mcp_service import SchichtplanMCPService


class ConversationalSchichtplanMCPService:
    """Enhanced MCP service with conversational AI capabilities."""

    def __init__(
        self,
        base_mcp_service: SchichtplanMCPService,
        conversation_manager: ConversationManager,
        ai_orchestrator: AIOrchestrator,
    ):
        self.base_service = base_mcp_service
        self.conversation_manager = conversation_manager
        self.ai_orchestrator = ai_orchestrator
        self.logger = logging.getLogger(__name__)

        # Get the MCP instance from base service
        self.mcp = base_mcp_service.mcp

        # Register conversational tools
        self._register_conversational_tools()

        # Register conversation lifecycle hooks
        self._register_lifecycle_hooks()

    def _register_conversational_tools(self):
        """Register new conversational MCP tools."""

        @self.mcp.tool()
        async def start_conversation(
            user_id: Optional[str] = None,
            session_id: Optional[str] = None,
            initial_goal: Optional[str] = None,
            ai_personality: str = "helpful_scheduler",
            ctx: Context = None,
        ) -> Dict[str, Any]:
            """Start a new conversational AI session.

            Args:
                user_id: Optional user identifier
                session_id: Optional session identifier
                initial_goal: Initial goal for the conversation
                ai_personality: AI personality to use

            Returns:
                Conversation context and initial AI response
            """
            try:
                # Create initial goal if provided
                goals = []
                if initial_goal:
                    goal = ConversationGoal(
                        id=f"goal_{datetime.now().timestamp()}",
                        description=initial_goal,
                        type="user_request",
                        priority=ConversationPriority.NORMAL,
                        status="pending",
                    )
                    goals.append(goal)

                # Create conversation
                context = await self.conversation_manager.create_conversation(
                    user_id=user_id,
                    session_id=session_id,
                    goals=goals,
                    ai_personality=ai_personality,
                )

                # Generate initial AI response
                initial_response = await self._generate_initial_response(context)

                # Update conversation state
                await self.conversation_manager.set_state(
                    context.conversation_id, ConversationState.ACTIVE
                )

                if ctx:
                    await ctx.info(f"Started conversation {context.conversation_id}")

                return {
                    "conversation_id": context.conversation_id,
                    "session_id": context.session_id,
                    "state": context.state.value,
                    "ai_response": initial_response,
                    "goals": [goal.description for goal in context.goals],
                    "created_at": context.created_at.isoformat(),
                }

            except Exception as e:
                if ctx:
                    await ctx.error(f"Failed to start conversation: {str(e)}")
                raise

        @self.mcp.tool()
        async def continue_conversation(
            conversation_id: str,
            user_input: str,
            additional_context: Optional[Dict[str, Any]] = None,
            ctx: Context = None,
        ) -> Dict[str, Any]:
            """Continue an existing conversation.

            Args:
                conversation_id: ID of the conversation to continue
                user_input: User's input/message
                additional_context: Optional additional context

            Returns:
                AI response and updated conversation state
            """
            try:
                # Get conversation
                context = await self.conversation_manager.get_conversation(
                    conversation_id
                )
                if not context:
                    raise ValueError(f"Conversation {conversation_id} not found")

                # Add user input to context
                user_context_item = ContextItem(
                    id=f"user_input_{datetime.now().timestamp()}",
                    type="user_input",
                    content=user_input,
                    timestamp=datetime.now(),
                    relevance_score=1.0,
                )

                await self.conversation_manager.add_context_item(
                    conversation_id, user_context_item
                )

                # Set processing state
                await self.conversation_manager.set_state(
                    conversation_id, ConversationState.PROCESSING
                )

                # Generate AI response
                ai_response = await self._process_conversational_input(
                    context, user_input, additional_context
                )

                # Add AI response to context
                ai_context_item = ContextItem(
                    id=f"ai_response_{datetime.now().timestamp()}",
                    type="ai_response",
                    content=ai_response,
                    timestamp=datetime.now(),
                    relevance_score=0.8,
                )

                await self.conversation_manager.add_context_item(
                    conversation_id, ai_context_item
                )

                # Update conversation state
                await self.conversation_manager.set_state(
                    conversation_id, ConversationState.ACTIVE
                )

                if ctx:
                    await ctx.info(f"Continued conversation {conversation_id}")

                return {
                    "conversation_id": conversation_id,
                    "ai_response": ai_response.get("content", ""),
                    "tool_calls_made": ai_response.get("tool_calls", []),
                    "state": ConversationState.ACTIVE.value,
                    "context_items": len(context.context_items),
                    "timestamp": datetime.now().isoformat(),
                }

            except Exception as e:
                if ctx:
                    await ctx.error(f"Failed to continue conversation: {str(e)}")
                raise

        @self.mcp.tool()
        async def get_conversation_status(
            conversation_id: str, ctx: Context = None
        ) -> Dict[str, Any]:
            """Get current conversation status and context.

            Args:
                conversation_id: ID of the conversation

            Returns:
                Conversation status and metadata
            """
            try:
                context = await self.conversation_manager.get_conversation(
                    conversation_id
                )
                if not context:
                    return {"error": f"Conversation {conversation_id} not found"}

                metrics = await self.conversation_manager.get_conversation_metrics(
                    conversation_id
                )

                return {
                    "conversation_id": conversation_id,
                    "state": context.state.value,
                    "created_at": context.created_at.isoformat(),
                    "updated_at": context.updated_at.isoformat(),
                    "goals": [
                        {
                            "id": goal.id,
                            "description": goal.description,
                            "status": goal.status,
                            "type": goal.type,
                        }
                        for goal in context.goals
                    ],
                    "current_goal": context.current_goal,
                    "context_items_count": len(context.context_items),
                    "tools_used": context.tools_used,
                    "ai_personality": context.ai_personality,
                    "metrics": metrics,
                }

            except Exception as e:
                if ctx:
                    await ctx.error(f"Failed to get conversation status: {str(e)}")
                raise

        @self.mcp.tool()
        async def guided_schedule_optimization(
            conversation_id: str,
            start_date: str,
            end_date: str,
            optimization_goals: Optional[List[str]] = None,
            ctx: Context = None,
        ) -> Dict[str, Any]:
            """Start a guided schedule optimization conversation.

            Args:
                conversation_id: ID of the conversation
                start_date: Start date for optimization (YYYY-MM-DD)
                end_date: End date for optimization (YYYY-MM-DD)
                optimization_goals: List of optimization goals

            Returns:
                AI-guided optimization process results
            """
            try:
                context = await self.conversation_manager.get_conversation(
                    conversation_id
                )
                if not context:
                    raise ValueError(f"Conversation {conversation_id} not found")

                # Add optimization goal
                opt_goal = ConversationGoal(
                    id=f"optimization_{datetime.now().timestamp()}",
                    description=f"Optimize schedule from {start_date} to {end_date}",
                    type="optimization",
                    priority=ConversationPriority.HIGH,
                    status="in_progress",
                    success_criteria={
                        "start_date": start_date,
                        "end_date": end_date,
                        "goals": optimization_goals or [],
                    },
                )

                await self.conversation_manager.add_goal(conversation_id, opt_goal)

                # Start guided optimization process
                optimization_result = await self._start_guided_optimization(
                    context, start_date, end_date, optimization_goals
                )

                if ctx:
                    await ctx.info(f"Started guided optimization for {conversation_id}")

                return optimization_result

            except Exception as e:
                if ctx:
                    await ctx.error(f"Failed to start guided optimization: {str(e)}")
                raise

        @self.mcp.tool()
        async def ai_schedule_analysis(
            conversation_id: str,
            analysis_type: str = "comprehensive",
            specific_focus: Optional[List[str]] = None,
            ctx: Context = None,
        ) -> Dict[str, Any]:
            """Perform AI-driven schedule analysis with conversation.

            Args:
                conversation_id: ID of the conversation
                analysis_type: Type of analysis (comprehensive, conflict, coverage, workload)
                specific_focus: Specific areas to focus on

            Returns:
                AI analysis results with recommendations
            """
            try:
                context = await self.conversation_manager.get_conversation(
                    conversation_id
                )
                if not context:
                    raise ValueError(f"Conversation {conversation_id} not found")

                # Perform AI-driven analysis
                analysis_result = await self._perform_ai_analysis(
                    context, analysis_type, specific_focus
                )

                if ctx:
                    await ctx.info(f"Completed AI analysis for {conversation_id}")

                return analysis_result

            except Exception as e:
                if ctx:
                    await ctx.error(f"Failed to perform AI analysis: {str(e)}")
                raise

        @self.mcp.tool()
        async def end_conversation(
            conversation_id: str, summary: Optional[str] = None, ctx: Context = None
        ) -> Dict[str, Any]:
            """End a conversation and generate summary.

            Args:
                conversation_id: ID of the conversation to end
                summary: Optional summary of the conversation

            Returns:
                Conversation summary and final state
            """
            try:
                context = await self.conversation_manager.get_conversation(
                    conversation_id
                )
                if not context:
                    return {"error": f"Conversation {conversation_id} not found"}

                # Generate summary if not provided
                if not summary:
                    summary = await self._generate_conversation_summary(context)

                # Update conversation state
                await self.conversation_manager.set_state(
                    conversation_id, ConversationState.COMPLETED
                )

                # Get final metrics
                metrics = await self.conversation_manager.get_conversation_metrics(
                    conversation_id
                )

                if ctx:
                    await ctx.info(f"Ended conversation {conversation_id}")

                return {
                    "conversation_id": conversation_id,
                    "final_state": ConversationState.COMPLETED.value,
                    "summary": summary,
                    "goals_completed": [
                        goal.description
                        for goal in context.goals
                        if goal.status == "completed"
                    ],
                    "tools_used": context.tools_used,
                    "duration_seconds": metrics.get("duration_seconds", 0),
                    "context_items": metrics.get("context_items_count", 0),
                    "ended_at": datetime.now().isoformat(),
                }

            except Exception as e:
                if ctx:
                    await ctx.error(f"Failed to end conversation: {str(e)}")
                raise

    async def _generate_initial_response(
        self, context: ConversationContext
    ) -> Dict[str, Any]:
        """Generate initial AI response for new conversation."""

        # Prepare initial prompt
        initial_goals = [goal.description for goal in context.goals]

        prompt = f"""Hello! I'm your AI scheduling assistant. I'm here to help you with:

{", ".join(initial_goals) if initial_goals else "Any scheduling tasks you need assistance with"}

I can help you with:
- Schedule optimization and conflict resolution
- Employee workload analysis and balancing  
- Coverage requirement analysis
- What-if scenario planning
- Policy and compliance checking

What would you like to work on today? Feel free to describe your scheduling challenge or ask me any questions."""

        # Create AI request
        ai_request = AIRequest(
            conversation_id=context.conversation_id,
            prompt=prompt,
            context={
                "conversation_type": "initial_greeting",
                "goals": initial_goals,
                "personality": context.ai_personality,
            },
        )

        # Generate response (this is a simple initial response, no tool calls needed)
        return {
            "content": prompt,
            "tool_calls": [],
            "timestamp": datetime.now().isoformat(),
        }

    async def _process_conversational_input(
        self,
        context: ConversationContext,
        user_input: str,
        additional_context: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Process user input and generate AI response with potential tool usage."""

        # Prepare conversation context for AI
        conversation_context = self._prepare_conversation_context(context)

        # Get available tools
        available_tools = await self._get_available_tools()

        # Prepare prompt using template
        prompt = self.ai_orchestrator.prompt_manager.generate_prompt(
            "conversational_scheduler",
            {
                "task_description": user_input,
                "context_summary": self._summarize_context(context),
                "available_tools": ", ".join(
                    [tool["name"] for tool in available_tools]
                ),
            },
            conversation_context,
        )

        # Create AI request
        ai_request = AIRequest(
            conversation_id=context.conversation_id,
            prompt=prompt,
            tools=available_tools,
            context=conversation_context,
            model_preferences=["gpt-4o", "claude-3-5-sonnet-20241022"],
        )

        # Generate AI response
        ai_response = await self.ai_orchestrator.process_request(ai_request)

        # Execute any tool calls
        tool_results = []
        if ai_response.tool_calls:
            tool_results = await self._execute_tool_calls(
                context, ai_response.tool_calls
            )

        # Update conversation with tool results
        for tool_result in tool_results:
            tool_context_item = ContextItem(
                id=f"tool_result_{datetime.now().timestamp()}",
                type="tool_result",
                content=tool_result,
                timestamp=datetime.now(),
                relevance_score=0.9,
            )

            await self.conversation_manager.add_context_item(
                context.conversation_id, tool_context_item
            )

        return {
            "content": ai_response.content,
            "tool_calls": [
                {"name": tc.name, "arguments": tc.arguments, "reasoning": tc.reasoning}
                for tc in ai_response.tool_calls
            ],
            "tool_results": tool_results,
            "model_used": ai_response.model_used,
            "tokens_used": ai_response.tokens_used,
            "confidence": ai_response.confidence,
            "timestamp": datetime.now().isoformat(),
        }

    async def _start_guided_optimization(
        self,
        context: ConversationContext,
        start_date: str,
        end_date: str,
        optimization_goals: Optional[List[str]],
    ) -> Dict[str, Any]:
        """Start a guided schedule optimization process."""

        # First, analyze current schedule
        current_analysis = await self._call_base_tool(
            "analyze_schedule_conflicts",
            {"start_date": start_date, "end_date": end_date},
        )

        # Get schedule statistics
        statistics = await self._call_base_tool(
            "get_schedule_statistics", {"start_date": start_date, "end_date": end_date}
        )

        # Prepare optimization prompt
        optimization_context = {
            "current_analysis": current_analysis,
            "statistics": statistics,
            "date_range": f"{start_date} to {end_date}",
            "goals": optimization_goals
            or ["balance_workload", "minimize_conflicts", "ensure_coverage"],
        }

        prompt = self.ai_orchestrator.prompt_manager.generate_prompt(
            "optimization_consultant",
            {
                "schedule_status": json.dumps(current_analysis, indent=2),
                "optimization_goals": ", ".join(optimization_context["goals"]),
                "constraints": "Labor law compliance, employee preferences, coverage requirements",
                "current_metrics": json.dumps(statistics, indent=2),
            },
            optimization_context,
        )

        # Generate optimization plan
        ai_request = AIRequest(
            conversation_id=context.conversation_id,
            prompt=prompt,
            tools=await self._get_available_tools(),
            context=optimization_context,
        )

        ai_response = await self.ai_orchestrator.process_request(ai_request)

        return {
            "optimization_plan": ai_response.content,
            "current_analysis": current_analysis,
            "statistics": statistics,
            "recommended_actions": [
                {"tool": tc.name, "parameters": tc.arguments, "reasoning": tc.reasoning}
                for tc in ai_response.tool_calls
            ],
            "next_steps": "The AI has analyzed your schedule and provided recommendations. Would you like me to implement any of these suggestions?",
            "conversation_id": context.conversation_id,
        }

    async def _perform_ai_analysis(
        self,
        context: ConversationContext,
        analysis_type: str,
        specific_focus: Optional[List[str]],
    ) -> Dict[str, Any]:
        """Perform AI-driven schedule analysis."""

        # Determine what data to gather based on analysis type
        if analysis_type == "comprehensive":
            # Get multiple data sources
            tasks = [
                self._call_base_tool(
                    "get_schedule_statistics",
                    {"start_date": "2025-06-01", "end_date": "2025-06-30"},
                ),
                self._call_base_tool(
                    "analyze_schedule_conflicts",
                    {"start_date": "2025-06-01", "end_date": "2025-06-30"},
                ),
                self._call_base_tool("get_coverage_requirements", {}),
            ]

            results = await asyncio.gather(*tasks, return_exceptions=True)

        elif analysis_type == "conflict":
            results = [
                await self._call_base_tool(
                    "analyze_schedule_conflicts",
                    {"start_date": "2025-06-01", "end_date": "2025-06-30"},
                )
            ]

        elif analysis_type == "coverage":
            results = [await self._call_base_tool("get_coverage_requirements", {})]

        else:  # workload
            results = [
                await self._call_base_tool(
                    "get_schedule_statistics",
                    {"start_date": "2025-06-01", "end_date": "2025-06-30"},
                )
            ]

        # Prepare analysis prompt
        analysis_data = json.dumps(
            [r for r in results if not isinstance(r, Exception)], indent=2
        )

        prompt = f"""Please analyze the following schedule data and provide insights:

Analysis Type: {analysis_type}
Focus Areas: {", ".join(specific_focus) if specific_focus else "General analysis"}

Data:
{analysis_data}

Please provide:
1. Key findings and patterns
2. Identified issues or opportunities
3. Specific recommendations with priorities
4. Suggested next steps
5. Risk assessment for any proposed changes

Be specific and actionable in your recommendations."""

        ai_request = AIRequest(
            conversation_id=context.conversation_id,
            prompt=prompt,
            context={"analysis_type": analysis_type, "focus": specific_focus},
        )

        ai_response = await self.ai_orchestrator.process_request(ai_request)

        return {
            "analysis_type": analysis_type,
            "ai_insights": ai_response.content,
            "data_analyzed": results,
            "focus_areas": specific_focus,
            "confidence": ai_response.confidence,
            "model_used": ai_response.model_used,
            "timestamp": datetime.now().isoformat(),
        }

    async def _execute_tool_calls(
        self, context: ConversationContext, tool_calls: List
    ) -> List[Dict[str, Any]]:
        """Execute AI-requested tool calls."""

        results = []

        for tool_call in tool_calls:
            try:
                # Call the appropriate base service tool
                result = await self._call_base_tool(tool_call.name, tool_call.arguments)

                # Track tool usage
                if tool_call.name not in context.tools_used:
                    context.tools_used.append(tool_call.name)

                # Store tool result
                context.tool_results[f"{tool_call.name}_{tool_call.id}"] = result

                results.append(
                    {
                        "tool_name": tool_call.name,
                        "tool_id": tool_call.id,
                        "arguments": tool_call.arguments,
                        "result": result,
                        "timestamp": datetime.now().isoformat(),
                    }
                )

            except Exception as e:
                self.logger.error(f"Tool call {tool_call.name} failed: {e}")
                results.append(
                    {
                        "tool_name": tool_call.name,
                        "tool_id": tool_call.id,
                        "arguments": tool_call.arguments,
                        "error": str(e),
                        "timestamp": datetime.now().isoformat(),
                    }
                )

        return results

    async def _call_base_tool(self, tool_name: str, arguments: Dict[str, Any]) -> Any:
        """Call a tool from the base MCP service."""

        # Map tool calls to base service methods
        tool_mapping = {
            "analyze_schedule_conflicts": self.base_service.analyze_schedule_conflicts,
            "get_schedule_statistics": self.base_service.get_schedule_statistics,
            "get_coverage_requirements": self.base_service.get_coverage_requirements,
            "get_employee_availability": self.base_service.get_employee_availability,
            "get_absences": self.base_service.get_absences,
            "optimize_schedule_ai": self.base_service.optimize_schedule_ai,
            "mcp_health_check": self.base_service.mcp_health_check,
        }

        if tool_name not in tool_mapping:
            raise ValueError(f"Unknown tool: {tool_name}")

        tool_func = tool_mapping[tool_name]

        # Call the tool with arguments
        return await tool_func(**arguments)

    async def _get_available_tools(self) -> List[Dict[str, Any]]:
        """Get list of available tools for AI."""

        return [
            {
                "name": "analyze_schedule_conflicts",
                "description": "Analyze schedule for conflicts and issues",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "start_date": {
                            "type": "string",
                            "description": "Start date (YYYY-MM-DD)",
                        },
                        "end_date": {
                            "type": "string",
                            "description": "End date (YYYY-MM-DD)",
                        },
                    },
                    "required": ["start_date", "end_date"],
                },
            },
            {
                "name": "get_schedule_statistics",
                "description": "Get comprehensive schedule statistics",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "start_date": {
                            "type": "string",
                            "description": "Start date (YYYY-MM-DD)",
                        },
                        "end_date": {
                            "type": "string",
                            "description": "End date (YYYY-MM-DD)",
                        },
                    },
                    "required": ["start_date", "end_date"],
                },
            },
            {
                "name": "get_coverage_requirements",
                "description": "Get coverage requirements for scheduling",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "query_date": {
                            "type": "string",
                            "description": "Specific date (YYYY-MM-DD)",
                        }
                    },
                },
            },
            {
                "name": "get_employee_availability",
                "description": "Get employee availability information",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "employee_id": {
                            "type": "integer",
                            "description": "Employee ID",
                        },
                        "start_date": {
                            "type": "string",
                            "description": "Start date (YYYY-MM-DD)",
                        },
                        "end_date": {
                            "type": "string",
                            "description": "End date (YYYY-MM-DD)",
                        },
                    },
                },
            },
            {
                "name": "get_absences",
                "description": "Get employee absence information",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "employee_id": {
                            "type": "integer",
                            "description": "Employee ID",
                        },
                        "start_date": {
                            "type": "string",
                            "description": "Start date (YYYY-MM-DD)",
                        },
                        "end_date": {
                            "type": "string",
                            "description": "End date (YYYY-MM-DD)",
                        },
                    },
                },
            },
        ]

    def _prepare_conversation_context(
        self, context: ConversationContext
    ) -> Dict[str, Any]:
        """Prepare conversation context for AI."""

        recent_items = sorted(
            context.context_items, key=lambda x: x.timestamp, reverse=True
        )[:10]  # Last 10 items

        return {
            "conversation_id": context.conversation_id,
            "goals": [goal.description for goal in context.goals],
            "current_goal": context.current_goal,
            "recent_context": [
                {
                    "type": item.type,
                    "content": str(item.content)[:500],  # Truncate long content
                    "timestamp": item.timestamp.isoformat(),
                    "relevance": item.relevance_score,
                }
                for item in recent_items
            ],
            "tools_used": context.tools_used,
            "ai_personality": context.ai_personality,
            "user_preferences": context.user_preferences,
        }

    def _summarize_context(self, context: ConversationContext) -> str:
        """Create a summary of conversation context."""

        if not context.context_items:
            return "No previous context available."

        recent_items = sorted(
            context.context_items, key=lambda x: x.timestamp, reverse=True
        )[:5]

        summary_parts = []
        for item in recent_items:
            if item.type == "user_input":
                summary_parts.append(f"User said: {str(item.content)[:100]}...")
            elif item.type == "ai_response":
                summary_parts.append(f"AI responded: {str(item.content)[:100]}...")
            elif item.type == "tool_result":
                summary_parts.append(f"Tool result available: {item.content}")

        return " | ".join(summary_parts)

    async def _generate_conversation_summary(self, context: ConversationContext) -> str:
        """Generate a summary of the conversation."""

        # Prepare context for summarization
        conversation_data = {
            "duration": (context.updated_at - context.created_at).total_seconds() / 60,
            "goals": [goal.description for goal in context.goals],
            "tools_used": context.tools_used,
            "context_items": len(context.context_items),
            "key_interactions": [
                str(item.content)[:200]
                for item in context.context_items
                if item.type in ["user_input", "ai_response"]
            ][-5:],  # Last 5 interactions
        }

        prompt = f"""Please summarize this scheduling conversation:

Duration: {conversation_data["duration"]:.1f} minutes
Goals: {", ".join(conversation_data["goals"])}
Tools Used: {", ".join(conversation_data["tools_used"])}
Total Interactions: {conversation_data["context_items"]}

Key Interactions:
{chr(10).join(conversation_data["key_interactions"])}

Please provide a concise summary including:
1. What was accomplished
2. Key decisions made
3. Outstanding items or next steps
4. Overall outcome"""

        ai_request = AIRequest(
            conversation_id=context.conversation_id,
            prompt=prompt,
            context={"task": "summarization"},
        )

        try:
            ai_response = await self.ai_orchestrator.process_request(ai_request)
            return ai_response.content
        except Exception as e:
            self.logger.error(f"Failed to generate AI summary: {e}")
            return f"Conversation completed. Goals: {', '.join(conversation_data['goals'])}. Tools used: {', '.join(conversation_data['tools_used'])}."

    def _register_lifecycle_hooks(self):
        """Register conversation lifecycle hooks."""

        def on_conversation_create(context: ConversationContext):
            self.logger.info(f"Conversation created: {context.conversation_id}")

        def on_conversation_complete(context: ConversationContext):
            self.logger.info(f"Conversation completed: {context.conversation_id}")

        def on_conversation_error(context: ConversationContext):
            self.logger.error(f"Conversation error: {context.conversation_id}")

        # Register hooks
        self.conversation_manager.register_hook("on_create", on_conversation_create)
        self.conversation_manager.register_hook("on_complete", on_conversation_complete)
        self.conversation_manager.register_hook("on_error", on_conversation_error)


# Factory function
async def create_conversational_mcp_service(
    base_mcp_service: SchichtplanMCPService,
    redis_url: str = "redis://localhost:6379",
    openai_key: Optional[str] = None,
    anthropic_key: Optional[str] = None,
    gemini_key: Optional[str] = None,
) -> ConversationalSchichtplanMCPService:
    """Create conversational MCP service with all components."""

    # Create conversation manager
    conversation_manager = await create_conversation_manager(redis_url)

    # Create AI orchestrator
    ai_orchestrator = await create_ai_orchestrator(
        openai_key, anthropic_key, gemini_key
    )

    # Create conversational service
    return ConversationalSchichtplanMCPService(
        base_mcp_service, conversation_manager, ai_orchestrator
    )
