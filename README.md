# ShiftWise - Shift Scheduling Application

![Coverage - Functions](https://img.shields.io/badge/Coverage%20(Functions)-56.07%25-yellow)
![Coverage - Lines](https://img.shields.io/badge/Coverage%20(Lines)-51.95%25-yellow)
![Status](https://img.shields.io/badge/Status-Under%20Heavy%20Development-red)

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
- Python 3.8+
- Flask
- SQLAlchemy
- SQLite
- Flask-Migrate
- Flask-CORS

### Frontend
- React
- TypeScript
- Tailwind CSS
- shadcn-ui components
- Bun runtime
- Vite

## Setup

### Prerequisites
- Python 3.8 or higher
- SQLite
- Bun (for frontend)

### Backend Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/schichtplan.git
   cd schichtplan
   ```

2. Create and activate a virtual environment:
   ```bash
   python -m venv .venv
   source .venv/bin/activate  # On Windows: .venv\Scripts\activate
   ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Initialize the database:
   ```bash
   cd src/backend
   export FLASK_APP=run.py
   export FLASK_ENV=development
   flask db upgrade
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
- Kills any existing processes on ports 5000 and 5173
- Creates a tmux session with panes for backend, frontend, and control menu
- Waits for services to start
- Attaches to the tmux session

### Option 2: Manual Startup

#### Backend
```bash
# From project root
cd src/backend
export FLASK_APP=run.py
export FLASK_ENV=development
python3 run.py
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
- **Stop backend**: Kill process on port 5000
- **Stop frontend**: Kill process on port 5173
- **Check if services are running**: 
  ```bash
  lsof -i:5000  # Check backend
  lsof -i:5173  # Check frontend
  ```

## Development

### Database Migrations

To create a new migration:
```bash
flask db migrate -m "Description of changes"
flask db upgrade
```

### Running Tests

```bash
pytest
```

### Code Style

The project uses:
- Black for Python code formatting
- Flake8 for Python linting
- MyPy for type checking

To format code:
```bash
black src/
```

To run linting:
```bash
flake8 src/
mypy src/
```

## API Documentation

### Endpoints

#### Employees
- `GET /api/employees` - List all employees
- `POST /api/employees` - Create new employee
- `GET /api/employees/<id>` - Get employee details
- `PUT /api/employees/<id>` - Update employee
- `DELETE /api/employees/<id>` - Delete employee

#### Shifts
- `GET /api/shifts` - List all shifts
- `POST /api/shifts` - Create new shift
- `GET /api/shifts/<id>` - Get shift details
- `PUT /api/shifts/<id>` - Update shift
- `DELETE /api/shifts/<id>` - Delete shift

#### Schedules
- `GET /api/schedules` - List schedules
- `POST /api/schedules/generate` - Generate new schedule
- `GET /api/schedules/<id>` - Get schedule details
- `PUT /api/schedules/<id>` - Update schedule
- `POST /api/schedules/export` - Export schedule as PDF

#### Store Configuration
- `GET /api/store/config` - Get store configuration
- `PUT /api/store/config` - Update store configuration

## License

MIT License - see LICENSE file for details.

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## Database Management

The application uses SQLite as its database, with the following setup:

- Database file location: `src/backend/instance/schichtplan.db`
- The `instance/` folder is automatically created by Flask
- Database files are not tracked in version control
- Database migrations are handled by Flask-Migrate

To initialize the database:
```bash
cd src/backend
flask db upgrade  # Apply all migrations
python init_db.py  # Initialize with default data
```

## Resource Type Clarification

The application has two resource types for schedule generation:

- **ShiftTemplate**: Fixed shift plan with more conditions (previously called "Shifts")
- **Coverage**: More generic scheduling with fewer conditions (only employee amount)

## Recent Changes

### Backend Renaming

We've renamed the `Shift` model to `ShiftTemplate` to better describe its purpose as a fixed template. This helps clarify the distinction between shifts and coverage in the application.

- Renamed `shift.py` to `fixed_shift.py`
- Renamed `Shift` class to `ShiftTemplate`
- Updated all references to `Shift` in the codebase

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

- Flask app
- Python
- Folder: `./src/backend/`
- Virtual Env: `./.venv/`
- Requirements File: `./requirements.txt`, `src/backend/requirements.txt`
- Dev Cmd: `flask run`

### Database

- SQLite
- Folder: `./src/backend/instance/app.db`

### Logs

- Folder: `./src/logs/`

## Recent Refactoring

### Scheduler Component

The scheduling system has been refactored from a monolithic design into a modular package structure:

- **Module Structure**: The original `schedule_generator.py` file has been split into separate components:
  - `generator.py`: Core scheduling algorithm
  - `resources.py`: Data management
  - `validator.py`: Schedule validation
  - `utility.py`: Common utility functions

- **Benefits**:
  - Improved maintainability
  - Better separation of concerns
  - Enhanced testability
  - Clearer component interfaces

For more details, see the [Scheduler Package Documentation](/src/backend/services/scheduler/README.md).

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

## Schedule Generation Tests

The application includes comprehensive tests for the schedule generation functionality:

### Test Modules

- **Extended Schedule Generation Tests**: Tests for basic schedule generation, edge cases, and performance scaling.
- **Schedule Constraints Tests**: Tests for various constraints like keyholder requirements, weekly hour limits, rest time, employee availability, and shift requirements.
- **Schedule Generation API Tests**: Tests for the schedule generation API endpoints, including error handling and parameter validation.

### Running Tests

You can run all the schedule generation tests using the provided script:

```bash
python run_schedule_tests.py
```

Or run individual test modules:

```bash
# Run extended schedule generation tests
python -m src.backend.tests.schedule.test_schedule_generation_extended

# Run schedule constraints tests
python -m src.backend.tests.schedule.test_schedule_constraints

# Run schedule generation API tests
python -m pytest src.backend.tests.api.test_schedule_generation_api.py
```

### Performance Testing

The application includes performance tests for schedule generation with different date ranges:

```bash
python run_performance_tests.py
```

This will run schedule generation for different periods (1 day, 1 week, 2 weeks, 1 month, 3 months) and measure performance metrics like generation time and schedules per second.

### Test Documentation

For more detailed information about the schedule generation tests, see the [Schedule Generation Tests README](src/backend/tests/schedule/README.md).

## Troubleshooting

### Backend Issues
- **Application Won't Start**:
  - Check logs at `src/logs/backend.log`
  - Ensure database migrations are up to date
  - Verify environment variables are set correctly

- **Database Errors**:
  - Ensure SQLite database exists at `src/backend/instance/schichtplan.db`
  - Run database migrations: `flask db upgrade`
  - Check database permissions

- **Schedule Generation Issues**:
  - Verify employee data is complete
  - Check store configuration settings
  - Ensure shift templates exist
  - Examine logs for specific constraint errors

### Frontend Issues
- **Application Won't Start**:
  - Clear node_modules and reinstall dependencies
  - Verify bun/npm/yarn is installed correctly
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
- **Refresh Database**: Run `flask db downgrade` followed by `flask db upgrade`
- **Check Logs**: Review logs in `src/logs/` directory
- **Clean Install**: Remove node_modules, virtual environment, and reinstall

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
./ngrok-expose 5000
```

For detailed information, see the [ngrok usage documentation](docs/ngrok_usage.md). 