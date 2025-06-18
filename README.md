# Schichtplan

A full-stack employee scheduling system for creating, managing, and optimizing shift plans.

## Table of Contents

- [Project Overview](#project-overview)
- [Architecture](#architecture)
- [Directory Structure](#directory-structure)
- [Key Features](#key-features)
- [Setup & Development](#setup--development)
- [Running the Application](#running-the-application)
- [Database & Migrations](#database--migrations)
- [Testing](#testing)
- [Logging & Diagnostics](#logging--diagnostics)
- [Contributing](#contributing)
- [Additional Documentation](#additional-documentation)

## Project Overview

Schichtplan is a modern, full-stack employee scheduling system. It enables organizations to create, manage, and optimize shift plans with advanced features like automated assignment, employee group management, and customizable PDF exports.

## Architecture

- **Frontend:** TypeScript, React, Vite, Shadcn UI
- **Backend:** Python, Flask, SQLAlchemy, Alembic
- **Database:** SQLite

The frontend communicates with the backend via RESTful APIs. The backend handles business logic, scheduling algorithms, and database operations.

## Directory Structure

- `/src/frontend/` - React frontend application
- `/src/backend/` - Flask backend application
- `/src/instance/` - Application instance (database, migrations)
- `/docs/` - Project documentation
- `/logs/` - Application and scheduler logs

## Key Features

- Shift plan creation and management with versioning
- Define shifts and coverage needs
- Employee group management (VZ, TZ, GFB, TL)
- Automated shift assignment based on rules and preferences
- PDF export with customizable layouts
- Diagnostic tools for schedule generation
- Comprehensive test suite
- **MCP Server Integration** - AI-powered scheduling and optimization via Model Context Protocol

## MCP Server Integration

Schichtplan includes a built-in MCP (Model Context Protocol) server that provides AI tools with comprehensive access to the scheduling system. This enables integration with AI applications like Claude Desktop, ChatGPT, and other MCP-compatible tools.

### Quick Start with MCP

```bash
# Start application with MCP server
./start.sh --with-mcp

# Or start MCP server standalone
python3 src/backend/mcp_server.py --transport sse --port 8001
```

### MCP Features

- **Tools**: Employee management, schedule generation, system status
- **Resources**: System configuration, employee details
- **Prompts**: Schedule analysis and optimization templates
- **Transports**: stdio, SSE, and HTTP for different integration needs

### AI Integration Use Cases

- Schedule optimization and conflict resolution
- Workload analysis and balancing
- Employee availability management
- Compliance checking and reporting
- Resource planning and forecasting

For detailed MCP documentation, see [docs/mcp_api.md](docs/mcp_api.md).

## Setup & Development

### Prerequisites

- Node.js and npm
- Python 3.12+
- Virtualenv

### Setup

1. Clone the repository
2. Set up Python environment:

   ```bash
   python -m venv .venv
   source .venv/bin/activate  # On Windows: .venv\Scripts\activate
   pip install -r requirements.txt
   ```

3. Install frontend dependencies:

   ```bash
   npm install
   ```

## Running the Application

1. Start the backend:

   ```bash
   python src/backend/run.py
   ```

2. Start the frontend:

   ```bash
   npm run dev
   ```

## Database & Migrations

- The application uses an SQLite database at `/src/instance/app.db`.
- To apply migrations:

  ```bash
  flask db upgrade
  ```

- For migration details, see [`/src/instance/migrations/README.md`](src/instance/migrations/README.md).

## Testing

- Backend: Use pytest or run provided test scripts.
- Frontend: Run tests with:

  ```bash
  npm test
  ```

## Logging & Diagnostics

- Scheduler and application logs are stored in `/logs/`.
- For details, see [`docs/README_LOGGING.md`](docs/README_LOGGING.md).
- Diagnostic tools for schedule generation are in `src/backend/tools/debug/`.

## Contributing

1. Fork the repository and create a feature branch.
2. Follow code style guidelines (Black/Ruff for Python, ESLint/Prettier for JS/TS).
3. Write or update tests for your changes.
4. Submit a pull request with a clear description.

## Additional Documentation

- [Logging System](docs/README_LOGGING.md)
- [Migrations Guide](src/instance/migrations/README.md)
- [Frontend Features](src/frontend/README.md)
- [Backend Scheduler Tests](src/backend/tests/schedule/README.md)

For further questions, see the `/docs` directory or open an issue.
