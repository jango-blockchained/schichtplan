# Schichtplan

A full-stack employee scheduling system for creating, managing, and optimizing shift plans.

## Project Structure

- **Frontend**: TypeScript, React, Vite, Shadcn UI
- **Backend**: Python, Flask, SQLAlchemy
- **Database**: SQLite

## Directory Structure

- `/src/frontend/` - React frontend application
- `/src/backend/` - Flask backend application
- `/src/instance/` - Application instance (database, migrations)
- `/docs/` - Project documentation

## Migrations

This project uses Flask-Migrate (Alembic) for database migrations. The migrations are stored in:

```
/src/instance/migrations/
```

For custom migration tools and utilities, see:

```
/src/instance/tools/migrations/
```

For detailed information on working with migrations, see [Migrations Documentation](/src/instance/migrations/README.md).

## Development

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

### Running the application

1. Start the backend:
   ```bash
   python src/backend/run.py
   ```
2. Start the frontend:
   ```bash
   npm run dev
   ```

## Database

The application uses SQLite database stored at `/src/instance/app.db`. To apply migrations:

```bash
flask db upgrade
```

## Documentation

Additional documentation can be found in the `/docs` directory.