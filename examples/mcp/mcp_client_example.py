#!/usr/bin/env python3
"""
FastMCP Client Example for Schichtplan

This example demonstrates how to connect to and interact with the
Schichtplan MCP server using different transport methods.
"""

import asyncio
import sys
import json
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(project_root))

from fastmcp import Client


async def demo_stdio_client():
    """Demonstrate connecting to MCP server via stdio."""
    print("=== MCP Client Demo - STDIO Transport ===")
    
    # Connect to the MCP server via stdio
    server_script = str(Path(__file__).parent.parent / "mcp_server.py")
    
    async with Client(server_script) as client:
        print("✓ Connected to MCP server via stdio")
        
        # List available tools
        tools = await client.list_tools()
        print(f"✓ Available tools: {[tool.name for tool in tools.tools]}")
        
        # Test system status tool
        print("\n--- Testing system status tool ---")
        result = await client.call_tool("get_system_status", {})
        print(f"System status: {json.dumps(result.content, indent=2)}")
        
        # Test get employees tool
        print("\n--- Testing get employees tool ---")
        result = await client.call_tool("get_employees", {"active_only": True})
        employees = result.content
        print(f"Found {len(employees)} active employees")
        if employees:
            print(f"First employee: {employees[0]['name']}")
        
        print("\n✓ STDIO demo completed successfully!")


async def demo_sse_client():
    """Demonstrate connecting to MCP server via SSE."""
    print("\n=== MCP Client Demo - SSE Transport ===")
    
    try:
        # Connect to SSE server (assuming it's running on localhost:8001)
        from fastmcp.transports import SSETransport
        
        async with Client(SSETransport("http://localhost:8001/sse")) as client:
            print("✓ Connected to MCP server via SSE")
            
            # List available tools
            tools = await client.list_tools()
            print(f"✓ Available tools: {[tool.name for tool in tools.tools]}")
            
            # Test a simple tool
            result = await client.call_tool("get_system_status", {})
            print(f"System status: {json.dumps(result.content, indent=2)}")
            
            print("✓ SSE demo completed successfully!")
            
    except Exception as e:
        print(f"✗ SSE demo failed: {e}")
        print("  Make sure the MCP server is running in SSE mode:")
        print("  python src/backend/mcp_server.py --transport sse")


async def demo_streamable_http_client():
    """Demonstrate connecting to MCP server via streamable HTTP."""
    print("\n=== MCP Client Demo - Streamable HTTP Transport ===")
    
    try:
        # Connect to streamable HTTP server (assuming it's running on localhost:8002)
        async with Client("http://localhost:8002/mcp") as client:
            print("✓ Connected to MCP server via streamable HTTP")
            
            # List available tools
            tools = await client.list_tools()
            print(f"✓ Available tools: {[tool.name for tool in tools.tools]}")
            
            # Test a simple tool
            result = await client.call_tool("get_system_status", {})
            print(f"System status: {json.dumps(result.content, indent=2)}")
            
            print("✓ Streamable HTTP demo completed successfully!")
            
    except Exception as e:
        print(f"✗ Streamable HTTP demo failed: {e}")
        print("  Make sure the MCP server is running in streamable HTTP mode:")
        print("  python src/backend/mcp_server.py --transport http")


async def demo_schedule_generation():
    """Demonstrate schedule generation via MCP."""
    print("\n=== Schedule Generation Demo ===")
    
    server_script = str(Path(__file__).parent.parent / "mcp_server.py")
    
    async with Client(server_script) as client:
        print("✓ Connected to MCP server")
        
        # First, ensure we have demo data
        print("\n--- Generating demo data ---")
        demo_result = await client.call_tool("generate_demo_data", {
            "employee_count": 10,
            "shift_count": 5,
            "coverage_blocks": 3
        })
        print(f"Demo data result: {demo_result.content.get('status', 'unknown')}")
        
        # Generate a schedule
        print("\n--- Generating schedule ---")
        from datetime import date, timedelta
        
        start_date = date.today()
        end_date = start_date + timedelta(days=6)  # One week
        
        schedule_result = await client.call_tool("generate_schedule", {
            "start_date": start_date.strftime('%Y-%m-%d'),
            "end_date": end_date.strftime('%Y-%m-%d'),
            "use_ai": False  # Use traditional scheduler
        })
        
        print(f"Schedule generation result:")
        print(json.dumps(schedule_result.content, indent=2))
        
        # Retrieve the generated schedule
        print("\n--- Retrieving schedule ---")
        schedule_data = await client.call_tool("get_schedule", {
            "start_date": start_date.strftime('%Y-%m-%d'),
            "end_date": end_date.strftime('%Y-%m-%d')
        })
        
        schedules = schedule_data.content.get('schedules', [])
        if schedules:
            schedule = schedules[0]
            print(f"Generated schedule with {len(schedule['assignments'])} assignments")
            
            # Show first few assignments
            for i, assignment in enumerate(schedule['assignments'][:3]):
                print(f"  {assignment['date']}: {assignment['employee_name']} -> {assignment['shift_name']}")
            
            if len(schedule['assignments']) > 3:
                print(f"  ... and {len(schedule['assignments']) - 3} more assignments")
        
        print("\n✓ Schedule generation demo completed!")


async def main():
    """Run all demo functions."""
    print("FastMCP Client Examples for Schichtplan")
    print("=" * 50)
    
    try:
        # Always run stdio demo as it doesn't require external servers
        await demo_stdio_client()
        
        # Run schedule generation demo
        await demo_schedule_generation()
        
        # Try network-based demos (these might fail if servers aren't running)
        await demo_sse_client()
        await demo_streamable_http_client()
        
    except KeyboardInterrupt:
        print("\n\nDemo interrupted by user")
    except Exception as e:
        print(f"\n\nDemo failed with error: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(main())