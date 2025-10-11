#!/usr/bin/env python3
"""
Minimal MCP Server for Schichtplan

Simplified version without AI agent dependencies to isolate the MCP protocol issues.
"""

import asyncio
import logging
import signal
import sys
from pathlib import Path
from typing import Any, Dict, Optional

# Add the project root to Python path
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

from fastmcp import FastMCP
from flask import Flask


def setup_logging(level: str = "INFO"):
    """Setup logging configuration."""
    logging.basicConfig(
        level=getattr(logging, level.upper()),
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        handlers=[
            logging.StreamHandler(sys.stderr),
        ],
    )


class MinimalMCPService:
    """Minimal MCP service for testing."""

    def __init__(self, flask_app: Optional[Flask] = None):
        self.flask_app = flask_app
        self.logger = logging.getLogger(__name__)
        self.logger.info("Creating minimal MCP service...")

        self.mcp = FastMCP("Minimal-Schichtplan", "Minimal MCP server for testing")

        self._register_tools()
        self._register_prompts()

        self.logger.info("Minimal MCP service created successfully")

    def _register_tools(self):
        """Register basic tools."""
        self.logger.info("Registering tools...")

        @self.mcp.tool()
        async def get_server_status(ctx) -> Dict[str, Any]:
            """Get the server status."""
            return {
                "status": "running",
                "server": "minimal-mcp",
                "tools_registered": True,
                "prompts_registered": True,
            }

        @self.mcp.tool()
        async def echo_message(ctx, message: str) -> str:
            """Echo a message back."""
            return f"Echo: {message}"

        self.logger.info("Tools registered successfully")

    def _register_prompts(self):
        """Register basic prompts."""
        self.logger.info("Registering prompts...")

        try:

            @self.mcp.prompt()
            async def test_prompt(ctx, **kwargs):
                """A simple test prompt."""
                return "This is a test prompt for the minimal MCP server."

            @self.mcp.prompt()
            async def status_prompt(ctx, **kwargs):
                """Prompt for server status."""
                return "Please check the server status and report any issues."

            self.logger.info("Prompts registered successfully")
        except Exception as e:
            self.logger.error(f"Failed to register prompts: {e}", exc_info=True)

    async def run_stdio(self):
        """Run the MCP server in stdio mode."""
        self.logger.info("Starting minimal MCP server in stdio mode...")

        try:
            # Set up signal handlers for graceful shutdown
            def signal_handler(signum, frame):
                self.logger.info(f"Received signal {signum}, shutting down...")
                sys.exit(0)

            signal.signal(signal.SIGINT, signal_handler)
            signal.signal(signal.SIGTERM, signal_handler)

            self.logger.info("Signal handlers set up")
            self.logger.info("About to start FastMCP stdio server...")

            # This should block until the server is stopped
            await self.mcp.run_stdio_async()

        except Exception as e:
            self.logger.error(f"Error in stdio server: {e}", exc_info=True)
            raise


async def main():
    """Main entry point."""
    import argparse

    parser = argparse.ArgumentParser(description="Minimal MCP Server")
    parser.add_argument(
        "--log-level", default="INFO", choices=["DEBUG", "INFO", "WARNING", "ERROR"]
    )
    args = parser.parse_args()

    setup_logging(args.log_level)
    logger = logging.getLogger(__name__)

    try:
        logger.info("=== Starting Minimal MCP Server ===")

        # Create Flask app (minimal)
        logger.info("Creating minimal Flask app...")
        from src.backend.app import create_app

        flask_app = create_app()
        logger.info("Flask app created")

        # Create minimal MCP service
        logger.info("Creating minimal MCP service...")
        mcp_service = MinimalMCPService(flask_app)

        # Run stdio server
        logger.info("Starting stdio server...")
        await mcp_service.run_stdio()

    except KeyboardInterrupt:
        logger.info("Server shutdown requested by user")
    except Exception as e:
        logger.error(f"Server error: {e}", exc_info=True)
        sys.exit(1)
    finally:
        logger.info("=== Minimal MCP Server Shutdown ===")


if __name__ == "__main__":
    asyncio.run(main())
