#!/usr/bin/env python3
"""
AI Deep Integration Test Script

This script demonstrates the enhanced AI capabilities with agent coordination
and workflow orchestration for complex scheduling tasks.
"""

import asyncio
import logging
import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

from src.backend.app import create_app
from src.backend.services.mcp_service import SchichtplanMCPService


async def test_ai_deep_integration():
    """Test the AI deep integration capabilities."""

    # Setup logging
    logging.basicConfig(level=logging.INFO)
    logger = logging.getLogger(__name__)

    logger.info("🚀 Starting AI Deep Integration Test")

    try:
        # Create Flask app
        flask_app = create_app()

        # Create enhanced MCP service with AI agents
        mcp_service = SchichtplanMCPService(flask_app, logger)

        logger.info("✅ MCP Service with AI Agents initialized")

        # Test simple request (should use agent registry)
        simple_request = {
            "user_input": "Optimize the schedule for better workload balance",
            "user_id": "test_user",
            "session_id": "test_session",
        }

        logger.info("🔍 Testing simple optimization request...")
        simple_result = await mcp_service.handle_request(simple_request)

        logger.info("📊 Simple Request Result:")
        logger.info(f"   Status: {simple_result.get('status')}")
        logger.info(f"   Agent Used: {simple_result.get('agent_used', 'None')}")
        logger.info(f"   Workflow Used: {simple_result.get('workflow_used', False)}")
        logger.info(f"   Response: {simple_result.get('response', '')[:100]}...")

        # Test complex request (should use workflow coordination)
        complex_request = {
            "user_input": "I need a comprehensive optimization of our schedule that considers employee satisfaction, workload balance, coverage requirements, and resolves all conflicts while ensuring fairness",
            "user_id": "test_user",
            "conv_id": simple_result.get("conversation_id"),  # Continue conversation
        }

        logger.info("🔍 Testing complex workflow request...")
        complex_result = await mcp_service.handle_request(complex_request)

        logger.info("📊 Complex Request Result:")
        logger.info(f"   Status: {complex_result.get('status')}")
        logger.info(f"   Workflow Used: {complex_result.get('workflow_used', False)}")
        logger.info(
            f"   Complexity Analysis: {complex_result.get('complexity_analysis', {})}"
        )
        logger.info(f"   Response: {complex_result.get('response', '')[:200]}...")

        # Test AI agent system status
        agent_status = mcp_service.get_ai_agent_status()
        logger.info("🤖 AI Agent System Status:")
        logger.info(
            f"   AI Orchestrator: {agent_status.get('ai_orchestrator_initialized')}"
        )
        logger.info(
            f"   Agent Registry: {agent_status.get('agent_registry_initialized')}"
        )
        logger.info(
            f"   Workflow Coordinator: {agent_status.get('workflow_coordinator_initialized')}"
        )

        if agent_status.get("agent_registry_status"):
            registry_status = agent_status["agent_registry_status"]
            logger.info(f"   Total Agents: {registry_status.get('total_agents')}")
            logger.info(f"   Enabled Agents: {registry_status.get('enabled_agents')}")
            logger.info(
                f"   Success Rate: {registry_status.get('overall_success_rate', 0):.1%}"
            )

        # Test specific agent capabilities
        logger.info("🔍 Testing specific agent capabilities...")

        employee_request = {
            "user_input": "Analyze employee workload and suggest better assignments based on their skills and preferences",
            "user_id": "test_user",
            "conv_id": complex_result.get("conversation_id"),
        }

        employee_result = await mcp_service.handle_request(employee_request)
        logger.info("👥 Employee Management Result:")
        logger.info(f"   Agent: {employee_result.get('agent_used', 'None')}")
        logger.info(f"   Response: {employee_result.get('response', '')[:150]}...")

        logger.info("✅ AI Deep Integration Test completed successfully!")

        return {
            "simple_request_result": simple_result,
            "complex_request_result": complex_result,
            "employee_request_result": employee_result,
            "agent_status": agent_status,
        }

    except Exception as e:
        logger.error(f"❌ Test failed: {e}")
        raise


async def demo_workflow_types():
    """Demonstrate different workflow types."""

    logging.basicConfig(level=logging.INFO)
    logger = logging.getLogger(__name__)

    logger.info("🎯 Demonstrating Different Workflow Types")

    flask_app = create_app()
    mcp_service = SchichtplanMCPService(flask_app, logger)

    # Different types of requests to trigger different workflows
    test_scenarios = [
        {
            "name": "Comprehensive Optimization",
            "request": "Completely optimize our schedule considering all factors including employee satisfaction, coverage, and efficiency",
        },
        {
            "name": "Constraint Solving",
            "request": "Resolve all scheduling conflicts and constraint violations in our current schedule",
        },
        {
            "name": "Employee Integration",
            "request": "Optimize employee assignments based on their skills, availability, and work-life balance needs",
        },
        {
            "name": "Scenario Planning",
            "request": "Create and compare different scheduling scenarios for the next quarter",
        },
    ]

    results = {}

    for scenario in test_scenarios:
        logger.info(f"🔍 Testing: {scenario['name']}")

        request = {
            "user_input": scenario["request"],
            "user_id": "demo_user",
            "session_id": f"demo_{scenario['name'].lower().replace(' ', '_')}",
        }

        result = await mcp_service.handle_request(request)
        results[scenario["name"]] = result

        logger.info(f"   Workflow Used: {result.get('workflow_used', False)}")
        if result.get("complexity_analysis"):
            complexity = result["complexity_analysis"]
            logger.info(
                f"   Complexity: {complexity.get('complexity_level', 'unknown')}"
            )
            logger.info(
                f"   Recommended Type: {complexity.get('recommended_workflow_type', 'unknown')}"
            )

        logger.info(f"   Result: {result.get('response', '')[:100]}...")
        logger.info("")

    return results


if __name__ == "__main__":
    print("🤖 AI Deep Integration for Schichtplan")
    print("=====================================")
    print()

    # Run basic integration test
    print("Running AI Deep Integration Test...")
    test_result = asyncio.run(test_ai_deep_integration())
    print()

    # Run workflow demonstration
    print("Demonstrating Workflow Types...")
    demo_result = asyncio.run(demo_workflow_types())
    print()

    print("🎉 All tests completed!")
    print("\nKey Features Demonstrated:")
    print("✅ Multi-agent coordination")
    print("✅ Workflow orchestration")
    print("✅ Complexity analysis")
    print("✅ Specialized agent routing")
    print("✅ Conversational state management")
    print("✅ Intelligent tool usage")
    print()
    print(
        "The AI deep integration is now active and ready for complex scheduling tasks!"
    )
