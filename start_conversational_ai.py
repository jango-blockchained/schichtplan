#!/usr/bin/env python3
"""
Conversational AI MCP Server Startup Script

This script initializes and starts the conversational AI MCP server with
full integration of conversation management, AI orchestration, and tool usage.
"""

import argparse
import asyncio
import logging
import signal
import sys

# Add the src path for imports
sys.path.append("/home/jango/Git/maike2/schichtplan/src")

from backend.app import create_app
from backend.services.config import ConversationalAIConfig, get_config
from backend.services.conversational_mcp_service import (
    create_conversational_mcp_service,
)
from backend.services.mcp_service import SchichtplanMCPService


class ConversationalMCPServer:
    """Main server class for conversational AI MCP service."""

    def __init__(self, config: ConversationalAIConfig):
        self.config = config
        self.flask_app = None
        self.base_mcp_service = None
        self.conversational_service = None
        self.server_task = None
        self.cleanup_task = None
        self.logger = logging.getLogger(__name__)

        # Setup logging
        self.config.setup_logging()

        # Track server state
        self.is_running = False
        self.shutdown_event = asyncio.Event()

    async def initialize(self) -> bool:
        """Initialize all server components."""

        self.logger.info("🚀 Initializing Conversational AI MCP Server...")

        try:
            # Validate configuration
            config_errors = self.config.validate()
            if config_errors:
                self.logger.error("Configuration validation failed:")
                for error in config_errors:
                    self.logger.error(f"  - {error}")
                return False

            # Create Flask app
            self.logger.info("Creating Flask application...")
            self.flask_app = create_app()

            # Create base MCP service
            self.logger.info("Creating base MCP service...")
            with self.flask_app.app_context():
                self.base_mcp_service = SchichtplanMCPService(self.flask_app)

            # Create conversational service
            self.logger.info("Creating conversational AI service...")
            self.conversational_service = await create_conversational_mcp_service(
                base_mcp_service=self.base_mcp_service,
                redis_url=self.config.conversations.redis_url,
                openai_key=self.config.ai_providers.openai_api_key,
                anthropic_key=self.config.ai_providers.anthropic_api_key,
                gemini_key=self.config.ai_providers.gemini_api_key,
            )

            # Test connections
            if not await self._test_connections():
                return False

            self.logger.info("✅ Server initialization completed successfully!")
            return True

        except Exception as e:
            self.logger.error(f"❌ Server initialization failed: {e}")
            return False

    async def _test_connections(self) -> bool:
        """Test all external connections."""

        self.logger.info("Testing connections...")

        try:
            # Test AI providers
            ai_orchestrator = self.conversational_service.ai_orchestrator

            for provider_type, provider in ai_orchestrator.providers.items():
                try:
                    if await provider.validate_connection():
                        self.logger.info(f"✅ {provider_type.value} connection OK")
                    else:
                        self.logger.warning(
                            f"⚠️  {provider_type.value} connection failed"
                        )
                except Exception as e:
                    self.logger.warning(f"⚠️  {provider_type.value} test error: {e}")

            # Test Redis connection
            try:
                conversation_manager = self.conversational_service.conversation_manager
                # Try to create and retrieve a test conversation
                test_context = await conversation_manager.create_conversation(
                    user_id="test_connection", session_id="test_session"
                )

                retrieved = await conversation_manager.get_conversation(
                    test_context.conversation_id
                )
                if retrieved:
                    await conversation_manager.state_store.delete_conversation(
                        test_context.conversation_id
                    )
                    self.logger.info("✅ Redis connection OK")
                else:
                    self.logger.error("❌ Redis connection test failed")
                    return False

            except Exception as e:
                self.logger.error(f"❌ Redis connection failed: {e}")
                return False

            # Test database connection
            try:
                with self.flask_app.app_context():
                    from backend.models import db

                    db.session.execute(db.text("SELECT 1"))
                    db.session.commit()
                self.logger.info("✅ Database connection OK")

            except Exception as e:
                self.logger.error(f"❌ Database connection failed: {e}")
                return False

            return True

        except Exception as e:
            self.logger.error(f"❌ Connection testing failed: {e}")
            return False

    async def start_server(self, transport: str = "stdio", port: int = None):
        """Start the MCP server with specified transport."""

        if self.is_running:
            self.logger.warning("Server is already running")
            return

        self.logger.info(f"🌟 Starting MCP server with {transport} transport...")

        try:
            # Get the MCP server instance
            mcp_server = self.conversational_service.mcp

            # Start background tasks
            self.cleanup_task = asyncio.create_task(self._cleanup_loop())

            # Start the appropriate transport
            if transport == "stdio":
                self.server_task = asyncio.create_task(mcp_server.run())
            elif transport == "sse":
                from fastmcp.transports.sse import sse_transport

                port = port or self.config.mcp_server_port
                self.server_task = asyncio.create_task(
                    mcp_server.run_transport(sse_transport(port=port))
                )
            elif transport == "http":
                from fastmcp.transports.http import http_transport

                port = port or self.config.mcp_server_port + 1
                self.server_task = asyncio.create_task(
                    mcp_server.run_transport(http_transport(port=port))
                )
            else:
                raise ValueError(f"Unsupported transport: {transport}")

            self.is_running = True
            self.logger.info(
                f"🚀 MCP server started on {transport}" + (f":{port}" if port else "")
            )

            # Setup signal handlers
            self._setup_signal_handlers()

            # Wait for shutdown
            await self.shutdown_event.wait()

        except Exception as e:
            self.logger.error(f"❌ Server start failed: {e}")
            raise

    async def stop_server(self):
        """Stop the MCP server gracefully."""

        if not self.is_running:
            return

        self.logger.info("🛑 Stopping MCP server...")

        try:
            # Cancel server task
            if self.server_task and not self.server_task.done():
                self.server_task.cancel()
                try:
                    await self.server_task
                except asyncio.CancelledError:
                    pass

            # Cancel cleanup task
            if self.cleanup_task and not self.cleanup_task.done():
                self.cleanup_task.cancel()
                try:
                    await self.cleanup_task
                except asyncio.CancelledError:
                    pass

            # Cleanup conversations
            if self.conversational_service:
                await self.conversational_service.conversation_manager.cleanup_expired_conversations()

            self.is_running = False
            self.shutdown_event.set()

            self.logger.info("✅ MCP server stopped gracefully")

        except Exception as e:
            self.logger.error(f"❌ Error stopping server: {e}")

    async def _cleanup_loop(self):
        """Background task for periodic cleanup."""

        while self.is_running:
            try:
                await asyncio.sleep(self.config.conversations.cleanup_interval)

                if not self.is_running:
                    break

                # Cleanup expired conversations
                if self.conversational_service:
                    count = await self.conversational_service.conversation_manager.cleanup_expired_conversations()
                    if count > 0:
                        self.logger.info(f"🧹 Cleaned up {count} expired conversations")

            except asyncio.CancelledError:
                break
            except Exception as e:
                self.logger.error(f"Error in cleanup loop: {e}")

    def _setup_signal_handlers(self):
        """Setup signal handlers for graceful shutdown."""

        def signal_handler(signum, frame):
            self.logger.info(f"Received signal {signum}, initiating shutdown...")
            asyncio.create_task(self.stop_server())

        # Handle common signals
        signal.signal(signal.SIGINT, signal_handler)
        signal.signal(signal.SIGTERM, signal_handler)

        if hasattr(signal, "SIGHUP"):
            signal.signal(signal.SIGHUP, signal_handler)

    async def health_check(self) -> dict:
        """Perform health check and return status."""

        health_status = {
            "timestamp": asyncio.get_event_loop().time(),
            "server_running": self.is_running,
            "components": {},
        }

        if not self.conversational_service:
            health_status["status"] = "not_initialized"
            return health_status

        try:
            # Check MCP health
            with self.flask_app.app_context():
                mcp_health = (
                    await self.conversational_service.base_service.mcp_health_check()
                )
                health_status["components"]["mcp"] = mcp_health.get("status", "unknown")

            # Check conversation manager
            try:
                await self.conversational_service.conversation_manager.cleanup_expired_conversations()
                health_status["components"]["conversation_manager"] = "healthy"
            except Exception as e:
                health_status["components"]["conversation_manager"] = f"error: {e}"

            # Check AI providers
            ai_status = {}
            for (
                provider_type,
                provider,
            ) in self.conversational_service.ai_orchestrator.providers.items():
                try:
                    if await provider.validate_connection():
                        ai_status[provider_type.value] = "healthy"
                    else:
                        ai_status[provider_type.value] = "connection_failed"
                except Exception as e:
                    ai_status[provider_type.value] = f"error: {e}"

            health_status["components"]["ai_providers"] = ai_status

            # Overall status
            all_healthy = all(
                status == "healthy"
                for status in health_status["components"].values()
                if isinstance(status, str)
            )
            health_status["status"] = "healthy" if all_healthy else "degraded"

        except Exception as e:
            health_status["status"] = "error"
            health_status["error"] = str(e)

        return health_status


def main():
    """Main entry point for the server."""

    parser = argparse.ArgumentParser(description="Conversational AI MCP Server")
    parser.add_argument(
        "--transport",
        choices=["stdio", "sse", "http"],
        default="stdio",
        help="Transport protocol to use",
    )
    parser.add_argument("--port", type=int, help="Port number for SSE/HTTP transport")
    parser.add_argument("--config", help="Configuration file path")
    parser.add_argument(
        "--environment",
        choices=["development", "production"],
        default="development",
        help="Environment configuration to use",
    )
    parser.add_argument(
        "--health-check", action="store_true", help="Perform health check and exit"
    )
    parser.add_argument("--test", action="store_true", help="Run tests and exit")
    parser.add_argument(
        "--generate-config", help="Generate example configuration file and exit"
    )

    args = parser.parse_args()

    # Generate config and exit
    if args.generate_config:
        from backend.services.config import save_example_config

        save_example_config(args.generate_config)
        return

    # Load configuration
    if args.config:
        config = ConversationalAIConfig.from_file(args.config)
    else:
        config = get_config(args.environment)

    # Override port if specified
    if args.port:
        config.mcp_server_port = args.port

    # Create server
    server = ConversationalMCPServer(config)

    async def run_server():
        # Initialize server
        if not await server.initialize():
            print("❌ Server initialization failed")
            return 1

        # Health check mode
        if args.health_check:
            health = await server.health_check()
            print(f"Health status: {health['status']}")
            for component, status in health.get("components", {}).items():
                print(f"  {component}: {status}")
            return 0 if health["status"] == "healthy" else 1

        # Test mode
        if args.test:
            print("Running conversational AI tests...")
            # Import and run the test suite
            sys.path.append("/home/jango/Git/maike2/schichtplan")
            from test_conversational_ai import ConversationalAISetup

            setup = ConversationalAISetup()
            setup.flask_app = server.flask_app
            setup.base_mcp_service = server.base_mcp_service
            setup.conversational_service = server.conversational_service

            success = await setup.demonstrate_system()
            return 0 if success else 1

        # Start server
        try:
            await server.start_server(args.transport, args.port)
            return 0
        except KeyboardInterrupt:
            print("\n🛑 Received keyboard interrupt, shutting down...")
            await server.stop_server()
            return 0
        except Exception as e:
            print(f"❌ Server error: {e}")
            return 1

    # Run the server
    try:
        exit_code = asyncio.run(run_server())
        sys.exit(exit_code)
    except KeyboardInterrupt:
        print("\n👋 Goodbye!")
        sys.exit(0)


if __name__ == "__main__":
    main()
