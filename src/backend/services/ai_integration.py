"""
AI Integration Framework for Conversational Scheduling

This module provides the infrastructure for integrating with various AI providers,
managing prompts dynamically, and processing AI responses for tool usage.
"""

import json
import logging
import re
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, AsyncGenerator, Dict, List, Optional

import anthropic
import google.generativeai as genai
import openai

try:
    from .config import AIProviderConfig
except ImportError:
    # Handle case where config is not available
    AIProviderConfig = None


class AIProvider(Enum):
    """Supported AI providers."""

    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    GEMINI = "gemini"
    OLLAMA = "ollama"
    LOCAL = "local"


class ModelCapability(Enum):
    """AI model capabilities."""

    FUNCTION_CALLING = "function_calling"
    STRUCTURED_OUTPUT = "structured_output"
    LARGE_CONTEXT = "large_context"
    FAST_RESPONSE = "fast_response"
    COST_EFFECTIVE = "cost_effective"


@dataclass
class ModelInfo:
    """Information about an AI model."""

    provider: AIProvider
    model_id: str
    name: str
    max_tokens: int
    capabilities: List[ModelCapability]
    cost_per_token: float = 0.0
    response_time_avg: float = 0.0
    quality_score: float = 0.0


@dataclass
class PromptTemplate:
    """Dynamic prompt template with variables."""

    id: str
    name: str
    template: str
    variables: List[str]
    context_requirements: List[str] = field(default_factory=list)
    model_preferences: List[str] = field(default_factory=list)
    max_tokens: Optional[int] = None
    temperature: float = 0.7
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class AIRequest:
    """AI request with context and parameters."""

    conversation_id: str
    prompt: str
    tools: List[Dict[str, Any]] = field(default_factory=list)
    context: Dict[str, Any] = field(default_factory=dict)
    model_preferences: List[str] = field(default_factory=list)
    max_tokens: Optional[int] = None
    temperature: float = 0.7
    stream: bool = False
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ToolCall:
    """Represents an AI tool call request."""

    id: str
    name: str
    arguments: Dict[str, Any]
    reasoning: Optional[str] = None


@dataclass
class AIResponse:
    """AI response with tool calls and metadata."""

    conversation_id: str
    content: str
    tool_calls: List[ToolCall] = field(default_factory=list)
    model_used: str = ""
    tokens_used: int = 0
    response_time: float = 0.0
    cost: float = 0.0
    confidence: float = 0.0
    metadata: Dict[str, Any] = field(default_factory=dict)


class AIProviderInterface(ABC):
    """Abstract interface for AI providers."""

    @abstractmethod
    async def generate_response(self, request: AIRequest) -> AIResponse:
        """Generate AI response."""
        pass

    @abstractmethod
    async def stream_response(self, request: AIRequest) -> AsyncGenerator[str, None]:
        """Stream AI response."""
        pass

    @abstractmethod
    def get_available_models(self) -> List[ModelInfo]:
        """Get available models."""
        pass

    @abstractmethod
    async def validate_connection(self) -> bool:
        """Validate provider connection."""
        pass


class OpenAIProvider(AIProviderInterface):
    """OpenAI provider implementation."""

    def __init__(self, api_key: str, base_url: Optional[str] = None):
        self.client = openai.AsyncOpenAI(api_key=api_key, base_url=base_url)
        self.logger = logging.getLogger(__name__)

    async def generate_response(self, request: AIRequest) -> AIResponse:
        """Generate response using OpenAI."""
        start_time = datetime.now()

        # Prepare messages
        messages = [{"role": "user", "content": request.prompt}]

        # Prepare tools if any
        tools = None
        if request.tools:
            tools = [{"type": "function", "function": tool} for tool in request.tools]

        # Select model
        model = self._select_model(request.model_preferences)

        try:
            response = await self.client.chat.completions.create(
                model=model,
                messages=messages,
                tools=tools,
                max_tokens=request.max_tokens,
                temperature=request.temperature,
                stream=False,
            )

            # Process response
            message = response.choices[0].message
            content = message.content or ""

            # Extract tool calls
            tool_calls = []
            if message.tool_calls:
                for tc in message.tool_calls:
                    tool_calls.append(
                        ToolCall(
                            id=tc.id,
                            name=tc.function.name,
                            arguments=json.loads(tc.function.arguments),
                        )
                    )

            # Calculate metrics
            response_time = (datetime.now() - start_time).total_seconds()
            tokens_used = response.usage.total_tokens if response.usage else 0

            return AIResponse(
                conversation_id=request.conversation_id,
                content=content,
                tool_calls=tool_calls,
                model_used=model,
                tokens_used=tokens_used,
                response_time=response_time,
                cost=self._calculate_cost(model, tokens_used),
                confidence=self._extract_confidence(content),
            )

        except Exception as e:
            self.logger.error(f"OpenAI API error: {e}")
            raise

    async def stream_response(self, request: AIRequest) -> AsyncGenerator[str, None]:
        """Stream response using OpenAI."""
        messages = [{"role": "user", "content": request.prompt}]
        model = self._select_model(request.model_preferences)

        try:
            stream = await self.client.chat.completions.create(
                model=model,
                messages=messages,
                max_tokens=request.max_tokens,
                temperature=request.temperature,
                stream=True,
            )

            async for chunk in stream:
                if chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content

        except Exception as e:
            self.logger.error(f"OpenAI streaming error: {e}")
            raise

    def get_available_models(self) -> List[ModelInfo]:
        """Get available OpenAI models."""
        return [
            ModelInfo(
                provider=AIProvider.OPENAI,
                model_id="gpt-4o",
                name="GPT-4o",
                max_tokens=128000,
                capabilities=[
                    ModelCapability.FUNCTION_CALLING,
                    ModelCapability.STRUCTURED_OUTPUT,
                    ModelCapability.LARGE_CONTEXT,
                ],
                cost_per_token=0.000005,
                quality_score=0.95,
            ),
            ModelInfo(
                provider=AIProvider.OPENAI,
                model_id="gpt-4o-mini",
                name="GPT-4o Mini",
                max_tokens=128000,
                capabilities=[
                    ModelCapability.FUNCTION_CALLING,
                    ModelCapability.STRUCTURED_OUTPUT,
                    ModelCapability.FAST_RESPONSE,
                    ModelCapability.COST_EFFECTIVE,
                ],
                cost_per_token=0.000001,
                quality_score=0.85,
            ),
            ModelInfo(
                provider=AIProvider.OPENAI,
                model_id="gpt-3.5-turbo",
                name="GPT-3.5 Turbo",
                max_tokens=16384,
                capabilities=[
                    ModelCapability.FUNCTION_CALLING,
                    ModelCapability.FAST_RESPONSE,
                    ModelCapability.COST_EFFECTIVE,
                ],
                cost_per_token=0.0000005,
                quality_score=0.75,
            ),
        ]

    async def validate_connection(self) -> bool:
        """Validate OpenAI connection."""
        try:
            await self.client.models.list()
            return True
        except Exception:
            return False

    def _select_model(self, preferences: List[str]) -> str:
        """Select best model based on preferences."""
        available_models = {
            model.model_id: model for model in self.get_available_models()
        }

        # Check if preferred model is available
        for pref in preferences:
            if pref in available_models:
                return pref

        # Default to GPT-4o Mini for balance of cost and quality
        return "gpt-4o-mini"

    def _calculate_cost(self, model: str, tokens: int) -> float:
        """Calculate API cost."""
        model_info = next(
            (m for m in self.get_available_models() if m.model_id == model), None
        )
        if model_info:
            return tokens * model_info.cost_per_token
        return 0.0

    def _extract_confidence(self, content: str) -> float:
        """Extract confidence score from content."""
        # Simple heuristic - look for confidence indicators
        confidence_patterns = [
            r"confidence[:\s]*(\d+(?:\.\d+)?)",
            r"certain[:\s]*(\d+(?:\.\d+)?)",
            r"sure[:\s]*(\d+(?:\.\d+)?)",
        ]

        for pattern in confidence_patterns:
            match = re.search(pattern, content.lower())
            if match:
                return float(match.group(1)) / 100.0

        # Default confidence based on content length and definitiveness
        if "definitely" in content.lower() or "certainly" in content.lower():
            return 0.9
        elif "probably" in content.lower() or "likely" in content.lower():
            return 0.7
        elif "maybe" in content.lower() or "might" in content.lower():
            return 0.5

        return 0.8  # Default moderate confidence


class AnthropicProvider(AIProviderInterface):
    """Anthropic Claude provider implementation."""

    def __init__(self, api_key: str):
        self.client = anthropic.AsyncAnthropic(api_key=api_key)
        self.logger = logging.getLogger(__name__)

    async def generate_response(self, request: AIRequest) -> AIResponse:
        """Generate response using Anthropic."""
        start_time = datetime.now()

        # Prepare tools if any
        tools = request.tools if request.tools else None

        # Select model
        model = self._select_model(request.model_preferences)

        try:
            response = await self.client.messages.create(
                model=model,
                max_tokens=request.max_tokens or 4096,
                temperature=request.temperature,
                messages=[{"role": "user", "content": request.prompt}],
                tools=tools,
            )

            # Process response
            content = ""
            tool_calls = []

            for content_block in response.content:
                if content_block.type == "text":
                    content += content_block.text
                elif content_block.type == "tool_use":
                    tool_calls.append(
                        ToolCall(
                            id=content_block.id,
                            name=content_block.name,
                            arguments=content_block.input,
                        )
                    )

            # Calculate metrics
            response_time = (datetime.now() - start_time).total_seconds()
            tokens_used = response.usage.input_tokens + response.usage.output_tokens

            return AIResponse(
                conversation_id=request.conversation_id,
                content=content,
                tool_calls=tool_calls,
                model_used=model,
                tokens_used=tokens_used,
                response_time=response_time,
                cost=self._calculate_cost(model, tokens_used),
                confidence=self._extract_confidence(content),
            )

        except Exception as e:
            self.logger.error(f"Anthropic API error: {e}")
            raise

    async def stream_response(self, request: AIRequest) -> AsyncGenerator[str, None]:
        """Stream response using Anthropic."""
        model = self._select_model(request.model_preferences)

        try:
            async with self.client.messages.stream(
                model=model,
                max_tokens=request.max_tokens or 4096,
                temperature=request.temperature,
                messages=[{"role": "user", "content": request.prompt}],
            ) as stream:
                async for text in stream.text_stream:
                    yield text

        except Exception as e:
            self.logger.error(f"Anthropic streaming error: {e}")
            raise

    def get_available_models(self) -> List[ModelInfo]:
        """Get available Anthropic models."""
        return [
            ModelInfo(
                provider=AIProvider.ANTHROPIC,
                model_id="claude-3-5-sonnet-20241022",
                name="Claude 3.5 Sonnet",
                max_tokens=200000,
                capabilities=[
                    ModelCapability.FUNCTION_CALLING,
                    ModelCapability.STRUCTURED_OUTPUT,
                    ModelCapability.LARGE_CONTEXT,
                ],
                cost_per_token=0.000003,
                quality_score=0.95,
            ),
            ModelInfo(
                provider=AIProvider.ANTHROPIC,
                model_id="claude-3-haiku-20240307",
                name="Claude 3 Haiku",
                max_tokens=200000,
                capabilities=[
                    ModelCapability.FAST_RESPONSE,
                    ModelCapability.COST_EFFECTIVE,
                    ModelCapability.LARGE_CONTEXT,
                ],
                cost_per_token=0.00000025,
                quality_score=0.80,
            ),
        ]

    async def validate_connection(self) -> bool:
        """Validate Anthropic connection."""
        try:
            await self.client.messages.create(
                model="claude-3-haiku-20240307",
                max_tokens=10,
                messages=[{"role": "user", "content": "test"}],
            )
            return True
        except Exception:
            return False

    def _select_model(self, preferences: List[str]) -> str:
        """Select best model based on preferences."""
        available_models = {
            model.model_id: model for model in self.get_available_models()
        }

        for pref in preferences:
            if pref in available_models:
                return pref

        return "claude-3-5-sonnet-20241022"  # Default to best model

    def _calculate_cost(self, model: str, tokens: int) -> float:
        """Calculate API cost."""
        model_info = next(
            (m for m in self.get_available_models() if m.model_id == model), None
        )
        if model_info:
            return tokens * model_info.cost_per_token
        return 0.0

    def _extract_confidence(self, content: str) -> float:
        """Extract confidence score from content."""
        # Same logic as OpenAI provider
        if "definitely" in content.lower() or "certainly" in content.lower():
            return 0.9
        elif "probably" in content.lower() or "likely" in content.lower():
            return 0.7
        elif "maybe" in content.lower() or "might" in content.lower():
            return 0.5
        return 0.8


class GeminiProvider(AIProviderInterface):
    """Google Gemini provider implementation."""

    def __init__(self, api_key: str):
        genai.configure(api_key=api_key)
        self.logger = logging.getLogger(__name__)

    async def generate_response(self, request: AIRequest) -> AIResponse:
        """Generate response using Google Gemini."""
        start_time = datetime.now()

        # Select model
        model_name = self._select_model(request.model_preferences)
        model = genai.GenerativeModel(model_name)

        try:
            # Prepare the prompt
            prompt = request.prompt

            # Add context if available in request
            if request.context:
                context_parts = []
                for key, value in request.context.items():
                    context_parts.append(f"{key}: {value}")
                if context_parts:
                    context_section = "\n".join(context_parts)
                    prompt = f"{context_section}\n\n{prompt}"

            # For tool calling with Gemini, we need to format differently
            tool_calls = []
            content = ""

            if request.tools:
                # Add tool information to prompt for Gemini
                tools_description = "Available tools:\n"
                for tool in request.tools:
                    tools_description += f"- {tool.get('name', 'unknown')}: {tool.get('description', 'No description')}\n"
                    if "parameters" in tool:
                        tools_description += f"  Parameters: {tool['parameters']}\n"

                enhanced_prompt = f'{tools_description}\n\n{prompt}\n\nIf you need to use any tools, respond with JSON in this format: {{"tool_calls": [{{"name": "tool_name", "arguments": {{"param": "value"}}}}], "content": "explanation"}}'

                response = await model.generate_content_async(
                    enhanced_prompt,
                    generation_config=genai.types.GenerationConfig(
                        max_output_tokens=request.max_tokens or 4096,
                        temperature=request.temperature,
                    ),
                )

                content = response.text

                # Try to extract tool calls from response
                try:
                    # Look for JSON in the response
                    import re

                    json_match = re.search(r"\{.*\}", content, re.DOTALL)
                    if json_match:
                        json_response = json.loads(json_match.group())
                        if "tool_calls" in json_response:
                            for tc in json_response["tool_calls"]:
                                tool_calls.append(
                                    ToolCall(
                                        id=f"gemini_tool_{len(tool_calls)}",
                                        name=tc.get("name", ""),
                                        arguments=tc.get("arguments", {}),
                                    )
                                )
                        if "content" in json_response:
                            content = json_response["content"]
                except (json.JSONDecodeError, KeyError):
                    # If JSON parsing fails, use the raw content
                    pass
            else:
                # Simple text generation without tools
                response = await model.generate_content_async(
                    prompt,
                    generation_config=genai.types.GenerationConfig(
                        max_output_tokens=request.max_tokens or 4096,
                        temperature=request.temperature,
                    ),
                )
                content = response.text

            # Calculate metrics
            response_time = (datetime.now() - start_time).total_seconds()
            # Gemini doesn't provide token usage in the same way, so we estimate
            tokens_used = len(content.split()) * 1.3  # Rough estimation

            return AIResponse(
                conversation_id=request.conversation_id,
                content=content,
                tool_calls=tool_calls,
                model_used=model_name,
                tokens_used=int(tokens_used),
                response_time=response_time,
                cost=self._calculate_cost(model_name, int(tokens_used)),
                confidence=self._extract_confidence(content),
            )

        except Exception as e:
            self.logger.error(f"Gemini API error: {e}")
            raise

    async def stream_response(self, request: AIRequest) -> AsyncGenerator[str, None]:
        """Stream response using Google Gemini."""
        model_name = self._select_model(request.model_preferences)
        model = genai.GenerativeModel(model_name)

        try:
            # Prepare the prompt
            prompt = request.prompt

            if request.context:
                context_parts = []
                for key, value in request.context.items():
                    context_parts.append(f"{key}: {value}")
                if context_parts:
                    context_section = "\n".join(context_parts)
                    prompt = f"{context_section}\n\n{prompt}"

            response = await model.generate_content_async(
                prompt,
                generation_config=genai.types.GenerationConfig(
                    max_output_tokens=request.max_tokens or 4096,
                    temperature=request.temperature,
                ),
                stream=True,
            )

            async for chunk in response:
                if chunk.text:
                    yield chunk.text

        except Exception as e:
            self.logger.error(f"Gemini streaming error: {e}")
            raise

    def get_available_models(self) -> List[ModelInfo]:
        """Get available Gemini models."""
        return [
            ModelInfo(
                provider=AIProvider.GEMINI,
                model_id="gemini-1.5-pro",
                name="Gemini 1.5 Pro",
                max_tokens=128000,
                capabilities=[
                    ModelCapability.FUNCTION_CALLING,
                    ModelCapability.LARGE_CONTEXT,
                    ModelCapability.STRUCTURED_OUTPUT,
                ],
                cost_per_token=0.000025,  # Approximate
                quality_score=0.95,
            ),
            ModelInfo(
                provider=AIProvider.GEMINI,
                model_id="gemini-1.5-flash",
                name="Gemini 1.5 Flash",
                max_tokens=128000,
                capabilities=[
                    ModelCapability.FUNCTION_CALLING,
                    ModelCapability.LARGE_CONTEXT,
                    ModelCapability.FAST_RESPONSE,
                    ModelCapability.COST_EFFECTIVE,
                ],
                cost_per_token=0.0000125,  # Approximate
                response_time_avg=2.0,
                quality_score=0.85,
            ),
            ModelInfo(
                provider=AIProvider.GEMINI,
                model_id="gemini-2.5-pro",
                name="Gemini 2.5 Pro",
                max_tokens=128000,
                capabilities=[
                    ModelCapability.FUNCTION_CALLING,
                    ModelCapability.LARGE_CONTEXT,
                    ModelCapability.STRUCTURED_OUTPUT,
                ],
                cost_per_token=0.00003,  # Approximate
                quality_score=0.98,
            ),
        ]

    async def validate_connection(self) -> bool:
        """Validate Gemini API connection."""
        try:
            model = genai.GenerativeModel("gemini-1.5-flash")
            response = await model.generate_content_async("test")
            return bool(response.text)
        except Exception:
            return False

    def _select_model(self, preferences: List[str]) -> str:
        """Select best model based on preferences."""
        available_models = {
            model.model_id: model for model in self.get_available_models()
        }

        for pref in preferences:
            if pref in available_models:
                return pref

        return "gemini-1.5-flash"  # Default to fast, cost-effective model

    def _calculate_cost(self, model: str, tokens: int) -> float:
        """Calculate API cost for Gemini."""
        cost_per_token = {
            "gemini-1.5-pro": 0.000025,
            "gemini-1.5-flash": 0.0000125,
            "gemini-2.5-pro": 0.00003,
        }.get(model, 0.0000125)  # Default to flash pricing

        return tokens * cost_per_token

    def _extract_confidence(self, content: str) -> float:
        """Extract confidence score from response content."""
        # Same logic as other providers
        confidence_patterns = [
            r"confidence[:\s]*(\d+(?:\.\d+)?)",
            r"certain[:\s]*(\d+(?:\.\d+)?)",
            r"sure[:\s]*(\d+(?:\.\d+)?)",
        ]

        for pattern in confidence_patterns:
            match = re.search(pattern, content.lower())
            if match:
                return float(match.group(1)) / 100.0

        if "definitely" in content.lower() or "certainly" in content.lower():
            return 0.9
        elif "probably" in content.lower() or "likely" in content.lower():
            return 0.7
        elif "maybe" in content.lower() or "might" in content.lower():
            return 0.5
        return 0.8


class PromptManager:
    """Manages dynamic prompt generation and optimization."""

    def __init__(self):
        self.templates: Dict[str, PromptTemplate] = {}
        self.logger = logging.getLogger(__name__)
        self._load_default_templates()

    def register_template(self, template: PromptTemplate):
        """Register a prompt template."""
        self.templates[template.id] = template
        self.logger.debug(f"Registered prompt template: {template.id}")

    def generate_prompt(
        self,
        template_id: str,
        variables: Dict[str, Any],
        context: Optional[Dict[str, Any]] = None,
    ) -> str:
        """Generate prompt from template."""
        if template_id not in self.templates:
            raise ValueError(f"Template {template_id} not found")

        template = self.templates[template_id]

        # Validate required variables
        missing_vars = set(template.variables) - set(variables.keys())
        if missing_vars:
            raise ValueError(f"Missing variables: {missing_vars}")

        # Generate prompt
        try:
            prompt = template.template.format(**variables)

            # Add context if available
            if context and template.context_requirements:
                context_parts = []
                for req in template.context_requirements:
                    if req in context:
                        context_parts.append(f"{req}: {context[req]}")

                if context_parts:
                    context_section = "\n".join(context_parts)
                    prompt = f"{context_section}\n\n{prompt}"

            return prompt

        except KeyError as e:
            raise ValueError(f"Template variable error: {e}")

    def get_template(self, template_id: str) -> Optional[PromptTemplate]:
        """Get template by ID."""
        return self.templates.get(template_id)

    def list_templates(self) -> List[PromptTemplate]:
        """List all templates."""
        return list(self.templates.values())

    def _load_default_templates(self):
        """Load default prompt templates."""

        # Conversational scheduling template
        self.register_template(
            PromptTemplate(
                id="conversational_scheduler",
                name="Conversational Scheduler",
                template="""You are an AI scheduling assistant that helps optimize employee schedules. 
You can use various tools to analyze schedules, check employee availability, and resolve conflicts.

Current Task: {task_description}

Available Context:
{context_summary}

Tools Available: {available_tools}

Please analyze the current situation and determine the next steps. You can:
1. Use tools to gather more information
2. Provide recommendations
3. Ask clarifying questions
4. Suggest specific actions

Be conversational and explain your reasoning. If you need to use tools, explain why and what you expect to learn.""",
                variables=["task_description", "context_summary", "available_tools"],
                context_requirements=["schedule_data", "employee_data", "constraints"],
                model_preferences=[
                    "gemini-1.5-pro",
                    "gpt-4o",
                    "claude-3-5-sonnet-20241022",
                ],
            )
        )

        # Conflict resolution template
        self.register_template(
            PromptTemplate(
                id="conflict_resolver",
                name="Conflict Resolver",
                template="""You are an expert at resolving scheduling conflicts. 

Conflict Details:
{conflict_description}

Affected Elements:
{affected_elements}

Available Solutions:
{solution_options}

Please provide a step-by-step resolution plan. For each step, specify:
1. What action to take
2. Which tools to use (if any)  
3. Expected outcome
4. Risk assessment

Be specific and actionable.""",
                variables=[
                    "conflict_description",
                    "affected_elements",
                    "solution_options",
                ],
                context_requirements=["current_schedule", "employee_constraints"],
                model_preferences=[
                    "gemini-1.5-pro",
                    "gpt-4o",
                    "claude-3-5-sonnet-20241022",
                ],
            )
        )

        # Optimization consultant template
        self.register_template(
            PromptTemplate(
                id="optimization_consultant",
                name="Optimization Consultant",
                template="""You are a scheduling optimization consultant. Your goal is to improve schedule efficiency and employee satisfaction.

Current Schedule Status:
{schedule_status}

Optimization Goals:
{optimization_goals}

Constraints:
{constraints}

Performance Metrics:
{current_metrics}

Please provide optimization recommendations. For each recommendation:
1. Describe the improvement
2. Explain the rationale
3. Estimate the impact
4. Suggest implementation steps
5. Identify any risks

Use tools as needed to gather additional data or test scenarios.""",
                variables=[
                    "schedule_status",
                    "optimization_goals",
                    "constraints",
                    "current_metrics",
                ],
                context_requirements=["historical_data", "employee_preferences"],
                model_preferences=[
                    "gemini-1.5-pro",
                    "gpt-4o",
                    "claude-3-5-sonnet-20241022",
                ],
            )
        )


class AIOrchestrator:
    """Orchestrates AI interactions with tool usage."""

    def __init__(
        self,
        providers: Dict[AIProvider, AIProviderInterface],
        prompt_manager: PromptManager,
    ):
        self.providers = providers
        self.prompt_manager = prompt_manager
        self.logger = logging.getLogger(__name__)

        # Model selection strategy
        self.selection_strategies = {
            "cost_effective": self._select_cost_effective_model,
            "high_quality": self._select_high_quality_model,
            "fast_response": self._select_fast_model,
            "balanced": self._select_balanced_model,
        }

    async def process_request(
        self, request: AIRequest, selection_strategy: str = "balanced"
    ) -> AIResponse:
        """Process AI request with optimal model selection."""

        # Select provider and model
        provider, model_id = await self._select_provider_and_model(
            request, selection_strategy
        )

        # Update request with selected model
        if model_id not in request.model_preferences:
            request.model_preferences.insert(0, model_id)

        # Generate response
        try:
            response = await provider.generate_response(request)

            # Log metrics
            self._log_metrics(response)

            return response

        except Exception as e:
            self.logger.error(f"AI request failed: {e}")

            # Try fallback provider if available
            fallback_response = await self._try_fallback(request, provider)
            if fallback_response:
                return fallback_response

            raise

    async def stream_request(
        self, request: AIRequest, selection_strategy: str = "fast_response"
    ) -> AsyncGenerator[str, None]:
        """Stream AI request response."""

        provider, model_id = await self._select_provider_and_model(
            request, selection_strategy
        )

        if model_id not in request.model_preferences:
            request.model_preferences.insert(0, model_id)

        try:
            async for chunk in provider.stream_response(request):
                yield chunk
        except Exception as e:
            self.logger.error(f"AI streaming failed: {e}")
            raise

    async def _select_provider_and_model(
        self, request: AIRequest, strategy: str
    ) -> tuple[AIProviderInterface, str]:
        """Select optimal provider and model."""

        # Get selection function
        select_func = self.selection_strategies.get(
            strategy, self._select_balanced_model
        )

        # Get all available models
        all_models = []
        for provider_type, provider in self.providers.items():
            models = provider.get_available_models()
            for model in models:
                all_models.append((provider, model))

        # Select best model
        selected_provider, selected_model = select_func(all_models, request)

        return selected_provider, selected_model.model_id

    def _select_cost_effective_model(
        self, models: List[tuple], request: AIRequest
    ) -> tuple:
        """Select most cost-effective model."""
        return min(models, key=lambda x: x[1].cost_per_token)

    def _select_high_quality_model(
        self, models: List[tuple], request: AIRequest
    ) -> tuple:
        """Select highest quality model."""
        return max(models, key=lambda x: x[1].quality_score)

    def _select_fast_model(self, models: List[tuple], request: AIRequest) -> tuple:
        """Select fastest responding model."""
        fast_models = [
            (p, m) for p, m in models if ModelCapability.FAST_RESPONSE in m.capabilities
        ]
        if fast_models:
            return min(fast_models, key=lambda x: x[1].response_time_avg)
        return models[0]  # Fallback

    def _select_balanced_model(self, models: List[tuple], request: AIRequest) -> tuple:
        """Select balanced model considering cost, quality, and speed."""

        # Score each model
        scored_models = []
        for provider, model in models:
            # Normalize scores (0-1)
            cost_score = 1.0 - min(
                model.cost_per_token / 0.00001, 1.0
            )  # Lower cost is better
            quality_score = model.quality_score
            speed_score = (
                0.8 if ModelCapability.FAST_RESPONSE in model.capabilities else 0.4
            )

            # Check for required capabilities
            capability_score = 1.0
            if (
                request.tools
                and ModelCapability.FUNCTION_CALLING not in model.capabilities
            ):
                capability_score = 0.0  # Cannot use this model

            # Weighted average
            total_score = (
                cost_score * 0.3
                + quality_score * 0.4
                + speed_score * 0.2
                + capability_score * 0.1
            )

            scored_models.append((provider, model, total_score))

        # Select highest scoring model
        return max(scored_models, key=lambda x: x[2])[:2]

    async def _try_fallback(
        self, request: AIRequest, failed_provider: AIProviderInterface
    ) -> Optional[AIResponse]:
        """Try fallback provider if available."""

        for provider in self.providers.values():
            if provider != failed_provider:
                try:
                    return await provider.generate_response(request)
                except Exception:
                    continue

        return None

    def _log_metrics(self, response: AIResponse):
        """Log response metrics."""
        self.logger.info(
            f"AI Response - Model: {response.model_used}, "
            f"Tokens: {response.tokens_used}, "
            f"Time: {response.response_time:.2f}s, "
            f"Cost: ${response.cost:.4f}, "
            f"Tools: {len(response.tool_calls)}"
        )


# Factory functions
async def create_ai_orchestrator(
    openai_key: Optional[str] = None,
    anthropic_key: Optional[str] = None,
    gemini_key: Optional[str] = None,
) -> AIOrchestrator:
    """Create AI orchestrator with available providers."""
    providers = {}

    if openai_key:
        providers[AIProvider.OPENAI] = OpenAIProvider(openai_key)

    if anthropic_key:
        providers[AIProvider.ANTHROPIC] = AnthropicProvider(anthropic_key)

    if gemini_key:
        providers[AIProvider.GEMINI] = GeminiProvider(gemini_key)

    if not providers:
        raise ValueError("At least one AI provider must be configured")

    prompt_manager = PromptManager()
    return AIOrchestrator(providers, prompt_manager)


async def create_ai_orchestrator_from_config(
    config: "AIProviderConfig",
) -> AIOrchestrator:
    """Create AI orchestrator from configuration."""
    return await create_ai_orchestrator(
        openai_key=config.openai_api_key,
        anthropic_key=config.anthropic_api_key,
        gemini_key=config.gemini_api_key,
    )
