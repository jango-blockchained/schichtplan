"""
Schichtplan MCP Server Package
----------------------------

This package contains the MCP server integration for the Schichtplan application.
It provides AI-enhanced tools and resources for interacting with the application.

The main components are:
- server.py: The main MCP server with real database connection
- claude_server.py: MCP server optimized for Claude integration
- simple_server.py: Simplified server with mock data
- resources.py: Functions that return data from the application
- tools.py: Functions that perform actions in the application
"""

__version__ = "1.0.0"

# Don't try to import anything that might cause circular imports
# Each server module should be runnable independently
