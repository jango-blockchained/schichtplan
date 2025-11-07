# Contributing to Schichtplan

First off, thank you for considering contributing to Schichtplan! 🎉 It's people like you that make Schichtplan such a great tool.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How Can I Contribute?](#how-can-i-contribute)
- [Development Setup](#development-setup)
- [Coding Standards](#coding-standards)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [Testing Guidelines](#testing-guidelines)

## Code of Conduct

This project and everyone participating in it is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please report unacceptable behavior to the project maintainers.

## How Can I Contribute?

### Reporting Bugs 🐛

Before creating bug reports, please check the existing issues to avoid duplicates. When creating a bug report, include as many details as possible:

- **Use a clear and descriptive title**
- **Describe the exact steps to reproduce the problem**
- **Provide specific examples** to demonstrate the steps
- **Describe the behavior you observed** and what you expected
- **Include screenshots** if applicable
- **Include your environment details** (OS, Python version, Node version, etc.)

### Suggesting Enhancements 💡

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion:

- **Use a clear and descriptive title**
- **Provide a detailed description** of the suggested enhancement
- **Explain why this enhancement would be useful**
- **List any similar features** in other applications if applicable

### Pull Requests 🚀

1. **Fork the repository** and create your branch from `main` or `develop`
2. **Make your changes** following our coding standards
3. **Add tests** if you've added code that should be tested
4. **Update documentation** for any user-facing changes
5. **Ensure the test suite passes**
6. **Make sure your code lints**
7. **Issue the pull request**

## Development Setup

### Prerequisites

- Python 3.12+
- Node.js 18+ (Bun runtime preferred)
- Git

### Setup Steps

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/schichtplan.git
cd schichtplan

# Set up Python environment
python -m venv src/backend/.venv
source src/backend/.venv/bin/activate  # Windows: src\backend\.venv\Scripts\activate
pip install -r requirements.txt

# Install frontend dependencies
cd src/frontend && bun install && cd ../..

# Start the application
./start.sh --with-mcp
```

## Coding Standards

### Python Code

We follow PEP 8 with some modifications. Use the provided tools:

```bash
# Format code
npm run format:backend

# Lint code
npm run lint:backend

# Type check
npm run lint:backend:mypy
```

**Key Guidelines:**
- Use type hints for all function arguments and return values
- Write docstrings for all public functions and classes
- Maximum line length: 88 characters (Black default)
- Use descriptive variable names
- Add comments for complex logic

**Example:**
```python
def calculate_shift_coverage(
    shift: Shift,
    employees: list[Employee],
    min_coverage: int = 1
) -> dict[str, Any]:
    """
    Calculate coverage for a given shift.
    
    Args:
        shift: The shift to calculate coverage for
        employees: List of available employees
        min_coverage: Minimum number of employees required
        
    Returns:
        Dictionary containing coverage details and metrics
    """
    # Implementation here
    pass
```

### TypeScript/React Code

We use ESLint and Prettier for consistency:

```bash
# Format code
cd src/frontend && bun run format

# Lint code
cd src/frontend && bun run lint

# Type check
cd src/frontend && bun run typecheck
```

**Key Guidelines:**
- Use functional components with hooks
- Use TypeScript strict mode
- Prefer const over let
- Use meaningful component and variable names
- Extract reusable logic into custom hooks
- Use Shadcn UI components when possible

**Example:**
```typescript
interface ScheduleTableProps {
  scheduleId: string;
  onUpdate?: (schedule: Schedule) => void;
}

export function ScheduleTable({ scheduleId, onUpdate }: ScheduleTableProps) {
  const { data: schedule, isLoading } = useSchedule(scheduleId);
  
  if (isLoading) return <LoadingSpinner />;
  if (!schedule) return <EmptyState />;
  
  return (
    <div className="space-y-4">
      {/* Component content */}
    </div>
  );
}
```

## Commit Guidelines

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

### Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- **feat**: A new feature
- **fix**: A bug fix
- **docs**: Documentation only changes
- **style**: Changes that don't affect code meaning (formatting, etc.)
- **refactor**: Code change that neither fixes a bug nor adds a feature
- **perf**: Performance improvement
- **test**: Adding or updating tests
- **chore**: Changes to build process or auxiliary tools

### Examples

```bash
feat(scheduler): add support for split week scheduling

Add functionality to handle schedules that cross month boundaries.
This allows users to split weeks at month end for better reporting.

Closes #123

---

fix(auth): prevent duplicate passkey registration

Prevent users from registering multiple passkeys with the same
credential ID, which could cause authentication issues.

---

docs(readme): update installation instructions

Clarify setup steps and add troubleshooting section for common issues.
```

## Pull Request Process

1. **Update Documentation**: Ensure any user-facing changes are documented
2. **Update Tests**: Add or update tests as needed
3. **Run Quality Checks**: Ensure all tests pass and code is properly formatted
   ```bash
   npm run check:all
   npm test
   ```
4. **Update CHANGELOG**: Add an entry describing your changes (if applicable)
5. **Request Review**: Assign reviewers and wait for approval
6. **Address Feedback**: Make requested changes promptly
7. **Squash Commits**: Clean up your commit history if requested
8. **Merge**: Once approved, your PR will be merged

### PR Title Format

Use the same format as commit messages:
```
feat(scope): brief description of changes
```

### PR Description Template

```markdown
## Description
Brief description of what this PR does

## Type of Change
- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update

## How Has This Been Tested?
Describe the tests you ran and how to reproduce them

## Checklist
- [ ] My code follows the style guidelines of this project
- [ ] I have performed a self-review of my own code
- [ ] I have commented my code, particularly in hard-to-understand areas
- [ ] I have made corresponding changes to the documentation
- [ ] My changes generate no new warnings
- [ ] I have added tests that prove my fix is effective or that my feature works
- [ ] New and existing unit tests pass locally with my changes
- [ ] Any dependent changes have been merged and published

## Screenshots (if applicable)
Add screenshots to help explain your changes
```

## Testing Guidelines

### Backend Testing

```bash
# Run all backend tests
pytest -v

# Run with coverage
pytest --cov=src/backend --cov-report=html

# Run specific test file
pytest tests/backend/test_scheduler.py

# Run specific test
pytest tests/backend/test_scheduler.py::test_shift_assignment
```

**Test Structure:**
```python
def test_schedule_generation():
    """Test that schedules are generated correctly."""
    # Arrange
    schedule = create_test_schedule()
    employees = create_test_employees()
    
    # Act
    result = generate_schedule(schedule, employees)
    
    # Assert
    assert result.is_valid
    assert len(result.shifts) > 0
```

### Frontend Testing

```bash
# Run all frontend tests
cd src/frontend && bun test

# Run in watch mode
cd src/frontend && bun test --watch

# Run with coverage
cd src/frontend && bun test --coverage
```

**Test Structure:**
```typescript
describe('ScheduleTable', () => {
  it('renders schedule data correctly', () => {
    const schedule = mockSchedule();
    render(<ScheduleTable schedule={schedule} />);
    
    expect(screen.getByText(schedule.name)).toBeInTheDocument();
  });
  
  it('handles empty state', () => {
    render(<ScheduleTable schedule={null} />);
    expect(screen.getByText(/no schedule/i)).toBeInTheDocument();
  });
});
```

## Documentation Guidelines

- Keep documentation up-to-date with code changes
- Use clear, concise language
- Include code examples where helpful
- Add screenshots for UI changes
- Update the main README for significant features
- Create detailed guides in the `/docs` directory for complex features

## Questions?

Don't hesitate to ask questions! You can:
- Open an issue with the `question` label
- Start a discussion in GitHub Discussions
- Reach out to the maintainers

## Recognition

Contributors are recognized in:
- The project's README
- Release notes
- GitHub's contributor graph

Thank you for contributing to Schichtplan! 🎉
