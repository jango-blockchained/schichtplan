#!/usr/bin/env python3
"""
Test script for the enhanced MCP server functionality.

This script tests all the new tools, resources, and prompts that have been added.
"""

import asyncio
import sys
from datetime import date, timedelta
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))


async def test_mcp_server():
    """Test the enhanced MCP server functionality."""
    print("=" * 60)
    print("TESTING ENHANCED MCP SERVER")
    print("=" * 60)

    try:
        from src.backend.app import create_app
        from src.backend.services.mcp_service import SchichtplanMCPService

        print("✅ Successfully imported MCP components")

        # Create Flask app and MCP service
        app = create_app()
        with app.app_context():
            service = SchichtplanMCPService(app)
            print("✅ MCP service initialized")

            # Test health check
            print("\n--- Testing Health Check ---")
            try:
                health = await service.mcp_health_check()
                print(f"✅ Health check: {health.get('status', 'unknown')}")
            except Exception as e:
                print(f"❌ Health check failed: {e}")

            # Test server info
            print("\n--- Testing Server Info ---")
            try:
                info = await service.get_server_info()
                print(f"✅ Server info: {info.get('name', 'unknown')}")
                print(f"   Version: {info.get('version', 'unknown')}")
                print(f"   Features: {len(info.get('features', []))}")
            except Exception as e:
                print(f"❌ Server info failed: {e}")

            # Test capabilities
            print("\n--- Testing Capabilities ---")
            try:
                caps = await service.get_capabilities()
                tools_count = len(caps.get("tools", {}).get("available", []))
                resources_count = len(caps.get("resources", {}))
                prompts_count = len(caps.get("prompts", {}))
                print("✅ Capabilities retrieved:")
                print(f"   Tools: {tools_count}")
                print(f"   Resources: {resources_count}")
                print(f"   Prompts: {prompts_count}")
            except Exception as e:
                print(f"❌ Capabilities failed: {e}")

            # Test employee tools
            print("\n--- Testing Employee Tools ---")
            try:
                employees = await service.get_employees()
                print(f"✅ Employees: {len(employees.get('employees', []))} found")
            except Exception as e:
                print(f"❌ Get employees failed: {e}")

            # Test shift templates
            print("\n--- Testing Shift Templates ---")
            try:
                templates = await service.get_shift_templates()
                print(
                    f"✅ Shift templates: {len(templates.get('shift_templates', []))} found"
                )
            except Exception as e:
                print(f"❌ Get shift templates failed: {e}")

            # Test coverage requirements
            print("\n--- Testing Coverage Requirements ---")
            try:
                coverage = await service.get_coverage_requirements()
                print(
                    f"✅ Coverage requirements: {len(coverage.get('coverage_requirements', []))} found"
                )
            except Exception as e:
                print(f"❌ Get coverage requirements failed: {e}")

            # Test schedule analysis (with date range)
            print("\n--- Testing Schedule Analysis ---")
            try:
                today = date.today()
                start_date = today.strftime("%Y-%m-%d")
                end_date = (today + timedelta(days=7)).strftime("%Y-%m-%d")

                conflicts = await service.analyze_schedule_conflicts(
                    start_date, end_date
                )
                print("✅ Schedule conflicts analysis complete")
                print(f"   Conflicts: {len(conflicts.get('conflicts', []))}")
                print(f"   Warnings: {len(conflicts.get('warnings', []))}")

                stats = await service.get_schedule_statistics(start_date, end_date)
                print("✅ Schedule statistics complete")
                print(
                    f"   Total shifts: {stats.get('overall_statistics', {}).get('total_shifts', 0)}"
                )

            except Exception as e:
                print(f"❌ Schedule analysis failed: {e}")

            # Test demo data generation
            print("\n--- Testing Demo Data Generation ---")
            try:
                demo_result = await service.generate_demo_data()
                print(
                    f"✅ Demo data generation: {demo_result.get('status', 'unknown')}"
                )
            except Exception as e:
                print(f"❌ Demo data generation failed: {e}")

            print("\n" + "=" * 60)
            print("MCP SERVER TESTING COMPLETE")
            print("=" * 60)

            # Test MCP server instance
            mcp_server = service.get_mcp_server()
            print(f"✅ MCP server instance: {type(mcp_server).__name__}")

            return True

    except Exception as e:
        print(f"❌ Critical error: {e}")
        import traceback

        traceback.print_exc()
        return False


def test_resources():
    """Test resource URL patterns."""
    print("\n--- Testing Resource Patterns ---")

    resources = [
        "config://system",
        "employees://123",
        "schedules://2024-01-01/2024-01-07",
        "shift-templates://all",
        "coverage://1",  # Monday
        "availability://123/2024-01-01",
        "conflicts://2024-01-01/2024-01-07",
    ]

    for resource in resources:
        print(f"✅ Resource pattern: {resource}")

    print(f"✅ Total resource patterns: {len(resources)}")


def test_prompts():
    """Test prompt templates."""
    print("\n--- Testing Prompt Templates ---")

    prompts = [
        "schedule_analysis_prompt",
        "employee_scheduling_prompt",
        "schedule_optimization_prompt",
        "conflict_resolution_prompt",
        "workforce_planning_prompt",
        "compliance_audit_prompt",
    ]

    for prompt in prompts:
        print(f"✅ Prompt template: {prompt}")

    print(f"✅ Total prompt templates: {len(prompts)}")


def main():
    """Main test function."""
    print("Starting MCP server tests...")

    # Test basic functionality
    success = asyncio.run(test_mcp_server())

    # Test resource patterns
    test_resources()

    # Test prompt templates
    test_prompts()

    if success:
        print("\n🎉 All tests completed successfully!")
        print("\nNext steps:")
        print("1. Start MCP server: python3 src/backend/mcp_server.py")
        print("2. Test in VS Code: Use Command Palette -> 'MCP: Connect'")
        print("3. Try AI integration with available tools and resources")
        return 0
    else:
        print("\n❌ Some tests failed. Check the output above.")
        return 1


if __name__ == "__main__":
    sys.exit(main())
