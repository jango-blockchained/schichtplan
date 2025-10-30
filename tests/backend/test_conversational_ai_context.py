"""
Test suite for conversational AI context and initial prompt validation.

This test file verifies that:
1. The initial prompt is correctly generated with system context
2. The prompt builder properly combines system and task-specific prompts
3. The conversation context is properly enriched with scheduling information
"""

import asyncio
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock

import pytest

from src.backend.services.conversation_manager import (
    ContextItem,
    ConversationContext,
    ConversationGoal,
    ConversationPriority,
    ConversationState,
)
from src.backend.services.conversational_mcp_service import (
    ConversationalSchichtplanMCPService,
)

# Test constants
EXPECTED_GOAL_COUNT = 2
EXPECTED_PARTS_COUNT = 2
EXPECTED_ITEMS_COUNT = 2
EXPECTED_TOOLS_COUNT = 2


@pytest.fixture
def mock_mcp_service():
    """Create a mock MCP service for testing."""
    mock_service = MagicMock()
    mock_service.mcp = MagicMock()
    return mock_service


@pytest.fixture
def mock_conversation_manager():
    """Create a mock conversation manager."""
    manager = AsyncMock()
    return manager


@pytest.fixture
def mock_ai_orchestrator():
    """Create a mock AI orchestrator."""
    orchestrator = AsyncMock()
    orchestrator.prompt_manager = MagicMock()
    return orchestrator


@pytest.fixture
def conversational_service(
    mock_mcp_service, mock_conversation_manager, mock_ai_orchestrator
):
    """Create conversational service with mocks."""
    system_prompt = (
        "# Schichtplan Assistant - System Prompt\n\n"
        "You are a helpful AI assistant for workforce management.\n\n"
        "## Your Role\n"
        "Assist users with schedule management and optimization.\n\n"
        "## Guidelines\n"
        "- Be professional and concise\n"
        "- Focus on scheduling topics"
    )
    mock_mcp_service.user_ai_prompt = system_prompt
    service = ConversationalSchichtplanMCPService(
        mock_mcp_service, mock_conversation_manager, mock_ai_orchestrator
    )
    return service


class TestConversationalAIContext:
    """Test conversational AI context and prompt generation."""

    def test_build_full_prompt_with_system_prompt(self, conversational_service):
        """Test that _build_full_prompt correctly combines prompts."""
        task_prompt = "Optimize the schedule for next week."

        full_prompt = conversational_service._build_full_prompt(task_prompt)

        # Should include both system and task prompts
        assert "Schichtplan Assistant" in full_prompt
        assert "You are a helpful AI assistant" in full_prompt
        assert "Optimize the schedule for next week" in full_prompt
        assert "---" in full_prompt  # Separator

    def test_build_full_prompt_without_system_prompt(self, conversational_service):
        """Test _build_full_prompt when no system prompt is available."""
        conversational_service.user_ai_prompt = ""
        task_prompt = "Optimize the schedule."

        full_prompt = conversational_service._build_full_prompt(task_prompt)

        # Should only include task prompt
        assert full_prompt == task_prompt

    def test_prepare_conversation_context(self, conversational_service):
        """Test that conversation context is properly prepared."""
        # Create test context
        goal1 = ConversationGoal(
            id="goal_1",
            description="Optimize schedule",
            type="user_request",
            priority=ConversationPriority.HIGH,
            status="pending",
        )

        goal2 = ConversationGoal(
            id="goal_2",
            description="Reduce conflicts",
            type="optimization",
            priority=ConversationPriority.NORMAL,
            status="pending",
        )

        context = ConversationContext(
            conversation_id="test_conv_123",
            user_id="user_1",
            session_id="session_1",
            state=ConversationState.ACTIVE,
            created_at=datetime.now(),
            updated_at=datetime.now(),
            goals=[goal1, goal2],
            ai_personality="helpful_scheduler",
            user_preferences={"language": "en", "style": "professional"},
        )

        # Prepare context
        prepared_ctx = conversational_service._prepare_conversation_context(context)

        # Verify structure
        assert prepared_ctx["conversation_id"] == "test_conv_123"
        assert len(prepared_ctx["goals"]) == EXPECTED_GOAL_COUNT
        assert "Optimize schedule" in prepared_ctx["goals"]
        assert prepared_ctx["ai_personality"] == "helpful_scheduler"
        assert "tools_used" in prepared_ctx
        assert "user_preferences" in prepared_ctx

    def test_summarize_context(self, conversational_service):
        """Test context summarization."""
        context = ConversationContext(
            conversation_id="test_conv_123",
            user_id="user_1",
            session_id="session_1",
            state=ConversationState.ACTIVE,
            created_at=datetime.now(),
            updated_at=datetime.now(),
        )

        # Add context items
        user_item = ContextItem(
            id="item_1",
            type="user_input",
            content="I need to optimize the schedule",
            timestamp=datetime.now(),
            relevance_score=1.0,
        )

        ai_item = ContextItem(
            id="item_2",
            type="ai_response",
            content="Let me analyze your current schedule",
            timestamp=datetime.now(),
            relevance_score=0.9,
        )

        context.context_items = [user_item, ai_item]

        summary = conversational_service._summarize_context(context)

        # Verify summary includes key information
        assert "optimize" in summary.lower()
        assert "analyze" in summary.lower()

    @pytest.mark.asyncio
    async def test_generate_initial_response(self, conversational_service):
        """Test that initial response includes enriched context."""
        goal = ConversationGoal(
            id="goal_1",
            description="Optimize schedule for coverage",
            type="user_request",
            priority=ConversationPriority.HIGH,
            status="pending",
        )

        context = ConversationContext(
            conversation_id="test_conv_123",
            user_id="user_1",
            session_id="session_1",
            state=ConversationState.ACTIVE,
            created_at=datetime.now(),
            updated_at=datetime.now(),
            goals=[goal],
            ai_personality="helpful_scheduler",
            user_preferences={"language": "en"},
        )

        # Generate initial response
        response = await conversational_service._generate_initial_response(context)

        # Verify response structure
        assert "content" in response
        assert "tool_calls" in response
        assert "timestamp" in response
        assert response["tool_calls"] == []

        # Verify content includes expected sections
        content = response["content"]
        assert "Schichtplan AI scheduling assistant" in content
        assert "Optimize schedule for coverage" in content
        assert "My Capabilities:" in content
        assert "How I Work:" in content
        assert "Conversation Context:" in content

    def test_initial_response_without_goals(self, conversational_service):
        """Test initial response generation without specific goals."""

        async def test():
            context = ConversationContext(
                conversation_id="test_conv_123",
                user_id="user_1",
                session_id="session_1",
                state=ConversationState.ACTIVE,
                created_at=datetime.now(),
                updated_at=datetime.now(),
                goals=[],
                ai_personality="helpful_scheduler",
                user_preferences={},
            )

            response = await conversational_service._generate_initial_response(context)

            # Verify response handles empty goals
            content = response["content"]
            assert "assist you with any scheduling tasks" in content

        asyncio.run(test())

    def test_capability_list_in_initial_response(self, conversational_service):
        """Test that all capabilities are listed in initial response."""

        async def test():
            context = ConversationContext(
                conversation_id="test_conv_123",
                user_id="user_1",
                session_id="session_1",
                state=ConversationState.ACTIVE,
                created_at=datetime.now(),
                updated_at=datetime.now(),
                goals=[],
                ai_personality="helpful_scheduler",
                user_preferences={},
            )

            response = await conversational_service._generate_initial_response(context)

            content = response["content"]

            # Verify all expected capabilities are mentioned
            expected_capabilities = [
                "Schedule optimization",
                "Employee workload",
                "Coverage requirement",
                "What-if scenario",
                "Policy and compliance",
                "Employee availability",
                "Shift distribution",
                "AI-driven insights",
            ]

            for capability in expected_capabilities:
                assert capability in content, (
                    f"Capability '{capability}' not found in response"
                )

        asyncio.run(test())


class TestPromptIntegration:
    """Test prompt integration with system context."""

    def test_system_prompt_loading(self, conversational_service):
        """Test that system prompt is properly loaded."""
        assert conversational_service.user_ai_prompt != ""
        assert "Schichtplan" in conversational_service.user_ai_prompt

    def test_full_prompt_structure(self, conversational_service):
        """Test the structure of full prompts."""
        task = "Please optimize coverage for Monday"
        full = conversational_service._build_full_prompt(task)

        lines = full.split("\n")

        # Verify separator is present
        assert any("---" in line for line in lines)

        # Verify both parts are present
        parts = full.split("---")
        assert len(parts) == EXPECTED_PARTS_COUNT
        assert len(parts[0].strip()) > 0  # System part
        assert len(parts[1].strip()) > 0  # Task part


class TestContextEnrichment:
    """Test context enrichment for AI responses."""

    def test_context_item_tracking(self):
        """Test that context items are properly tracked."""
        context = ConversationContext(
            conversation_id="test_conv_123",
            user_id="user_1",
            session_id="session_1",
            state=ConversationState.ACTIVE,
            created_at=datetime.now(),
            updated_at=datetime.now(),
        )

        # Add items
        item1 = ContextItem(
            id="item_1",
            type="user_input",
            content="Schedule data",
            timestamp=datetime.now(),
            relevance_score=1.0,
        )

        item2 = ContextItem(
            id="item_2",
            type="ai_response",
            content="Analysis results",
            timestamp=datetime.now(),
            relevance_score=0.85,
        )

        context.context_items = [item1, item2]

        # Verify tracking
        assert len(context.context_items) == EXPECTED_ITEMS_COUNT
        assert context.context_items[0].type == "user_input"
        assert context.context_items[1].type == "ai_response"

    def test_tools_used_tracking(self):
        """Test that tools usage is tracked."""
        context = ConversationContext(
            conversation_id="test_conv_123",
            user_id="user_1",
            session_id="session_1",
            state=ConversationState.ACTIVE,
            created_at=datetime.now(),
            updated_at=datetime.now(),
        )

        # Initially empty
        assert context.tools_used == []

        # Add tools
        context.tools_used.append("analyze_schedule_conflicts")
        context.tools_used.append("get_coverage_requirements")

        # Verify tracking
        assert len(context.tools_used) == EXPECTED_TOOLS_COUNT
        assert "analyze_schedule_conflicts" in context.tools_used


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
