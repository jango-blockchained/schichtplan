#!/usr/bin/env python3
"""
VS Code compatible MCP server entry point for Schichtplan

This script is specifically designed to work with VS Code's MCP extension
which runs the server in its own asyncio context.
"""

import sys
import logging
from pathlib import Path

# Add the project root to Python path
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

# Set minimal logging for stdio mode
logging.basicConfig(level=logging.ERROR, handlers=[logging.StreamHandler(sys.stderr)])

from src.backend.app import create_app
from src.backend.services.mcp_service import SchichtplanMCPService

def main():
    """Main entry point that works in VS Code's asyncio context."""
    try:
        # Create Flask app context
        flask_app = create_app()
        
        # Create MCP service
        mcp_service = SchichtplanMCPService(flask_app)
        
        # Get the underlying FastMCP instance
        mcp = mcp_service.get_mcp_instance()
        
        # Use the MCP stdio server directly without anyio.run()
        import asyncio
        from mcp.server.stdio import stdio_server
        
        async def run_stdio_server():
            """Run the MCP server using stdio transport."""
            async with stdio_server() as (read_stream, write_stream):
                await mcp.run_async(read_stream, write_stream)
        
        # Check if we're already in an event loop
        try:
            loop = asyncio.get_running_loop()
            # We're in an event loop, schedule as a task
            task = asyncio.create_task(run_stdio_server())
            # This will block until the task completes
            loop.run_until_complete(task)
        except RuntimeError:
            # No event loop running, create one
            asyncio.run(run_stdio_server())
            
    except Exception as e:
        # Log error and exit
        logging.error(f"MCP Server startup failed: {e}", exc_info=True)
        sys.exit(1)

if __name__ == "__main__":
    main()
