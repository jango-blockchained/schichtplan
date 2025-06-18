#!/usr/bin/env python3
"""
Example MCP Client for Schichtplan

This script demonstrates how to interact with the Schichtplan MCP server
using different transport protocols.

Usage:
    python3 examples/mcp_client_examples.py --transport stdio
    python3 examples/mcp_client_examples.py --transport sse --host localhost --port 8001
    python3 examples/mcp_client_examples.py --transport http --host localhost --port 8002
"""

import asyncio
import json
import sys
import argparse
from pathlib import Path
from datetime import date, timedelta

# Add the project root to Python path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

try:
    from mcp import ClientSession, StdioServerParameters
    from mcp.client.stdio import stdio_client
    import httpx
except ImportError:
    print("Error: Missing MCP client dependencies. Install with:")
    print("pip install mcp")
    print("pip install httpx")
    sys.exit(1)


class SchichtplanMCPClient:
    """Example client for interacting with Schichtplan MCP server."""
    
    def __init__(self, transport: str = "stdio", host: str = "localhost", port: int = 8001):
        self.transport = transport
        self.host = host
        self.port = port
        self.session = None
    
    async def connect_stdio(self):
        """Connect using stdio transport."""
        print("Connecting to Schichtplan MCP server via stdio...")
        
        # Configure the server parameters
        server_params = StdioServerParameters(
            command="python3",
            args=["src/backend/mcp_server.py"],
            env={"PYTHONPATH": str(project_root)}
        )
        
        # Create and start the stdio client
        async with stdio_client(server_params) as (read, write):
            async with ClientSession(read, write) as session:
                self.session = session
                
                # Initialize the session
                await session.initialize()
                print("✓ Connected successfully!")
                
                # Run examples
                await self.run_examples()
    
    async def connect_sse(self):
        """Connect using SSE transport."""
        print(f"Connecting to Schichtplan MCP server via SSE at {self.host}:{self.port}...")
        
        url = f"http://{self.host}:{self.port}/sse"
        
        try:
            async with httpx.AsyncClient() as client:
                # Test connection
                response = await client.get(url)
                if response.status_code == 200:
                    print("✓ SSE endpoint is accessible!")
                    print(f"Connect your AI tool to: {url}")
                else:
                    print(f"✗ Failed to connect to SSE endpoint: HTTP {response.status_code}")
        except Exception as e:
            print(f"✗ Connection failed: {e}")
    
    async def connect_http(self):
        """Connect using HTTP transport."""
        print(f"Connecting to Schichtplan MCP server via HTTP at {self.host}:{self.port}...")
        
        url = f"http://{self.host}:{self.port}/mcp"
        
        try:
            async with httpx.AsyncClient() as client:
                # Test connection
                response = await client.get(url)
                if response.status_code == 200:
                    print("✓ HTTP endpoint is accessible!")
                    print(f"Connect your AI tool to: {url}")
                else:
                    print(f"✗ Failed to connect to HTTP endpoint: HTTP {response.status_code}")
        except Exception as e:
            print(f"✗ Connection failed: {e}")
    
    async def run_examples(self):
        """Run example MCP tool calls."""
        if not self.session:
            print("Error: No active session")
            return
        
        print("\n" + "="*50)
        print("Running Schichtplan MCP Examples")
        print("="*50)
        
        try:
            # Example 1: Get server info
            print("\n1. Getting server information...")
            server_info = await self.session.call_tool("get_server_info", {})
            print(json.dumps(server_info.content, indent=2))
            
            # Example 2: Get capabilities
            print("\n2. Getting server capabilities...")
            capabilities = await self.session.call_tool("get_capabilities", {})
            print("Available tools:", list(capabilities.content.get("tools", {}).keys()))
            
            # Example 3: Get system status
            print("\n3. Getting system status...")
            status = await self.session.call_tool("get_system_status", {})
            print(json.dumps(status.content, indent=2))
            
            # Example 4: Get employees
            print("\n4. Getting employee list...")
            employees = await self.session.call_tool("get_employees", {
                "active_only": True,
                "include_details": False
            })
            print(f"Found {len(employees.content)} active employees")
            if employees.content:
                print("First employee:", employees.content[0])
            
            # Example 5: Get shift templates
            print("\n5. Getting shift templates...")
            shifts = await self.session.call_tool("get_shift_templates", {
                "active_only": True
            })
            print(f"Found {len(shifts.content)} active shift templates")
            if shifts.content:
                print("First shift:", shifts.content[0])
            
            # Example 6: Get existing schedule
            print("\n6. Getting existing schedule...")
            today = date.today()
            week_start = today - timedelta(days=today.weekday())
            week_end = week_start + timedelta(days=6)
            
            schedule = await self.session.call_tool("get_schedule", {
                "start_date": week_start.strftime("%Y-%m-%d"),
                "end_date": week_end.strftime("%Y-%m-%d")
            })
            print(f"Schedule data: {len(schedule.content.get('schedules', []))} schedules found")
            
            # Example 7: Test resource access
            print("\n7. Testing resource access...")
            try:
                resources = await self.session.list_resources()
                print("Available resources:", [r.uri for r in resources.resources])
                
                # Try to read system config
                config_resource = await self.session.read_resource("config://system")
                print("System config:", config_resource.contents[0].text[:200] + "...")
            except Exception as e:
                print(f"Resource access error: {e}")
            
            # Example 8: Test prompts
            print("\n8. Testing prompt templates...")
            try:
                prompts = await self.session.list_prompts()
                print("Available prompts:", [p.name for p in prompts.prompts])
                
                # Get a schedule analysis prompt
                if employees.content and shifts.content:
                    sample_data = {
                        "employees": employees.content[:3],
                        "shifts": shifts.content[:3]
                    }
                    
                    prompt = await self.session.get_prompt("schedule_analysis_prompt", {
                        "schedule_data": json.dumps(sample_data, indent=2)
                    })
                    print("Generated prompt length:", len(prompt.content))
            except Exception as e:
                print(f"Prompt access error: {e}")
            
            print("\n" + "="*50)
            print("✓ All examples completed successfully!")
            print("="*50)
            
        except Exception as e:
            print(f"\n✗ Error during examples: {e}")
            import traceback
            traceback.print_exc()


async def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Schichtplan MCP Client Examples",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )
    
    parser.add_argument(
        "--transport", "-t",
        choices=["stdio", "sse", "http"],
        default="stdio",
        help="Transport protocol to use (default: stdio)"
    )
    
    parser.add_argument(
        "--host",
        default="localhost",
        help="Host for network transports (default: localhost)"
    )
    
    parser.add_argument(
        "--port", "-p",
        type=int,
        default=8001,
        help="Port for network transports (default: 8001)"
    )
    
    args = parser.parse_args()
    
    # Create client
    client = SchichtplanMCPClient(
        transport=args.transport,
        host=args.host,
        port=args.port
    )
    
    # Connect based on transport
    try:
        if args.transport == "stdio":
            await client.connect_stdio()
        elif args.transport == "sse":
            await client.connect_sse()
        elif args.transport == "http":
            await client.connect_http()
    except KeyboardInterrupt:
        print("\n\nExiting...")
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
