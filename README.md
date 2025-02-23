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
- Python 3.8 or higher
- PostgreSQL
- Node.js 16+ (for frontend)
- npm or yarn (for frontend)

### Backend Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/shiftwise.git
   cd shiftwise
   ```

2. Create and activate a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Create environment file:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` with your configuration.

5. Create the database:
   ```bash
   createdb shiftwise
   ```

6. Initialize the database:
   ```bash
   flask db upgrade
   ```

7. Run the development server:
   ```bash
   flask run
   ```

### Frontend Setup (Coming Soon)

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
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