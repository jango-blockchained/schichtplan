"""
Integration Setup and Testing for Conversational AI MCP Service

This script sets up the conversational AI system and provides testing capabilities.
"""

import asyncio
import logging
import os
import sys
from typing import Optional

# Add the src path for imports
sys.path.append("/home/jango/Git/maike2/schichtplan/src")

from backend.app import create_app
from backend.services.conversational_mcp_service import (
    create_conversational_mcp_service,
)
from backend.services.mcp_service import SchichtplanMCPService

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


class ConversationalAISetup:
    """Setup and testing class for conversational AI system."""

    def __init__(self):
        self.flask_app = None
        self.base_mcp_service = None
        self.conversational_service = None

    async def setup_system(
        self,
        openai_key: Optional[str] = None,
        anthropic_key: Optional[str] = None,
        redis_url: str = "redis://localhost:6379",
    ):
        """Set up the complete conversational AI system."""

        logger.info("Setting up conversational AI system...")

        # Create Flask app
        self.flask_app = create_app()

        # Create base MCP service
        with self.flask_app.app_context():
            self.base_mcp_service = SchichtplanMCPService(self.flask_app)
            logger.info("Base MCP service created")

        # Get API keys from environment if not provided
        if not openai_key:
            openai_key = os.getenv("OPENAI_API_KEY")
        if not anthropic_key:
            anthropic_key = os.getenv("ANTHROPIC_API_KEY")

        if not openai_key and not anthropic_key:
            logger.warning(
                "No AI API keys provided. System will have limited functionality."
            )
            return False

        # Create conversational service
        try:
            self.conversational_service = await create_conversational_mcp_service(
                base_mcp_service=self.base_mcp_service,
                redis_url=redis_url,
                openai_key=openai_key,
                anthropic_key=anthropic_key,
            )
            logger.info("Conversational MCP service created successfully")
            return True

        except Exception as e:
            logger.error(f"Failed to create conversational service: {e}")
            return False

    async def test_basic_functionality(self):
        """Test basic conversational functionality."""

        if not self.conversational_service:
            logger.error("Conversational service not initialized")
            return False

        logger.info("Testing basic conversational functionality...")

        try:
            # Test 1: Start a conversation
            logger.info("Test 1: Starting conversation...")
            conversation_result = await self._call_tool(
                "start_conversation",
                {
                    "user_id": "test_user",
                    "initial_goal": "I want to optimize my team's schedule for next week",
                    "ai_personality": "helpful_scheduler",
                },
            )

            if "conversation_id" not in conversation_result:
                logger.error("Failed to start conversation")
                return False

            conversation_id = conversation_result["conversation_id"]
            logger.info(f"Conversation started: {conversation_id}")
            logger.info(
                f"AI Response: {conversation_result.get('ai_response', {}).get('content', '')}"
            )

            # Test 2: Continue conversation
            logger.info("Test 2: Continuing conversation...")
            continue_result = await self._call_tool(
                "continue_conversation",
                {
                    "conversation_id": conversation_id,
                    "user_input": "Can you analyze my current schedule for conflicts and show me the statistics?",
                },
            )

            logger.info(f"AI Response: {continue_result.get('ai_response', '')}")
            logger.info(
                f"Tool calls made: {len(continue_result.get('tool_calls_made', []))}"
            )

            # Test 3: Get conversation status
            logger.info("Test 3: Getting conversation status...")
            status_result = await self._call_tool(
                "get_conversation_status", {"conversation_id": conversation_id}
            )

            logger.info(f"Conversation state: {status_result.get('state')}")
            logger.info(f"Context items: {status_result.get('context_items_count')}")
            logger.info(f"Tools used: {status_result.get('tools_used')}")

            # Test 4: End conversation
            logger.info("Test 4: Ending conversation...")
            end_result = await self._call_tool(
                "end_conversation",
                {
                    "conversation_id": conversation_id,
                    "summary": "Successfully tested conversational AI functionality",
                },
            )

            logger.info(f"Conversation ended: {end_result.get('final_state')}")
            logger.info(f"Summary: {end_result.get('summary')}")

            logger.info("✅ All basic functionality tests passed!")
            return True

        except Exception as e:
            logger.error(f"Test failed: {e}")
            return False

    async def test_guided_optimization(self):
        """Test guided schedule optimization."""

        if not self.conversational_service:
            logger.error("Conversational service not initialized")
            return False

        logger.info("Testing guided schedule optimization...")

        try:
            # Start conversation focused on optimization
            conversation_result = await self._call_tool(
                "start_conversation",
                {
                    "user_id": "optimization_test",
                    "initial_goal": "Optimize schedule for better employee satisfaction and coverage",
                    "ai_personality": "optimization_expert",
                },
            )

            conversation_id = conversation_result["conversation_id"]
            logger.info(f"Optimization conversation started: {conversation_id}")

            # Start guided optimization
            optimization_result = await self._call_tool(
                "guided_schedule_optimization",
                {
                    "conversation_id": conversation_id,
                    "start_date": "2025-06-23",
                    "end_date": "2025-06-29",
                    "optimization_goals": [
                        "balance_workload",
                        "minimize_conflicts",
                        "ensure_keyholder_coverage",
                    ],
                },
            )

            logger.info("Optimization plan generated:")
            logger.info(
                f"Plan: {optimization_result.get('optimization_plan', '')[:500]}..."
            )
            logger.info(
                f"Recommended actions: {len(optimization_result.get('recommended_actions', []))}"
            )

            # Continue conversation with optimization feedback
            feedback_result = await self._call_tool(
                "continue_conversation",
                {
                    "conversation_id": conversation_id,
                    "user_input": "The optimization looks good. Can you implement the first recommendation and show me the impact?",
                },
            )

            logger.info(
                f"Optimization feedback: {feedback_result.get('ai_response', '')[:300]}..."
            )

            # End optimization conversation
            await self._call_tool(
                "end_conversation", {"conversation_id": conversation_id}
            )

            logger.info("✅ Guided optimization test completed!")
            return True

        except Exception as e:
            logger.error(f"Guided optimization test failed: {e}")
            return False

    async def test_ai_analysis(self):
        """Test AI-driven schedule analysis."""

        if not self.conversational_service:
            logger.error("Conversational service not initialized")
            return False

        logger.info("Testing AI-driven schedule analysis...")

        try:
            # Start analysis conversation
            conversation_result = await self._call_tool(
                "start_conversation",
                {
                    "user_id": "analysis_test",
                    "initial_goal": "Analyze my schedule for potential improvements",
                    "ai_personality": "analytical_consultant",
                },
            )

            conversation_id = conversation_result["conversation_id"]
            logger.info(f"Analysis conversation started: {conversation_id}")

            # Test comprehensive analysis
            analysis_result = await self._call_tool(
                "ai_schedule_analysis",
                {
                    "conversation_id": conversation_id,
                    "analysis_type": "comprehensive",
                    "specific_focus": [
                        "workload_distribution",
                        "coverage_gaps",
                        "employee_satisfaction",
                    ],
                },
            )

            logger.info("AI Analysis completed:")
            logger.info(f"Analysis type: {analysis_result.get('analysis_type')}")
            logger.info(
                f"AI insights: {analysis_result.get('ai_insights', '')[:400]}..."
            )
            logger.info(f"Confidence: {analysis_result.get('confidence', 0):.2f}")

            # Test conflict-specific analysis
            conflict_analysis = await self._call_tool(
                "ai_schedule_analysis",
                {
                    "conversation_id": conversation_id,
                    "analysis_type": "conflict",
                    "specific_focus": ["double_bookings", "coverage_gaps"],
                },
            )

            logger.info(
                f"Conflict analysis insights: {conflict_analysis.get('ai_insights', '')[:300]}..."
            )

            # End analysis conversation
            await self._call_tool(
                "end_conversation", {"conversation_id": conversation_id}
            )

            logger.info("✅ AI analysis test completed!")
            return True

        except Exception as e:
            logger.error(f"AI analysis test failed: {e}")
            return False

    async def test_multi_turn_conversation(self):
        """Test complex multi-turn conversation with tool usage."""

        if not self.conversational_service:
            logger.error("Conversational service not initialized")
            return False

        logger.info("Testing multi-turn conversation...")

        try:
            # Start conversation
            conversation_result = await self._call_tool(
                "start_conversation",
                {
                    "user_id": "multi_turn_test",
                    "initial_goal": "I need help resolving scheduling conflicts and optimizing coverage",
                    "ai_personality": "problem_solver",
                },
            )

            conversation_id = conversation_result["conversation_id"]
            logger.info(f"Multi-turn conversation started: {conversation_id}")

            # Turn 1: Ask for current situation analysis
            turn1 = await self._call_tool(
                "continue_conversation",
                {
                    "conversation_id": conversation_id,
                    "user_input": "Can you first analyze my current schedule for the next week and tell me what issues you find?",
                },
            )
            logger.info(
                f"Turn 1 - AI found issues: {len(turn1.get('tool_calls_made', []))} tools used"
            )

            # Turn 2: Ask for specific conflict resolution
            turn2 = await self._call_tool(
                "continue_conversation",
                {
                    "conversation_id": conversation_id,
                    "user_input": "Based on your analysis, what are the top 3 conflicts I should resolve first, and how?",
                },
            )
            logger.info(
                f"Turn 2 - AI provided recommendations: {len(turn2.get('ai_response', '').split('.'))}"
            )

            # Turn 3: Ask for implementation steps
            turn3 = await self._call_tool(
                "continue_conversation",
                {
                    "conversation_id": conversation_id,
                    "user_input": "Great! Can you show me step-by-step how to implement the first recommendation?",
                },
            )
            logger.info(
                f"Turn 3 - AI provided steps: {len(turn3.get('tool_calls_made', []))} additional tools used"
            )

            # Turn 4: Ask for impact assessment
            turn4 = await self._call_tool(
                "continue_conversation",
                {
                    "conversation_id": conversation_id,
                    "user_input": "If I implement these changes, what would be the impact on employee workload and coverage?",
                },
            )
            logger.info(
                f"Turn 4 - AI assessed impact: Response length {len(turn4.get('ai_response', ''))}"
            )

            # Get final conversation status
            final_status = await self._call_tool(
                "get_conversation_status", {"conversation_id": conversation_id}
            )

            logger.info("Final conversation stats:")
            logger.info(f"- Context items: {final_status.get('context_items_count')}")
            logger.info(f"- Tools used: {final_status.get('tools_used')}")
            logger.info(f"- Goals: {final_status.get('goals')}")

            # End conversation
            end_result = await self._call_tool(
                "end_conversation", {"conversation_id": conversation_id}
            )

            logger.info(
                f"Conversation summary: {end_result.get('summary', '')[:200]}..."
            )
            logger.info("✅ Multi-turn conversation test completed!")
            return True

        except Exception as e:
            logger.error(f"Multi-turn conversation test failed: {e}")
            return False

    async def _call_tool(self, tool_name: str, arguments: dict):
        """Helper method to call MCP tools."""

        # Get the tool from the conversational service's MCP instance
        mcp_tools = self.conversational_service.mcp._tools

        if tool_name not in mcp_tools:
            raise ValueError(f"Tool {tool_name} not found")

        tool_func = mcp_tools[tool_name]

        # Call the tool with Flask app context
        with self.flask_app.app_context():
            result = await tool_func(**arguments)

        return result

    async def demonstrate_system(self):
        """Demonstrate the complete conversational AI system."""

        logger.info("🚀 Starting Conversational AI Demonstration")
        logger.info("=" * 60)

        # Run all tests
        tests = [
            ("Basic Functionality", self.test_basic_functionality),
            ("Guided Optimization", self.test_guided_optimization),
            ("AI Analysis", self.test_ai_analysis),
            ("Multi-turn Conversation", self.test_multi_turn_conversation),
        ]

        results = []
        for test_name, test_func in tests:
            logger.info(f"\n🧪 Running {test_name} Test...")
            logger.info("-" * 40)

            try:
                success = await test_func()
                results.append((test_name, success))

                if success:
                    logger.info(f"✅ {test_name} test PASSED")
                else:
                    logger.error(f"❌ {test_name} test FAILED")

            except Exception as e:
                logger.error(f"💥 {test_name} test ERROR: {e}")
                results.append((test_name, False))

        # Summary
        logger.info("\n" + "=" * 60)
        logger.info("🎯 DEMONSTRATION SUMMARY")
        logger.info("=" * 60)

        passed = sum(1 for _, success in results if success)
        total = len(results)

        for test_name, success in results:
            status = "✅ PASSED" if success else "❌ FAILED"
            logger.info(f"{test_name}: {status}")

        logger.info(f"\nOverall: {passed}/{total} tests passed")

        if passed == total:
            logger.info(
                "🎉 ALL TESTS PASSED! Conversational AI system is working correctly."
            )
        else:
            logger.warning(
                f"⚠️  {total - passed} tests failed. Please check the logs above."
            )

        return passed == total


async def main():
    """Main function to set up and test the conversational AI system."""

    print("🤖 Conversational AI MCP Service Setup and Testing")
    print("=" * 60)

    # Create setup instance
    setup = ConversationalAISetup()

    # Setup system
    print("🔧 Setting up the system...")
    success = await setup.setup_system()

    if not success:
        print("❌ System setup failed. Please check your configuration.")
        print("\nRequired:")
        print("- Redis server running on localhost:6379")
        print("- OPENAI_API_KEY or ANTHROPIC_API_KEY environment variable set")
        print("- Flask app and database properly configured")
        return

    print("✅ System setup completed!")
    print("\n🎭 Starting demonstration...")

    # Run demonstration
    demo_success = await setup.demonstrate_system()

    if demo_success:
        print("\n🚀 Conversational AI system is ready for production!")
        print("\nNext steps:")
        print("1. Integrate with your frontend application")
        print("2. Configure production AI API keys")
        print("3. Set up monitoring and logging")
        print("4. Train staff on conversational features")
    else:
        print(
            "\n⚠️  Some tests failed. Please resolve issues before production deployment."
        )


if __name__ == "__main__":
    # Run the main function
    asyncio.run(main())
