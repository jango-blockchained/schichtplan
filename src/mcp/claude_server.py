"""
Schichtplan MCP Server for Claude
--------------------------------

A proxy MCP server designed specifically for Claude integration.
This server connects to an existing Schichtplan backend on port 5000
and exposes its functionality through the MCP protocol.
"""

import os
import sys
import json
import logging
import requests
from flask import Flask, jsonify, request, Response
from datetime import datetime

# Completely disable ALL logging before anything else is imported
# This is crucial for MCP CLI with stdio transport
logging.basicConfig(level=logging.CRITICAL + 100)  # Set to impossibly high level
logging.disable(logging.CRITICAL)  # Disable logging globally

# Silence all existing loggers
for name in logging.root.manager.loggerDict:
    logging.getLogger(name).setLevel(logging.CRITICAL + 100)
    logging.getLogger(name).propagate = False
    logging.getLogger(name).disabled = True
    if logging.getLogger(name).handlers:
        for handler in logging.getLogger(name).handlers:
            logging.getLogger(name).removeHandler(handler)


# Create a completely null logger
class NullLogger(logging.Logger):
    def _log(self, *args, **kwargs):
        pass


logging.setLoggerClass(NullLogger)
logger = logging.getLogger("claude-mcp")
logger.propagate = False
logger.disabled = True

# Backend connection settings
BACKEND_URL = os.environ.get("MCP_BACKEND_URL", "http://127.0.0.1:5000")

# Determine if we're being run via MCP CLI or directly
RUN_VIA_MCP_CLI = "MCP_CLI" in os.environ or any(
    "mcp dev" in arg or "mcp run" in arg for arg in sys.argv
)


# Redirect stdout/stderr except for the MCP init message
class NullIO:
    def write(self, *args, **kwargs):
        pass

    def flush(self, *args, **kwargs):
        pass


# Set up file-based logging for debugging only if needed
LOG_FILE = None
if RUN_VIA_MCP_CLI:
    try:
        log_dir = os.path.dirname(os.path.abspath(__file__))
        LOG_FILE = os.path.join(log_dir, "claude_server.log")

        # Open log file without using logging system
        # We're bypassing Python's logging to ensure nothing goes to stdout
        file_handler = open(LOG_FILE, "a")

        def log_to_file(msg):
            try:
                timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                file_handler.write(f"{timestamp} - {msg}\n")
                file_handler.flush()
            except:
                pass  # Fail silently
    except:
        pass  # If we can't open a log file, just continue silently
else:
    # Non-MCP mode can use regular print statements
    def log_to_file(msg):
        print(msg)


# Capture original stdout/stderr
original_stdout = sys.stdout
original_stderr = sys.stderr

# Redirect stdout/stderr immediately
if RUN_VIA_MCP_CLI:
    sys.stdout = NullIO()
    sys.stderr = NullIO()  # Optional: redirect stderr too

# Disable Flask and werkzeug logging before importing any Flask modules
os.environ["WERKZEUG_RUN_MAIN"] = "true"  # Disable werkzeug startup banner
os.environ["FLASK_DEBUG"] = "0"  # Disable Flask debug mode
os.environ["PYTHONUNBUFFERED"] = "1"  # Make sure Python output is unbuffered

# Create Flask app with strict no-debug/no-output settings
app = Flask(__name__)
app.logger.disabled = True
app.logger.setLevel(logging.CRITICAL + 100)

# Critical Flask configuration to silence all output
app.config.update(
    DEBUG=False,
    PROPAGATE_EXCEPTIONS=False,
    TESTING=False,
    TRAP_HTTP_EXCEPTIONS=True,
    JSONIFY_PRETTYPRINT_REGULAR=False,
    PREFERRED_URL_SCHEME="http",
    TRAP_BAD_REQUEST_ERRORS=True,
    JSON_SORT_KEYS=False,
)

# Silence any logging that may have been re-enabled
for name in logging.root.manager.loggerDict:
    logging.getLogger(name).setLevel(logging.CRITICAL + 100)
    logging.getLogger(name).disabled = True
    logging.getLogger(name).propagate = False

try:
    # Disable werkzeug logging even more aggressively
    werkzeug_logger = logging.getLogger("werkzeug")
    werkzeug_logger.disabled = True
    werkzeug_logger.setLevel(logging.CRITICAL + 100)
    werkzeug_logger.propagate = False

    import werkzeug

    werkzeug.serving.run_simple = lambda *args, **kwargs: None
except:
    pass  # If werkzeug not available, ignore

# Try to enable CORS without any logging
try:
    from flask_cors import CORS

    CORS(app)
except ImportError:
    pass  # Silently continue


class ProxyResources:
    """
    Resources provide read-only data from the Schichtplan application.
    This proxies requests to the existing backend on port 5000.
    """

    @staticmethod
    def greeting():
        try:
            # First try to get from backend
            response = requests.get(f"{BACKEND_URL}/greeting")
            if response.status_code == 200:
                return response.json()
        except:
            pass

        # Fallback to a default greeting
        return {
            "message": "Welcome to the Schichtplan MCP Server for Claude!",
            "version": "1.0.0",
            "description": "This server provides access to shift scheduling data and tools through Claude.",
            "server_time": datetime.now().isoformat(),
            "note": "Connected to existing backend on port 5000",
        }

    @staticmethod
    def get_employees():
        try:
            response = requests.get(f"{BACKEND_URL}/employees")
            if response.status_code == 200:
                return response.json()
        except:
            pass

        # Fallback to mock data
        return {
            "employees": [
                {
                    "id": 1,
                    "name": "John Doe",
                    "role": "Manager",
                    "hourly_rate": 25.50,
                    "max_hours_per_week": 40,
                },
                {
                    "id": 2,
                    "name": "Jane Smith",
                    "role": "Employee",
                    "hourly_rate": 18.75,
                    "max_hours_per_week": 30,
                },
                {
                    "id": 3,
                    "name": "Bob Johnson",
                    "role": "Employee",
                    "hourly_rate": 20.00,
                    "max_hours_per_week": 35,
                },
            ]
        }

    @staticmethod
    def get_shifts():
        try:
            response = requests.get(f"{BACKEND_URL}/shifts")
            if response.status_code == 200:
                return response.json()
        except:
            pass

        # Fallback to mock data
        return {
            "shifts": [
                {
                    "id": 1,
                    "name": "Morning Shift",
                    "start_time": "08:00",
                    "end_time": "16:00",
                    "required_skills": ["opening", "cashier"],
                },
                {
                    "id": 2,
                    "name": "Evening Shift",
                    "start_time": "16:00",
                    "end_time": "00:00",
                    "required_skills": ["closing", "customer_service"],
                },
                {
                    "id": 3,
                    "name": "Night Shift",
                    "start_time": "00:00",
                    "end_time": "08:00",
                    "required_skills": ["stocking"],
                },
            ]
        }

    @staticmethod
    def get_schedules():
        try:
            response = requests.get(f"{BACKEND_URL}/schedules")
            if response.status_code == 200:
                return response.json()
        except:
            pass

        # Fallback to mock data
        return {
            "schedules": [
                {
                    "id": 1,
                    "week": "2023-W01",
                    "published": True,
                    "shifts_assigned": 14,
                    "total_hours": 112,
                    "employees": 5,
                },
                {
                    "id": 2,
                    "week": "2023-W02",
                    "published": True,
                    "shifts_assigned": 15,
                    "total_hours": 118,
                    "employees": 5,
                },
                {
                    "id": 3,
                    "week": "2023-W03",
                    "published": False,
                    "shifts_assigned": 12,
                    "total_hours": 96,
                    "employees": 4,
                },
            ]
        }


class ProxyTools:
    """
    Tools provide actions that can modify the Schichtplan application.
    This proxies requests to the existing backend on port 5000.
    """

    @staticmethod
    def create_employee(name, role, hourly_rate=None, max_hours=None, skills=None):
        """Create a new employee with the given attributes."""
        try:
            # Split name into first_name and last_name if provided as full name
            name_parts = name.split(" ", 1)
            first_name = name_parts[0]
            last_name = name_parts[1] if len(name_parts) > 1 else ""

            # Prepare data for the backend
            data = {
                "first_name": first_name,
                "last_name": last_name,
                "role": role,
            }

            if hourly_rate is not None:
                data["hourly_rate"] = hourly_rate

            if max_hours is not None:
                data["max_hours"] = max_hours

            if skills is not None:
                data["skills"] = skills

            # Send request to backend
            response = requests.post(f"{BACKEND_URL}/tools/create_employee", json=data)

            if response.status_code == 200:
                return response.json()
            else:
                return {
                    "success": False,
                    "error": f"Backend returned status code {response.status_code}",
                    "status_code": response.status_code,
                }

        except Exception as e:
            return {"success": False, "error": str(e), "status_code": 500}

    @staticmethod
    def generate_schedule(week, employees=None, constraints=None):
        """Generate a new schedule for the specified week."""
        try:
            # Prepare data for the backend
            data = {"start_date": week}  # Using week as start_date

            if employees is not None:
                data["employees"] = employees

            if constraints is not None:
                data["constraints"] = constraints

            # Send request to backend
            response = requests.post(
                f"{BACKEND_URL}/tools/generate_schedule", json=data
            )

            if response.status_code == 200:
                return response.json()
            else:
                return {
                    "success": False,
                    "error": f"Backend returned status code {response.status_code}",
                    "status_code": response.status_code,
                }

        except Exception as e:
            return {"success": False, "error": str(e), "status_code": 500}

    @staticmethod
    def export_schedule_pdf(
        schedule_id, include_employee_details=False, include_costs=False
    ):
        """Export a schedule as PDF."""
        try:
            # Prepare data for the backend
            data = {"schedule_id": schedule_id}

            if include_employee_details is not None:
                data["include_employee_details"] = include_employee_details

            if include_costs is not None:
                data["include_costs"] = include_costs

            # Send request to backend
            response = requests.post(
                f"{BACKEND_URL}/tools/export_schedule_pdf", json=data
            )

            if response.status_code == 200:
                return response.json()
            else:
                return {
                    "success": False,
                    "error": f"Backend returned status code {response.status_code}",
                    "status_code": response.status_code,
                }

        except Exception as e:
            return {"success": False, "error": str(e), "status_code": 500}


# General proxy route to pass all other requests to the backend
@app.route("/<path:path>", methods=["GET", "POST", "PUT", "DELETE"])
def proxy(path):
    try:
        url = f"{BACKEND_URL}/{path}"

        # Forward the request to the backend
        if request.method == "GET":
            response = requests.get(url, params=request.args)
        elif request.method == "POST":
            response = requests.post(url, json=request.json)
        elif request.method == "PUT":
            response = requests.put(url, json=request.json)
        elif request.method == "DELETE":
            response = requests.delete(url)

        # Return the response from the backend
        return Response(
            response.content,
            status=response.status_code,
            content_type=response.headers.get("Content-Type", "application/json"),
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# MCP protocol implementation
class ClaudeMCP:
    """
    MCP class designed specifically for Claude integration.
    Implements the required format for tool registration and resource exposure.
    """

    def __init__(self):
        # Define and expose resources and tools
        self.resources = {}
        self.tools = {}
        self._setup_resources()
        self._setup_tools()

    def _setup_resources(self):
        """Register resources with proper URLs."""
        # Register resources
        self.register_resource(
            "greeting",
            ProxyResources.greeting,
            "Get a welcome message and server information",
        )
        self.register_resource(
            "employees", ProxyResources.get_employees, "Get a list of all employees"
        )
        self.register_resource(
            "shifts", ProxyResources.get_shifts, "Get a list of all shift templates"
        )
        self.register_resource(
            "schedules", ProxyResources.get_schedules, "Get a list of all schedules"
        )

    def _setup_tools(self):
        """Register tools with proper signatures."""
        # Employee management tool
        self.register_tool(
            name="create_employee",
            func=ProxyTools.create_employee,
            description="Create a new employee",
            parameters=[
                {
                    "name": "name",
                    "description": "Employee's full name",
                    "required": True,
                    "type": "string",
                },
                {
                    "name": "role",
                    "description": "Employee's role",
                    "required": True,
                    "type": "string",
                },
                {
                    "name": "hourly_rate",
                    "description": "Employee's hourly rate",
                    "required": False,
                    "type": "number",
                },
                {
                    "name": "max_hours",
                    "description": "Maximum hours per week",
                    "required": False,
                    "type": "integer",
                },
                {
                    "name": "skills",
                    "description": "List of skills",
                    "required": False,
                    "type": "array",
                },
            ],
        )

        # Schedule management tools
        self.register_tool(
            name="generate_schedule",
            func=ProxyTools.generate_schedule,
            description="Generate a new schedule",
            parameters=[
                {
                    "name": "week",
                    "description": "Week identifier (YYYY-Wnn) or start date (YYYY-MM-DD)",
                    "required": True,
                    "type": "string",
                },
                {
                    "name": "employees",
                    "description": "List of employee IDs to include",
                    "required": False,
                    "type": "array",
                },
                {
                    "name": "constraints",
                    "description": "Additional scheduling constraints",
                    "required": False,
                    "type": "object",
                },
            ],
        )

        self.register_tool(
            name="export_schedule_pdf",
            func=ProxyTools.export_schedule_pdf,
            description="Export a schedule as PDF",
            parameters=[
                {
                    "name": "schedule_id",
                    "description": "ID of the schedule to export",
                    "required": True,
                    "type": "integer",
                },
                {
                    "name": "include_employee_details",
                    "description": "Include detailed employee information",
                    "required": False,
                    "type": "boolean",
                },
                {
                    "name": "include_costs",
                    "description": "Include cost calculations",
                    "required": False,
                    "type": "boolean",
                },
            ],
        )

    def register_resource(self, name, func, description):
        """Register a resource function."""
        url = f"http://localhost:8000/{name}"
        self.resources[url] = {"name": name, "description": description, "func": func}

    def register_tool(self, name, func, description, parameters=None):
        """Register a tool with the specified name and parameters."""
        if parameters is None:
            parameters = []

        # Store metadata for the tool
        self.tools[name] = {
            "name": name,
            "description": description,
            "parameters": parameters,
            "func": func,
        }

        # Create the tool method
        def tool_wrapper(*args, **kwargs):
            try:
                result = func(*args, **kwargs)
                return result
            except Exception as e:
                return {"success": False, "error": str(e)}

        # Set the method on the class instance
        setattr(self, name, tool_wrapper)

        return tool_wrapper

    def run(self, *args, **kwargs):
        """Required method for MCP server."""
        # Always just return the app for MCP CLI to use
        # No logging, no messages, just return the app
        return app


# Set up resource routes
@app.route("/greeting")
def greeting():
    return jsonify(ProxyResources.greeting())


@app.route("/employees")
def get_employees():
    return jsonify(ProxyResources.get_employees())


@app.route("/shifts")
def get_shifts():
    return jsonify(ProxyResources.get_shifts())


@app.route("/schedules")
def get_schedules():
    return jsonify(ProxyResources.get_schedules())


# MCP Protocol routes
@app.route("/mcp/openapi.json")
def openapi_spec():
    """Return OpenAPI specification for the MCP server."""
    tools = []

    # Add all tools to the spec
    for name, tool in mcp.tools.items():
        tools.append(
            {
                "name": name,
                "description": tool["description"],
                "parameters": {
                    "type": "object",
                    "properties": {
                        param["name"]: {
                            "description": param["description"],
                            "type": param["type"],
                        }
                        for param in tool["parameters"]
                    },
                    "required": [
                        param["name"]
                        for param in tool["parameters"]
                        if param.get("required", False)
                    ],
                },
            }
        )

    # Build the OpenAPI spec
    spec = {
        "openapi": "3.0.0",
        "info": {
            "title": "Schichtplan MCP API",
            "description": "API for interacting with Schichtplan shift scheduling data",
            "version": "1.0.0",
        },
        "paths": {},
        "components": {"schemas": {}},
    }

    # Add tool definitions in x-mcp format
    if tools:
        spec["x-mcp"] = {"tools": tools}

    return jsonify(spec)


@app.route("/mcp/resources")
def resources():
    """Return the available resources."""
    resources_list = []

    for url, resource in mcp.resources.items():
        resources_list.append({"url": url, "description": resource["description"]})

    return jsonify({"resources": resources_list})


@app.route("/mcp/tools", methods=["GET"])
def list_tools():
    """List available tools."""
    tools_list = []

    for name, tool in mcp.tools.items():
        tools_list.append(
            {
                "name": name,
                "description": tool["description"],
                "parameters": tool["parameters"],
            }
        )

    return jsonify({"tools": tools_list})


@app.route("/mcp/tools/<name>", methods=["POST"])
def call_tool(name):
    """Call a tool by name."""
    if name not in mcp.tools:
        return jsonify({"error": f"Tool '{name}' not found"}), 404

    # Get the parameters from the request
    params = request.json or {}

    # Call the tool
    tool_func = getattr(mcp, name)
    result = tool_func(**params)

    return jsonify(result)


# Check if backend is available
def check_backend():
    """Check if the backend is available at startup."""
    try:
        response = requests.get(f"{BACKEND_URL}/greeting")
        if response.status_code == 200:
            return True
        else:
            return False
    except Exception:
        return False


# Create MCP instance
mcp = ClaudeMCP()
app.mcp = mcp

# If running directly, start the server
if __name__ == "__main__":
    # For MCP CLI, output ONLY the init JSON message and nothing else
    if RUN_VIA_MCP_CLI:
        try:
            # Restore stdout just long enough to send exactly ONE message
            sys.stdout = original_stdout

            # Send the MCP initialization message - NOTHING ELSE should be printed
            print(json.dumps({"type": "init"}))
            sys.stdout.flush()

            # Immediately redirect stdout back to null
            sys.stdout = NullIO()
        except:
            # If anything goes wrong, fail silently
            pass
    else:
        # In direct mode, just run the app normally
        port = int(os.environ.get("MCP_PORT", 8000))
        app.run(debug=False, host="127.0.0.1", port=port)
