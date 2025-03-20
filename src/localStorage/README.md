# Schichtplan LocalStorage Backend

This is an alternative backend implementation for the Schichtplan application that uses localStorage (file-based JSON storage) instead of SQLite for data persistence.

## Features

- Complete Bun/TypeScript implementation
- Compatible with the existing frontend
- File-based JSON storage (simulating localStorage)
- Implements the same API endpoints as the original Python backend

## Prerequisites

- [Bun](https://bun.sh/) (>= 1.0.0)
- Node.js (>= 16.0.0)

## Installation

```bash
# Install dependencies
cd src/localStorage
bun install
```

## Running the Backend

```bash
# Development mode (with hot reloading)
bun run dev

# Production mode
bun run start

# Build for production
bun run build
```

## API Endpoints

The backend implements the following API endpoints to match the original Python backend:

- `/api/health` - Health check endpoint
- `/api/employees` - Employee management
- `/api/settings` - Application settings
- (More endpoints will be added to match the original backend)

## Data Storage

All data is stored in JSON files in the `data/` directory. This simulates browser localStorage behavior but in a server environment.

## Environment Variables

- `PORT` - Port for the server (default: 5000)
- (Additional environment variables will be added as needed)

## Switching Backends

To switch between the Python backend and the localStorage backend, set the `VITE_BACKEND_TYPE` environment variable in the frontend:

```
# .env file in frontend directory
VITE_BACKEND_TYPE=localStorage  # Use localStorage backend
# or
VITE_BACKEND_TYPE=python        # Use Python backend (default)
```

## Development

The code is organized as follows:

- `index.ts` - Main entry point
- `models/` - TypeScript interfaces for data models
- `services/` - Business logic for data operations
- `routes/` - API route handlers
- `utils/` - Helper functions and utilities

## License

Same as the main Schichtplan project
