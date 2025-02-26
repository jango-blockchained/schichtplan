"""
ShiftWise MCP Server Package
----------------------------

This package contains the MCP server integration for the ShiftWise application.
It provides AI-enhanced tools and resources for interacting with the application.

The main components are:
- server.py: The main MCP server
- resources.py: Functions that return data from the application
- tools.py: Functions that perform actions in the application
"""

__version__ = "1.0.0"

from flask import Flask

# Create Flask app
app = Flask("backend.app")
app.debug = True

# Import after app creation to avoid circular imports
from .server import FastMCP

# Create MCP server instance
mcp = FastMCP(app)

# Make these available at package level
__all__ = ['app', 'mcp'] 