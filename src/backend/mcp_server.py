#!/usr/bin/env python3
"""
Standalone FastMCP Server for Schichtplan Application

This script can be run independently to expose Schichtplan functionality
through the Model Context Protocol. Supports stdio, SSE, and streamable HTTP transports.

Usage:
    python mcp_server.py                          # Run in stdio mode (default)
    python mcp_server.py --transport sse          # Run in SSE mode
    python mcp_server.py --transport http         # Run in streamable HTTP mode
    python mcp_server.py --port 8003              # Custom port for network modes
    python mcp_server.py --help                   # Show help
"""

import argparse
import asyncio
import logging
import sys
from pathlib import Path

# Add the project root to Python path
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

from src.backend.app import create_app
from src.backend.services.mcp_service import SchichtplanMCPService


def setup_logging(level: str = "INFO", transport: str = "stdio"):
    """Setup logging configuration."""
    # For stdio mode, use file logging to avoid protocol interference
    if transport == "stdio":
        handlers = [
            logging.FileHandler("mcp_server.log", mode="a"),
        ]
    else:
        # Use stderr for network transports
        handlers = [
            logging.StreamHandler(sys.stderr),
        ]

    logging.basicConfig(
        level=getattr(logging, level.upper()),
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        handlers=handlers,
    )


async def main():
    """Main entry point for the MCP server."""
    parser = argparse.ArgumentParser(
        description="Schichtplan FastMCP Server",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )

    parser.add_argument(
        "--transport",
        "-t",
        choices=["stdio", "sse", "http"],
        default="stdio",
        help="Transport protocol to use (default: stdio)",
    )

    parser.add_argument(
        "--host",
        default="127.0.0.1",
        help="Host to bind to for network transports (default: 127.0.0.1)",
    )

    parser.add_argument(
        "--port",
        "-p",
        type=int,
        default=8001,
        help="Port to bind to for network transports (default: 8001)",
    )

    parser.add_argument(
        "--log-level",
        choices=["DEBUG", "INFO", "WARNING", "ERROR"],
        default="INFO",
        help="Logging level (default: INFO)",
    )

    args = parser.parse_args()

    # Setup logging with transport-aware configuration
    setup_logging(args.log_level, args.transport)
    logger = logging.getLogger(__name__)

    try:
        # Create Flask app context
        logger.info("Creating Flask app...")
        flask_app = create_app()

        # Create MCP service with full AI capabilities
        logger.info("Creating MCP service with full AI capabilities...")
        mcp_service = SchichtplanMCPService(flask_app)

        # Log startup information
        if args.transport == "stdio":
            logger.info("Starting Schichtplan MCP Server in stdio mode")
            logger.info("Server will communicate via standard input/output")
            logger.info(f"MCP service status: {mcp_service.get_ai_agent_status()}")
        elif args.transport == "sse":
            logger.info(
                f"Starting Schichtplan MCP Server in SSE mode on {args.host}:{args.port}"
            )
            logger.info(f"Connect via: http://{args.host}:{args.port}/sse")
        elif args.transport == "http":
            logger.info(
                f"Starting Schichtplan MCP Server in streamable HTTP mode on {args.host}:{args.port}"
            )
            logger.info(f"Connect via: http://{args.host}:{args.port}/mcp")

        # Log some debugging info about registered tools
        logger.info("MCP service initialized with tools and prompts")

        # Run the appropriate transport
        logger.info(f"Starting transport: {args.transport}")
        if args.transport == "stdio":
            logger.info("About to call run_stdio()...")
            await mcp_service.run_stdio()
        elif args.transport == "sse":
            await mcp_service.run_sse(host=args.host, port=args.port)
        elif args.transport == "http":
            await mcp_service.run_streamable_http(host=args.host, port=args.port)

    except KeyboardInterrupt:
        logger.info("Server shutdown requested")
    except Exception as e:
        logger.error(f"Server error: {str(e)}", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logging.getLogger(__name__).info("Server shutdown requested")
    except Exception as e:
        logging.getLogger(__name__).error(f"Server error: {e}", exc_info=True)
        sys.exit(1)
