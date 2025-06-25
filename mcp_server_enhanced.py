#!/usr/bin/env python3
"""
Enhanced MCP Server for Schichtplan Application

Supports both full AI capabilities and simplified mode for stability.
Can switch between modes based on configuration or runtime conditions.
"""

import argparse
import asyncio
import logging
import sys
import threading
from pathlib import Path

# Add the project root to Python path
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

from src.backend.app import create_app


def setup_logging(level: str = "INFO"):
    """Setup logging configuration."""
    logging.basicConfig(
        level=getattr(logging, level.upper()),
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        handlers=[
            logging.StreamHandler(sys.stderr),
        ],
    )


async def main():
    """Main entry point for the enhanced MCP server."""
    parser = argparse.ArgumentParser(
        description="Enhanced Schichtplan FastMCP Server with AI capabilities"
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

    parser.add_argument(
        "--mode",
        choices=["full", "simplified", "auto"],
        default="auto",
        help="AI mode: full (all AI features), simplified (basic), auto (detect best) (default: auto)",
    )

    args = parser.parse_args()

    # Setup logging
    setup_logging(args.log_level)
    logger = logging.getLogger(__name__)

    try:
        # Create Flask app context
        logger.info("Creating Flask app...")
        flask_app = create_app()

        # Determine which MCP service to use
        mcp_service = None
        service_mode = args.mode

        if service_mode == "full":
            logger.info("Creating full MCP service with AI capabilities...")
            from src.backend.services.mcp_service import SchichtplanMCPService

            mcp_service = SchichtplanMCPService(flask_app, logger)

        elif service_mode == "simplified":
            logger.info("Creating simplified MCP service...")
            from src.backend.services.mcp_service_simplified import SimplifiedMCPService

            mcp_service = SimplifiedMCPService(flask_app, logger)

        elif service_mode == "auto":
            # Try full mode first, fallback to simplified if it fails
            try:
                logger.info("Auto mode: attempting to create full MCP service...")
                from src.backend.services.mcp_service import SchichtplanMCPService

                mcp_service = SchichtplanMCPService(flask_app, logger)

                # Test AI initialization
                await mcp_service.init_conversation_manager()
                await mcp_service.init_ai_agent_system()

                status = mcp_service.get_ai_agent_status()
                if status.get("full_ai_capabilities", False):
                    service_mode = "full"
                    logger.info("Auto mode: full AI capabilities available")
                else:
                    raise RuntimeError("AI components not fully available")

            except Exception as e:
                logger.warning(
                    f"Auto mode: full service failed ({e}), falling back to simplified mode"
                )
                service_mode = "simplified"
                logger.info("Creating simplified MCP service...")
                from src.backend.services.mcp_service_simplified import (
                    SimplifiedMCPService,
                )

                mcp_service = SimplifiedMCPService(flask_app, logger)

        # Ensure we have a service (fallback safety)
        if mcp_service is None:
            logger.warning("No MCP service created, falling back to simplified mode")
            from src.backend.services.mcp_service_simplified import SimplifiedMCPService

            mcp_service = SimplifiedMCPService(flask_app, logger)
            service_mode = "simplified"

        # Log startup information
        if args.transport == "stdio":
            logger.info(
                f"Starting Enhanced Schichtplan MCP Server in stdio mode ({service_mode} mode)"
            )
            logger.info("Server will communicate via standard input/output")
            logger.info(f"MCP service status: {mcp_service.get_ai_agent_status()}")
        elif args.transport == "sse":
            logger.info(
                f"Starting Enhanced Schichtplan MCP Server in SSE mode on {args.host}:{args.port} ({service_mode} mode)"
            )
            logger.info(f"Connect via: http://{args.host}:{args.port}/sse")
        elif args.transport == "http":
            logger.info(
                f"Starting Enhanced Schichtplan MCP Server in streamable HTTP mode on {args.host}:{args.port} ({service_mode} mode)"
            )
            logger.info(f"Connect via: http://{args.host}:{args.port}/mcp")

        # Log service capabilities
        if service_mode == "full":
            logger.info(
                "Full AI capabilities: conversation management, agent registry, workflow coordination"
            )
        else:
            logger.info("Simplified mode: core tools only, no AI agents")

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


def main_cli():
    """CLI entry point for uvx distribution."""
    # For stdio mode, we need to be more careful about output
    if len(sys.argv) == 1 or (
        len(sys.argv) > 1 and "--transport" not in sys.argv and "-t" not in sys.argv
    ):
        # Default to stdio mode - less verbose logging
        setup_logging("WARNING")

    def run_main():
        """Run main in a completely separate process context."""
        try:
            # Create a completely new event loop
            new_loop = asyncio.new_event_loop()
            asyncio.set_event_loop(new_loop)
            try:
                new_loop.run_until_complete(main())
            finally:
                new_loop.close()
        except Exception as e:
            logging.getLogger(__name__).error(f"Server error: {e}", exc_info=True)

    # Always run in a separate thread to avoid any event loop conflicts
    thread = threading.Thread(target=run_main)
    thread.daemon = False  # Don't make it a daemon so it keeps the process alive
    thread.start()
    thread.join()


if __name__ == "__main__":
    main_cli()
