# Methods

## System Architecture

Schichtplan is implemented as a modular, full-stack application. The frontend is built with React and TypeScript, utilizing a modern design system for accessibility and responsiveness. The backend is developed in Python using Flask and SQLAlchemy, providing RESTful APIs and robust business logic. The system integrates an AI-powered Model Context Protocol (MCP) server, enabling advanced scheduling, optimization, and analytics through AI tools.

## Data Management and APIs

Data is managed using SQLAlchemy ORM and Alembic migrations, ensuring consistency and scalability. The frontend communicates with the backend via RESTful APIs, leveraging @tanstack/react-query for cache-aware, robust data fetching. The system supports both controlled and dynamic settings, allowing adaptation to organizational requirements.

## AI and MCP Integration

The MCP server exposes tools and resources for employee management, schedule generation, and analytics. AI endpoints enable predictive scheduling, workload analysis, compliance checking, and optimization. The architecture is designed for seamless integration with external AI agents and platforms.

## User Experience

The UI supports multiple layouts, customizable exports (PDF), and comprehensive feedback for loading, error, and empty states. Diagnostic tools and a comprehensive test suite ensure reliability and maintainability across the stack.
