# Schichtplan Bun Backend

This is the Bun/TypeScript backend implementation for the Schichtplan application, replacing the previous Flask/Python backend.

## Features

- **Modern JavaScript Runtime**: Built with [Bun](https://bun.sh/), a fast all-in-one JavaScript runtime
- **Type Safety**: Full TypeScript implementation with defined interfaces for all database models
- **API Framework**: Uses [Elysia](https://elysiajs.com/) for fast, type-safe API routes
- **Database**: Native SQLite integration via `bun:sqlite` for efficient database operations
- **Scheduling Engine**: Advanced shift scheduling algorithm with employee availability tracking
- **Documentation**: API documentation via Swagger UI at `/api-docs`
- **Logging**: Structured logging with Pino

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) runtime (v1.0.0 or higher)

### Installation

```bash
# Navigate to the backend directory
cd src/bun-backend

# Install dependencies
bun install

# Initialize the database schema
bun run db:init

# Start the development server
bun run dev
```

The server will start on port 5001 by default.

## Project Structure

```
src/bun-backend/
├── db/                   # Database connection and schema
│   ├── index.ts          # Database connection setup
│   ├── schema.ts         # TypeScript interfaces for database models
│   ├── init-schema.sql   # SQL schema definition
│   └── migrate.ts        # Database migration utilities
├── routes/               # API route definitions
│   ├── employees.ts      # Employee CRUD endpoints
│   ├── schedules.ts      # Schedule generation and management endpoints
│   ├── settings.ts       # Application settings endpoints
│   └── ...
├── services/             # Business logic services
│   ├── employeesService.ts       # Employee data operations
│   ├── scheduleService.ts        # Schedule generation and management
│   ├── settingsService.ts        # Application settings
│   └── ...
├── scheduler/            # Scheduling algorithm components
│   └── assignment.ts     # Core scheduling logic
├── test/                 # Test files
├── index.ts              # Application entry point
├── package.json          # Project dependencies and scripts
└── tsconfig.json         # TypeScript configuration
```

## API Endpoints

The backend provides RESTful API endpoints for managing employees, shifts, and schedules. All endpoints are prefixed with `/api`.

Key endpoint groups:

- **Employees**: `/api/employees`
- **Shift Templates**: `/api/shifts`
- **Schedule Management**: `/api/schedules`
- **Settings**: `/api/settings`
- **Coverage**: `/api/coverage`

For complete API documentation, visit `/api-docs` when the server is running.

## Database Schema

The application uses SQLite with a schema defined in `db/init-schema.sql`. Key tables include:

- `employees`: Employee information
- `shift_templates`: Templates for different shift types
- `schedules`: Individual shift assignments
- `schedule_version_meta`: Metadata for schedule versions
- `settings`: Application settings (singleton table)
- `employee_availabilities`: Employee availability preferences
- `absences`: Employee absence records
- `coverage`: Store coverage requirements

## Development

```bash
# Start development server with auto-reload
bun run dev

# Run tests
bun test

# Initialize or reset database
bun run db:init
```

## Schedule Generation

The schedule generation algorithm takes into account:

1. Employee availability and preferences
2. Store coverage requirements
3. Qualified employees (e.g., keyholders)
4. Employee absences
5. Fair distribution of shifts

To generate a schedule, use the `/api/schedules/generate` endpoint with a start and end date.

## Frontend Integration

The frontend communicates with this backend via the REST API. The default port (5001) is different from the previous backend (5000) to allow side-by-side testing during migration.

## Migrating from Flask Backend

This Bun backend is designed to replace the previous Flask implementation while maintaining API compatibility. The database schema has been adapted to work with SQLite directly.

When ready to switch from Flask to Bun:

1. Make sure the Bun backend is tested and working correctly
2. Update the frontend's API base URL/port from 5000 to 5001
3. Stop the Flask backend and run only the Bun backend

## License

[MIT License](LICENSE) 