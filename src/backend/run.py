#!/usr/bin/env python
"""CLI entrypoint to run the Flask app with Socket.IO enabled.

This script is invoked via `python -m src.backend.run runserver`.
It initializes Flask-SocketIO so the Socket.IO endpoint (/socket.io/) is
available and WebSocket handlers are registered.
"""

import os

import click
from dotenv import load_dotenv
from flask_socketio import SocketIO  # type: ignore

from src.backend.app import create_app
from src.backend.config import Config
from src.backend.services.websocket_service import init_websocket_service

load_dotenv()


def _get_config() -> type[Config]:
    """Return the configuration class to use for the app."""
    # Hook for future: pick Production/Testing/Development classes here
    return Config


# Create the Flask app once so it can be reused by the CLI
app = create_app(_get_config())


@click.group()
def cli() -> None:
    """CLI for the Schichtplan backend."""


@cli.command()
@click.option("--port", type=int, default=None, help="Port to listen on.")
@click.option("--host", default=None, help="Host to bind.")
@click.option("--debug", is_flag=True, help="Enable debug mode.")
def runserver(port: int | None, host: str | None, debug: bool) -> None:
    """Run the development server with Socket.IO enabled."""
    if port is None:
        port = int(os.environ.get("FLASK_PORT", 5000))
    if host is None:
        host = os.environ.get("FLASK_HOST", "0.0.0.0")
    # Initialize Socket.IO for real-time features
    socketio = SocketIO(
        app,
        cors_allowed_origins="*",
        async_mode="eventlet",  # Use eventlet for better performance
        ping_timeout=60,
        ping_interval=25,
    )

    # Register websocket event handlers and expose for other modules
    init_websocket_service(socketio)
    app.config["socketio"] = socketio

    # Use socketio.run() with eventlet
    socketio.run(
        app,
        debug=debug,
        host=host,
        port=port,
        allow_unsafe_werkzeug=True,
    )


if __name__ == "__main__":
    cli()
