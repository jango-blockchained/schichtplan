# Project Creation Prompt: ShiftWise - Shift Scheduling Application

## Project Overview
Create a modern shift scheduling application called "ShiftWise" with the following architecture:

### Core Technologies
- Frontend: React 18 with TypeScript 5.0, Tailwind CSS, and hero-ui components
- Backend: NextJS framework, SQLite database
- Testing: Playwright for E2E testing, Jest for unit testing
- Development Tools: ESLint, Prettier, TypeScript

## Project Structure
Create a monorepo with the following structure:

```typescript
schichtplan/
├── src/
│   ├── frontend/          // Hero UI frontend application
│   │   ├── ...
│   └── backend/           // Next
│       ├── ...
```

## Core Features to Implement

1. **Employee Management**
   - CRUD operations for employees
   - Employee categorization (VZ, TZ, GfB, TL)
   - Employee availability tracking

2. **Shift Scheduling**
   - Automated 4-week schedule generation
   - Shift types (Early, Middle, Late)
   - Break time management
   - Constraint validation system
   - Manual schedule adjustments

3. **UI/UX Requirements**
   - Modern, responsive design using Tailwind CSS
   - Interactive schedule editor
   - Dark/light theme support
   - PDF export functionality
   - Toast notifications for user feedback

4. **Backend Architecture**
   - RESTful API using Elysia
   - SQLite database with migrations
   - Logging system using Pino
   - Authentication and authorization
   - Input validation

## Technical Requirements

1. **TypeScript Configuration**
   - Strict type checking
   - Path aliases for clean imports
   - Shared types between frontend and backend

2. **Testing Strategy**
   - E2E tests with Playwright
   - Unit tests with Jest
   - Component testing with React Testing Library
   - Minimum 50% code coverage

3. **Development Experience**
   - Hot module replacement
   - Development environment with watch mode
   - Proper error handling and logging
   - API documentation with Swagger

4. **Code Quality**
   - ESLint configuration for code quality
   - Prettier for consistent formatting
   - Git hooks for pre-commit checks
   - Conventional commit messages

## Development Setup

1. **Environment Configuration**
   - Development and production configurations
   - Environment variable management
   - Logging levels by environment

2. **Build System**
   - Frontend build with Vite
   - Backend build with Bun
   - Production optimization

3. **Development Workflow**
   - Concurrent frontend/backend development
   - Database migration system
   - Development scripts in package.json

## Security Requirements

1. **Authentication & Authorization**
   - Secure user authentication
   - Role-based access control
   - Session management

2. **Data Protection**
   - Input validation and sanitization
   - SQL injection prevention
   - XSS protection

## Documentation Requirements

1. **Code Documentation**
   - TSDoc comments for public APIs
   - README files for each major directory
   - API documentation with examples

2. **User Documentation**
   - Setup instructions
   - Usage guidelines
   - Troubleshooting guide

## Performance Requirements

1. **Frontend**
   - Optimized bundle size
   - Lazy loading of components
   - Efficient state management

2. **Backend**
   - Request rate limiting
   - Response caching where appropriate
   - Efficient database queries

## Deployment Considerations

1. **Build Process**
   - Production build optimization
   - Asset optimization
   - Environment-specific configurations

2. **Monitoring**
   - Error tracking
   - Performance monitoring
   - Usage analytics

Remember to implement proper error handling, logging, and documentation throughout the application. The system should be scalable, maintainable, and follow TypeScript best practices.