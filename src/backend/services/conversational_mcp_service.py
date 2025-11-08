"""
Conversational MCP Service for Schichtplan

This module extends the existing MCP service with conversational AI capabilities,
enabling multi-turn interactions and intelligent tool usage.
"""

import asyncio
import json
import logging
from datetime import datetime
from typing import Any

from fastmcp import Context

from src.backend.utils.ai_rate_limiter import RateLimitConfig, get_rate_limiter
from src.backend.utils.ai_retry import (
    AI_REQUEST_RETRY_CONFIG,
    CircuitBreaker,
    retry_async,
)
from src.backend.utils.ai_validation import ValidationError, validate_ai_request

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

        # Get user AI prompt from base service
        self.user_ai_prompt = getattr(base_mcp_service, "user_ai_prompt", "")

        # Initialize rate limiter
        self.rate_limiter = get_rate_limiter(
            RateLimitConfig(
                requests_per_minute=20,
                requests_per_hour=200,
                tokens_per_minute=100000,
                tokens_per_hour=1000000,
                burst_allowance=10,
            )
        )

        # Initialize circuit breaker for AI requests
        self.ai_circuit_breaker = CircuitBreaker(
            failure_threshold=5, recovery_timeout=60.0, expected_exception=Exception
        )

        # Register conversational tools
        self._register_conversational_tools()

        # Register conversation lifecycle hooks
        self._register_lifecycle_hooks()

    def _build_full_prompt(self, user_prompt: str) -> str:
        """Build the full prompt by combining user AI prompt with task.

        This method ensures that the system-level AI assistant prompt is
        prepended to the task-specific prompt, providing the AI with:
        1. Role and personality definition
        2. Core capabilities and guidelines
        3. Important notes about the scheduling system

        Args:
            user_prompt: Task-specific or conversational prompt

        Returns:
            Full prompt combining system context and task
        """
        if self.user_ai_prompt:
            full_prompt = f"{self.user_ai_prompt}\n\n---\n\n{user_prompt}"
            self.logger.debug(
                f"Built full prompt: {len(self.user_ai_prompt)} chars "
                f"(system) + {len(user_prompt)} chars (task)"
            )
            return full_prompt
        self.logger.warning("No system AI prompt available, using task prompt only")
        return user_prompt

    def _register_conversational_tools(self):
        """Register new conversational MCP tools."""

        @self.mcp.tool()
        async def start_conversation(
            user_id: str | None = None,
            session_id: str | None = None,
            initial_goal: str | None = None,
            ai_personality: str = "helpful_scheduler",
            ctx: Context = None,
        ) -> dict[str, Any]:
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
            additional_context: dict[str, Any] | None = None,
            ctx: Context = None,
        ) -> dict[str, Any]:
            """Continue an existing conversation.

            Args:
                conversation_id: ID of the conversation to continue
                user_input: User's input/message
                additional_context: Optional additional context

            Returns:
                AI response and updated conversation state
            """
            try:
                # Validate inputs
                try:
                    validated = validate_ai_request(
                        message=user_input,
                        conversation_id=conversation_id,
                        context=additional_context,
                    )
                    user_input = validated["message"]
                    conversation_id = validated["conversation_id"]
                    additional_context = validated["context"]
                except ValidationError as e:
                    self.logger.error(f"Validation error: {e}")
                    return {"error": f"Invalid input: {str(e)}"}

                # Check rate limits
                rate_limit_result = await self.rate_limiter.check_rate_limit(
                    conversation_id=conversation_id,
                    estimated_tokens=len(user_input) * 2,
                )

                if not rate_limit_result["allowed"]:
                    self.logger.warning(
                        f"Rate limit exceeded: {rate_limit_result['reason']}"
                    )
                    return {
                        "error": "Rate limit exceeded",
                        "reason": rate_limit_result["reason"],
                        "retry_after": rate_limit_result["retry_after"],
                    }

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

                # Generate AI response with retry and circuit breaker
                @retry_async(
                    retryable_exceptions=(Exception,), config=AI_REQUEST_RETRY_CONFIG
                )
                async def process_with_ai():
                    return await self.ai_circuit_breaker.call(
                        self._process_conversational_input,
                        context,
                        user_input,
                        additional_context,
                    )

                ai_response = await process_with_ai()

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

            except ValidationError as e:
                self.logger.error(f"Validation error: {e}")
                if ctx:
                    await ctx.error(f"Validation error: {str(e)}")
                return {"error": f"Validation error: {str(e)}"}
            except Exception as e:
                self.logger.error(
                    f"Failed to continue conversation: {e}", exc_info=True
                )
                if ctx:
                    await ctx.error(f"Failed to continue conversation: {str(e)}")
                return {
                    "error": f"Internal error: {str(e)}",
                    "conversation_id": conversation_id,
                }

        @self.mcp.tool()
        async def get_conversation_status(
            conversation_id: str, ctx: Context = None
        ) -> dict[str, Any]:
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
            optimization_goals: list[str] | None = None,
            ctx: Context = None,
        ) -> dict[str, Any]:
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
            specific_focus: list[str] | None = None,
            ctx: Context = None,
        ) -> dict[str, Any]:
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
            conversation_id: str, summary: str | None = None, ctx: Context = None
        ) -> dict[str, Any]:
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
    ) -> dict[str, Any]:
        """Generate initial AI response for new conversation with context."""

        # Prepare initial goals
        initial_goals = [goal.description for goal in context.goals]

        # Build dynamic initial prompt based on goals and context
        if initial_goals:
            goals_list = "\n".join(f"- {goal}" for goal in initial_goals)
            goals_section = f"I'm here to help you with:\n{goals_list}"
        else:
            goals_section = "I'm here to assist you with any scheduling tasks."

        # Build capabilities section based on available tools
        capabilities = [
            "Schedule optimization and conflict resolution",
            "Employee workload analysis and balancing",
            "Coverage requirement analysis and gap identification",
            "What-if scenario planning and comparison",
            "Policy and compliance checking",
            "Employee availability and preference management",
            "Shift distribution optimization",
            "AI-driven insights and recommendations",
        ]

        capabilities_list = "\n".join(f"- {cap}" for cap in capabilities)

        prompt = f"""Hello! I'm your Schichtplan AI scheduling assistant.

{goals_section}

**My Capabilities:**
I can help you with:
{capabilities_list}

**How I Work:**
1. I analyze your current schedules and constraints
2. I identify issues, gaps, and opportunities
3. I provide data-driven recommendations
4. I can help implement changes and verify results
5. I support multi-step optimization workflows

**Conversation Context:**
- Active Goals: {len(context.goals)} goal(s) to track
- Personality: {context.ai_personality}
- Tools Available: Schedule analysis, employee management,
  coverage optimization, schedule management, time tracking
- User Preferences: {len(context.user_preferences)}
  preference(s) loaded

What would you like to work on today? Feel free to describe
your scheduling challenge or ask me any questions. You can
request specific analyses, generate optimized schedules,
or ask about any scheduling aspect of your organization."""

        # Log the initial response generation with context
        self.logger.debug(
            f"Generating initial response for conversation "
            f"{context.conversation_id} with {len(initial_goals)} goals"
        )

        # Prepare full prompt with system context
        full_initial_prompt = self._build_full_prompt(prompt)
        self.logger.debug(f"Full prompt length: {len(full_initial_prompt)} characters")

        # Generate response (structured initial response)
        return {
            "content": prompt,
            "tool_calls": [],
            "timestamp": datetime.now().isoformat(),
        }

    async def _process_conversational_input(
        self,
        context: ConversationContext,
        user_input: str,
        additional_context: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
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
            prompt=self._build_full_prompt(prompt),
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
        optimization_goals: list[str] | None,
    ) -> dict[str, Any]:
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
            prompt=self._build_full_prompt(prompt),
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
        specific_focus: list[str] | None,
    ) -> dict[str, Any]:
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
            prompt=self._build_full_prompt(prompt),
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
        self, context: ConversationContext, tool_calls: list
    ) -> list[dict[str, Any]]:
        """Execute AI-requested tool calls with optimized parallel processing.

        Args:
            context: Conversation context
            tool_calls: List of tool calls to execute

        Returns:
            List of tool execution results
        """
        if not tool_calls:
            return []

        results = []

        # Group tool calls by independence
        # Independent tools can run in parallel, dependent ones must run sequentially
        independent_tools = []
        dependent_tools = []

        # Simple heuristic: read-only operations are independent
        read_only_tools = {
            "analyze_schedule_conflicts",
            "get_schedule_statistics",
            "get_coverage_requirements",
            "get_employee_availability",
            "get_absences",
        }

        for tool_call in tool_calls:
            if tool_call.name in read_only_tools:
                independent_tools.append(tool_call)
            else:
                dependent_tools.append(tool_call)

        # Execute independent tools in parallel with retry logic
        if independent_tools:
            self.logger.info(
                f"Executing {len(independent_tools)} independent tools in parallel"
            )

            async def execute_with_retry(tool_call):
                @retry_async(
                    retryable_exceptions=(Exception,),
                    config=AI_REQUEST_RETRY_CONFIG,
                )
                async def execute():
                    result = await self._call_base_tool(
                        tool_call.name, tool_call.arguments
                    )
                    # Track tool usage
                    if tool_call.name not in context.tools_used:
                        context.tools_used.append(tool_call.name)
                    # Store tool result
                    context.tool_results[f"{tool_call.name}_{tool_call.id}"] = result
                    return {
                        "tool_name": tool_call.name,
                        "tool_id": tool_call.id,
                        "arguments": tool_call.arguments,
                        "result": result,
                        "timestamp": datetime.now().isoformat(),
                    }

                try:
                    return await execute()
                except Exception as e:
                    self.logger.error(
                        f"Tool call {tool_call.name} failed after retries: {e}"
                    )
                    return {
                        "tool_name": tool_call.name,
                        "tool_id": tool_call.id,
                        "arguments": tool_call.arguments,
                        "error": str(e),
                        "timestamp": datetime.now().isoformat(),
                    }

            # Execute in parallel with proper exception handling
            parallel_results = await asyncio.gather(
                *[execute_with_retry(tc) for tc in independent_tools],
                return_exceptions=True,
            )

            # Filter out exceptions and add successful results
            for result in parallel_results:
                if isinstance(result, Exception):
                    self.logger.error(f"Parallel tool execution failed: {result}")
                    # Create error result entry
                    results.append(
                        {
                            "tool_name": "unknown",
                            "error": str(result),
                            "timestamp": datetime.now().isoformat(),
                        }
                    )
                else:
                    results.append(result)

        # Execute dependent tools sequentially with retry logic
        if dependent_tools:
            self.logger.info(
                f"Executing {len(dependent_tools)} dependent tools sequentially"
            )

            for tool_call in dependent_tools:
                try:

                    @retry_async(
                        retryable_exceptions=(Exception,),
                        config=AI_REQUEST_RETRY_CONFIG,
                    )
                    async def execute():
                        return await self._call_base_tool(
                            tool_call.name, tool_call.arguments
                        )

                    result = await execute()

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
                    self.logger.error(
                        f"Tool call {tool_call.name} failed after retries: {e}"
                    )
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

    async def _call_base_tool(self, tool_name: str, arguments: dict[str, Any]) -> Any:
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

    async def _get_available_tools(self) -> list[dict[str, Any]]:
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
    ) -> dict[str, Any]:
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
            prompt=self._build_full_prompt(prompt),
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
    openai_key: str | None = None,
    anthropic_key: str | None = None,
    gemini_key: str | None = None,
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
