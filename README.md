# ShiftWise - Shift Scheduling Application

![Coverage - Functions](https://img.shields.io/badge/Coverage%20(Functions)-56.07%25-yellow)
![Coverage - Lines](https://img.shields.io/badge/Coverage%20(Lines)-51.95%25-yellow)
![Status](https://img.shields.io/badge/Status-Under%20Heavy%20Development-red)
![PRs](https://img.shields.io/badge/PRs-Welcome-brightgreen)
![License](https://img.shields.io/badge/License-MIT-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript)
![Bun](https://img.shields.io/badge/Bun-1.0+-blueviolet?logo=bun)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)
![Elysia](https://img.shields.io/badge/Elysia-1.0-purple)
![Tailwind](https://img.shields.io/badge/Tailwind-3.0-38B2AC?logo=tailwind-css&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-3-003B57?logo=sqlite&logoColor=white)

> ⚠️ **Note:** This project is under heavy development. Features and APIs may change frequently. Use with caution in production environments.

A modern web application for automated shift scheduling in retail stores. The application generates 4-week schedules while adhering to complex constraints, allows manual adjustments, and produces printable PDF reports.

## Features

- Employee management with different employee groups (VZ, TZ, GfB, TL)
- Automated 4-week schedule generation
- Shift type definitions (Early, Middle, Late)
- Break time management
- Constraint validation
- Manual schedule adjustments
- PDF export functionality
- Store configuration management

## Tech Stack

### Backend
- TypeScript
- Bun runtime
- Elysia (API framework)
- SQLite via bun:sqlite
- Pino (logging)

### Frontend
- React
- TypeScript
- Tailwind CSS
- shadcn-ui components
- Bun runtime
- Vite

## Setup

### Prerequisites
- Bun runtime (v1.0.0 or higher)
- SQLite

### Backend Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/schichtplan.git
   cd schichtplan
   ```

2. Navigate to the backend directory:
   ```bash
   cd src/bun-backend
   ```

3. Install dependencies:
   ```bash
   bun install
   ```

4. Initialize the database:
   ```bash
   bun run db:init
   ```

### Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd src/frontend
   ```

2. Install dependencies:
   ```bash
   bun install
   ```

3. Start the development server:
   ```bash
   bun run dev
   ```

## Running the Application

### Option 1: Using start.sh Script (Recommended)
```bash
# From project root
./start.sh
```
This script:
- Sets up required directories
- Kills any existing processes on ports 5001 and 5173
- Creates a tmux session with panes for backend, frontend, and control menu
- Waits for services to start
- Attaches to the tmux session

### Option 2: Manual Startup

#### Backend
```bash
# From project root
cd src/bun-backend
bun run dev
```

#### Frontend
```bash
# From project root
cd src/frontend
bun run --watch --hot --bun dev
```

### Tmux Session Management
- **Attach to session**: `tmux attach-session -t schichtplan`
- **Detach from session**: Press `Ctrl+B`, then `D`
- **Kill session**: `tmux kill-session -t schichtplan`
- **Navigate between panes**: Press `Ctrl+B`, then arrow keys

### Service Control
- **Stop backend**: Kill process on port 5001
- **Stop frontend**: Kill process on port 5173
- **Check if services are running**: 
  ```bash
  lsof -i:5001  # Check backend
  lsof -i:5173  # Check frontend
  ```

## Development

### Database Management

The application uses SQLite as its database, with the following setup:

- Database file location: `src/instance/bun.db`
- Database schema defined in `src/bun-backend/db/init-schema.sql`
- Database files are not tracked in version control

To initialize or reset the database:
```bash
cd src/bun-backend
bun run db:init
```

### Running Tests

```bash
cd src/bun-backend
bun test
```

### Code Style

The project uses:
- TypeScript ESLint for linting
- Prettier for code formatting

To format code:
```bash
bun run format
```

## API Documentation

When the backend server is running, visit `/api-docs` for comprehensive API documentation via Swagger UI.

### Endpoints

#### Employees
- `GET /api/employees` - List all employees
- `POST /api/employees` - Create new employee
- `GET /api/employees/{id}` - Get employee details
- `PUT /api/employees/{id}` - Update employee
- `DELETE /api/employees/{id}` - Delete employee

#### Shifts
- `GET /api/shifts` - List all shifts
- `POST /api/shifts` - Create new shift
- `GET /api/shifts/{id}` - Get shift details
- `PUT /api/shifts/{id}` - Update shift
- `DELETE /api/shifts/{id}` - Delete shift

#### Schedules
- `GET /api/schedules` - List schedules
- `POST /api/schedules/generate` - Generate new schedule
- `GET /api/schedules/{id}` - Get schedule details
- `PUT /api/schedules/{id}` - Update schedule
- `POST /api/schedules/export` - Export schedule as PDF

#### Store Configuration
- `GET /api/settings` - Get store configuration
- `PUT /api/settings` - Update store configuration

## License

MIT License - see LICENSE file for details.

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

### Branch Management

#### Main Branches
- `main` - Production-ready code
- `develop` - Integration branch for features

#### Feature Branches
- Create from: `develop`
- Naming: `feature/feature-name`
- Merge back into: `develop`

#### Release Process
1. Feature branches merge into `develop`
2. `develop` merges into `main` after testing
3. Tag releases with version numbers

### Merging Guidelines
1. Ensure all tests pass
2. Update documentation if needed
3. Resolve any conflicts
4. Use squash merging for cleaner history
5. Delete feature branch after successful merge

## Resource Type Clarification

The application has two resource types for schedule generation:

- **ShiftTemplate**: Fixed shift plan with more conditions (previously called "Shifts")
- **Coverage**: More generic scheduling with fewer conditions (only employee amount)

## Recent Changes

### Backend Migration

We've migrated from the previous Python/Flask backend to a new TypeScript/Bun backend:

- **Performance**: Faster API responses and more efficient scheduling algorithm
- **Type Safety**: Full TypeScript implementation with defined interfaces
- **API Framework**: Elysia for fast, type-safe API routes
- **Database**: Native SQLite integration via `bun:sqlite` for efficient database operations
- **API Compatibility**: Maintains compatibility with the previous API endpoints

### Frontend Reorganization

We've reorganized the frontend components into separate folders:

- `src/frontend/src/components/shifts-editor/`: Contains all shift-related components
- `src/frontend/src/components/coverage-editor/`: Contains all coverage-related components

This helps prevent confusion between similarly named components and makes the codebase more maintainable.

## Development

### Frontend

- Typescript
- Bun runtime
- Tailwind 4
- shadcn-ui
- Folder: `./src/frontend/`
- Dev Cmd: `bun run dev`

### Backend

- TypeScript
- Bun runtime
- Elysia framework
- Folder: `./src/bun-backend/`
- Dev Cmd: `bun run dev`

### Database

- SQLite
- Folder: `./src/instance/bun.db`

### Logs

- Folder: `./src/logs/`

## Recent Refactoring

### Scheduler Component

The scheduling system has been refactored from a monolithic design into a modular package structure:

- **Module Structure**:
  - `scheduler/assignment.ts`: Core scheduling algorithm
  - `scheduler/resolver.ts`: Conflict resolution
  - `scheduler/validator.ts`: Schedule validation
  - `scheduler/utils.ts`: Common utility functions

- **Benefits**:
  - Improved maintainability
  - Better separation of concerns
  - Enhanced testability
  - Clearer component interfaces

For more details, see the [Scheduler Documentation](/src/bun-backend/scheduler/README.md).

## Schedule Improvements

### Enhanced Shift Management

The scheduling system now includes several improvements to make shift management more intuitive and flexible:

- **NON_WORKING Shift Type**: A dedicated shift type for days when employees are not scheduled to work
  - Clearly indicates days off in the schedule view
  - Distinguishes between unavailability and days without assigned shifts
  - Visual distinction in both table and grid views

- **Absence Handling**: 
  - Schedule now displays employee absences
  - Prevents scheduling employees during absence periods
  - Integrates with availability system

- **Improved Filtering**:
  - Add Entry modal filters employees based on availability
  - Only displays shifts that match employee availability
  - Prevents scheduling conflicts before they occur

- **Enhanced User Interface**:
  - Clear visual indicators for different shift types
  - Improved schedule visualization
  - Better responsive design for different screen sizes

### Schedule Generation Enhancements

- **Automatic Non-Working Day Allocation**: The generator now automatically creates placeholder entries for non-working days
- **Advanced Conflict Prevention**: Improved logic to prevent scheduling conflicts
- **Defensive Programming**: Enhanced error handling to gracefully manage undefined or unexpected values

## Troubleshooting

### Backend Issues
- **Application Won't Start**:
  - Check logs at `src/logs/backend.log`
  - Ensure database is initialized
  - Verify Bun is installed correctly (run `bun --version`)

- **Database Errors**:
  - Ensure SQLite database exists at `src/instance/bun.db`
  - Run database initialization: `bun run db:init`
  - Check database permissions

- **Schedule Generation Issues**:
  - Verify employee data is complete
  - Check store configuration settings
  - Ensure shift templates exist
  - Examine logs for specific errors

### Frontend Issues
- **Application Won't Start**:
  - Clear node_modules and reinstall dependencies
  - Verify bun is installed correctly
  - Check console errors in browser

- **API Connection Errors**:
  - Ensure backend API is running
  - Check CORS settings
  - Verify frontend is using correct API URL

- **UI Display Issues**:
  - Clear browser cache
  - Check for JavaScript console errors
  - Verify correct data is being returned from API

### Common Solutions
- **Restart Services**: Use `./start.sh` to restart both frontend and backend
- **Reset Database**: Run `bun run db:init` to reset the database
- **Check Logs**: Review logs in `src/logs/` directory
- **Clean Install**: Remove node_modules and reinstall

## Public Access with ngrok

The application now provides integrated ngrok support for exposing your local development server to the public internet. This is useful for:

- Demoing the application to clients
- Testing on different devices
- Sharing your work with remote team members
- Developing webhook integrations

### Quick Start with ngrok

1. Install ngrok from [ngrok.com/download](https://ngrok.com/download)
2. Set up with your authtoken: `ngrok config add-authtoken YOUR_TOKEN`

Three ways to use ngrok with Schichtplan:

1. **Via the Control Menu**: Start the app with `./start.sh` and select option 8
2. **Expose Frontend Directly**: Use `./src/scripts/expose_frontend.sh`
3. **Flexible Port Exposure**: Use `./ngrok-expose [PORT]`

Example:
```bash
# Expose frontend and open in browser
./ngrok-expose --open

# Expose backend API
./ngrok-expose 5001
```

For detailed information, see the [ngrok usage documentation](docs/ngrok_usage.md). 