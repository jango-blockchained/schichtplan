# ShiftWise - Shift Scheduling Application

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
- PostgreSQL
- Flask-Migrate
- Flask-CORS

### Frontend (Coming Soon)
- React
- TypeScript
- Material-UI
- React Query
- Vite

## Setup

### Prerequisites

*   **Python:** Version 3.12 or higher.
*   **Bun:** Latest version recommended. (See [Bun installation guide](https://bun.sh/docs/installation)).
*   **pip:** Usually comes with Python.
*   Git for version control.

### Backend Setup (Python/Flask)

1.  **Clone the repository:**
    ```bash
    git clone <your-repo-url>
    cd schichtplan # Or your project's root directory
    ```

2.  **Navigate to the backend directory:**
    ```bash
    cd src/backend
    ```

3.  **Create and activate a virtual environment:**
    *   It's recommended to create it in the project root:
        ```bash
        cd ../.. # Go back to project root from src/backend
        python -m venv .venv
        source .venv/bin/activate  # On Windows: .venv\Scripts\activate
        ```

4.  **Install dependencies:**
    *   Ensure your virtual environment is active and you are in the project root.
        ```bash
        pip install -r requirements.txt
        ```

5.  **Create environment file (`.env`):**
    *   In the project root directory (`/home/jango/Git/maike2/schichtplan/`), create a file named `.env` with the following content:
        ```env
        FLASK_APP=src.backend.app:create_app()
        FLASK_DEBUG=True
        # Points to the SQLite database file within the src/backend/instance/ directory
        DATABASE_URL=sqlite:///src/backend/instance/app.db
        
        # Optional: Secret key for Flask sessions, JWT, etc. Generate a strong random key.
        # SECRET_KEY=your_strong_random_secret_key
        ```
    *   *Note: The `src/backend/instance/` directory and `app.db` file will be created automatically by Flask/SQLAlchemy when the application first runs and needs the database if they don't exist.*

6.  **Initialize the database:**
    *   Ensure your virtual environment is active and you are in the project root.
    *   Run Alembic migrations to set up the database schema:
        ```bash
        flask db upgrade
        ```

7.  **Run the development server:**
    *   Ensure your virtual environment is active and you are in the project root.
    *   The backend server typically runs on port 5000.
        ```bash
        python src/backend/run.py
        ```
    *   If port 5000 is busy, the script attempts to find an alternative or you can specify one:
        ```bash
        python src/backend/run.py --port 5001
        ```

### Frontend Setup (TypeScript/React/Bun)

1.  **Navigate to the frontend directory:**
    *   From the project root:
        ```bash
        cd src/frontend
        ```

2.  **Install dependencies:**
    *   Use Bun to install frontend packages:
        ```bash
        bun install
        ```

3.  **Start the development server:**
    *   This usually starts the frontend on port 5173 and proxies API requests to the backend (running on port 5000).
        ```bash
        bun run dev
        ```
    *   Open your browser and navigate to `http://localhost:5173`.

## Development

### Database Migrations

To create a new migration:
```bash
flask db migrate -m "Description of changes"
flask db upgrade
```

### Running Tests

Unified test scripts are provided in the root `package.json` to execute backend and frontend tests.

**Backend (Pytest):**
*   To run all backend tests (from `src/backend/tests/`):
    ```bash
    npm run test:backend 
    ```
    (This runs `pytest -v -s src/backend/tests/`)
*   To run specific backend test files or tests:
    ```bash
    pytest path/to/your_test_module.py
    # or
    pytest path/to/test_file.py::TestClass::test_method
    ```
    *Ensure your virtual environment is active and you are in the project root.*

**Frontend (Bun Test / Jest compatible):**
*   To run all frontend tests (from `src/frontend/`):
    ```bash
    npm run test:frontend
    ```
    (This runs `bun test` within the `src/frontend` directory).
*   To run specific frontend test files:
    ```bash
    cd src/frontend
    bun test path/to/your_test_file.spec.tsx
    ```
*   The frontend also has scripts for watch mode and coverage in its `src/frontend/package.json`:
    ```bash
    cd src/frontend
    bun run test:watch
    bun run test:coverage
    ```

**Combined Command (from project root):**
*   Run all backend and frontend tests:
    ```bash
    npm run test
    ```

### Code Style & Linting

This project uses a combination of tools to maintain code quality and consistency across the backend (Python) and frontend (TypeScript). Scripts are provided in the root `package.json` for easy execution.

**Backend (Python):**
*   **Formatter:** [Black](https://github.com/psf/black)
    *   Configuration: `pyproject.toml` in the project root.
    *   To format: `npm run format:backend` (from project root)
*   **Linter (Style Check):** Black in check mode.
    *   To check style: `npm run lint:backend:style` (from project root)
*   **Linter (Code Analysis):** [Flake8](https://flake8.pycqa.org/en/latest/)
    *   Configuration: Uses default Flake8 settings. Can be configured in `.flake8` or `pyproject.toml` [tool.flake8] if needed.
    *   To lint: `npm run lint:backend:flake8` (from project root)
*   **Type Checker:** [MyPy](http://mypy-lang.org/)
    *   Configuration: Can be configured in `mypy.ini` or `pyproject.toml` [tool.mypy] if needed.
    *   To type check: `npm run lint:backend:mypy` (from project root)
*   **Run all backend checks:**
    ```bash
    npm run lint:backend 
    ```

**Frontend (TypeScript/React):**
*   **Formatter:** [Prettier](https://prettier.io/)
    *   Configuration: Implicitly via `src/frontend/package.json` scripts or editor integrations (e.g. `.prettierrc.js` could be added in `src/frontend/` if specific rules are needed).
    *   To format: `npm run format:frontend` (from project root, executes `bun run format` in `src/frontend/`)
*   **Linter:** [ESLint](https://eslint.org/) with TypeScript support.
    *   Configuration: Implicitly via `src/frontend/package.json` scripts (e.g. `.eslintrc.js` could be added in `src/frontend/` for detailed rules).
    *   To lint: `npm run lint:frontend` (from project root, executes `bun run lint` in `src/frontend/`)

**Combined Commands (from project root):**
*   Format both backend and frontend:
    ```bash
    npm run format
    ```
*   Lint both backend and frontend:
    ```bash
    npm run lint
    ```
*   Run all checks (linting and frontend type checking):
    ```bash
    npm run check:all
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
- **Coverage**: Defines staffing requirements. While the UI allows users to define broad coverage blocks (e.g., 09:00-17:00, 2 employees), the backend scheduler interprets these to establish granular, per-interval (e.g., every 15 or 60 minutes) staffing needs. If multiple coverage blocks overlap for a given interval, the system takes the *maximum* `min_employees` required and combines other criteria (like `employee_types` or `requires_keyholder`).

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
    - `generator.py`: Orchestrates the overall schedule generation process.
    - `distribution.py`: Manages the assignment of employees to shifts, now driven by fulfilling granular interval-based staffing needs rather than directly assigning to coverage blocks. It iterates through time intervals, identifies deficits, and attempts to assign the best available shift and employee.
    - `resources.py`: Handles loading of all necessary data (employees, shift templates, coverage rules, etc.) from the database.
    - `availability.py`: Checks employee availability considering fixed assignments, absences, and preferences.
    - `constraints.py`: Validates various work rules (rest times, max hours, etc.).
    - `coverage_utils.py`: A utility module responsible for interpreting `Coverage` rules and calculating the specific staffing requirements (min_employees, keyholder, employee_types) for each discrete time interval by resolving any overlaps.
    - `validator.py`: Validates the generated schedule against all configured rules, including interval-based coverage fulfillment.

- **Shift Generation Logic**:

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