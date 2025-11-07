# Quick Start Guide

Get Schichtplan up and running in 5 minutes! This guide will walk you through the fastest way to start using Schichtplan.

## Prerequisites

Before you begin, ensure you have:

- Python 3.12 or higher
- Bun runtime (or Node.js 18+)
- Git
- A WebAuthn-compatible browser (Chrome, Firefox, Safari, Edge)

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/jango-blockchained/schichtplan.git
cd schichtplan
```

### 2. Set Up Python Environment

=== "Linux/macOS"

    ```bash
    python -m venv src/backend/.venv
    source src/backend/.venv/bin/activate
    pip install -r requirements.txt
    ```

=== "Windows"

    ```bash
    python -m venv src\backend\.venv
    src\backend\.venv\Scripts\activate
    pip install -r requirements.txt
    ```

### 3. Install Frontend Dependencies

```bash
cd src/frontend
bun install
cd ../..
```

!!! tip "Using npm instead of Bun?"
    The project is optimized for Bun, but npm will work: `npm install`

### 4. Start the Application

```bash
./start.sh --with-mcp
```

This will start:
- **Backend** on http://localhost:5000
- **Frontend** on http://localhost:5173
- **MCP Server** on http://localhost:8001 (for AI features)

!!! info "Without AI Features"
    If you don't need AI integration, simply run `./start.sh`

## First-Time Setup Wizard

When you first open the application at http://localhost:5173, you'll be guided through a setup wizard:

### Step 1: Create Admin Passkey

<div class="grid" markdown>

<div markdown>

1. Enter your email address
2. Click **"Create Passkey"**
3. Follow your browser's prompt to register your passkey:
    - Use your fingerprint
    - Use face recognition
    - Use a security key
    - Use device PIN

The username defaults to **"admin"** and cannot be changed.

</div>

<div markdown>

!!! success "Why Passkeys?"
    Passkeys are more secure than passwords:
    
    - 🔐 No password to remember
    - 🛡️ Protected from phishing
    - ⚡ Faster authentication
    - 📱 Synced across devices

</div>

</div>

### Step 2: Save Recovery Codes

After passkey creation, you'll receive **4 recovery codes**. These are essential backup codes:

!!! warning "Important: Save Your Recovery Codes"
    - Each code can only be used once
    - Store them securely (password manager, safe place)
    - You'll need them if you lose access to your passkey
    - Cannot be recovered if lost!

Example recovery codes:
```
ABCD-EFGH-IJKL-MNOP
QRST-UVWX-YZAB-CDEF
GHIJ-KLMN-OPQR-STUV
WXYZ-1234-5678-90AB
```

### Step 3: Configure AI (Optional)

You can optionally configure AI integration:

=== "Google Gemini"

    ```bash
    # Add to your .env file
    GEMINI_API_KEY=your-api-key-here
    ```

=== "OpenAI"

    ```bash
    # Add to your .env file
    OPENAI_API_KEY=your-api-key-here
    ```

=== "Anthropic Claude"

    ```bash
    # Add to your .env file
    ANTHROPIC_API_KEY=your-api-key-here
    ```

!!! tip "Skip AI Setup"
    You can configure AI later or skip it entirely. Schichtplan works great without AI features!

## Daily Login

After initial setup, you'll need to authenticate once per day:

1. Open http://localhost:5173
2. Click **"Login with Passkey"**
3. Use your biometric or security key
4. You're in! 🎉

!!! info "Using Recovery Codes"
    If your passkey is unavailable:
    
    1. Click **"Use Recovery Code"**
    2. Enter one of your 4 recovery codes
    3. Code will be consumed and cannot be reused

## What's Next?

Now that Schichtplan is running, explore these features:

<div class="grid cards" markdown>

-   :material-account-group:{ .lg .middle } __Add Employees__

    ---

    Navigate to the Employees page and add your team members.

    [:octicons-arrow-right-24: Employee Management Guide](../features/employee-management.md)

-   :material-calendar:{ .lg .middle } __Create a Schedule__

    ---

    Go to Schedules and create your first shift plan.

    [:octicons-arrow-right-24: Schedule Management Guide](../features/schedule-management.md)

-   :material-cog:{ .lg .middle } __Configure Settings__

    ---

    Customize Schichtplan to match your organization's needs.

    [:octicons-arrow-right-24: Configuration Guide](../getting-started/installation.md#configuration)

-   :material-robot:{ .lg .middle } __Enable AI Features__

    ---

    Set up AI integration for intelligent scheduling.

    [:octicons-arrow-right-24: AI Integration Guide](../features/ai-integration.md)

</div>

## Quick Reference

### Common Commands

```bash
# Start application (basic)
./start.sh

# Start with AI/MCP features
./start.sh --with-mcp

# Start backend only
./src/backend/.venv/bin/python src/backend/run.py

# Start frontend only
cd src/frontend && bun dev

# Run tests
npm test

# Lint code
npm run lint

# Format code
npm run format
```

### Default URLs

| Service | URL |
|---------|-----|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:5000 |
| MCP Server | http://localhost:8001 |
| API Documentation | http://localhost:5000/api/docs |

### Default Credentials

| Field | Value |
|-------|-------|
| Username | admin |
| Password | _Uses passkey, no password_ |
| Email | _Set during setup_ |

## Troubleshooting

### Application Won't Start

??? question "Port already in use"
    
    If port 5000 or 5173 is already in use:
    
    ```bash
    # Find and kill the process
    lsof -ti:5000 | xargs kill -9
    lsof -ti:5173 | xargs kill -9
    ```

??? question "Python version issues"
    
    Ensure you're using Python 3.12+:
    
    ```bash
    python --version
    # Should show Python 3.12.x or higher
    ```

??? question "Module not found errors"
    
    Make sure you activated the virtual environment:
    
    ```bash
    source src/backend/.venv/bin/activate  # Linux/macOS
    # or
    src\backend\.venv\Scripts\activate  # Windows
    ```

### Passkey Issues

??? question "Passkey registration fails"
    
    - Ensure you're using HTTPS or localhost
    - Check browser compatibility (Chrome, Firefox, Safari, Edge)
    - Try a different authentication method (security key, PIN)
    - Clear browser data and try again

??? question "Lost passkey and recovery codes"
    
    If you've lost both your passkey and all recovery codes:
    
    ```bash
    # Reset authentication (WARNING: deletes all data)
    python src/backend/tools/rebuild_db.py
    ```

### More Help

- 📖 [Full Installation Guide](installation.md)
- 🔧 [Troubleshooting Guide](../guides/troubleshooting.md)
- 💬 [Ask in Discussions](https://github.com/jango-blockchained/schichtplan/discussions)
- 🐛 [Report an Issue](https://github.com/jango-blockchained/schichtplan/issues)

## Next Steps

Ready to dive deeper? Check out these guides:

1. [Complete Installation Guide](installation.md) - Detailed setup instructions
2. [Setup & Authentication](setup-authentication.md) - Configure WebAuthn and recovery
3. [First Steps Tutorial](first-steps.md) - Learn the basics
4. [Features Overview](../features/overview.md) - Explore all capabilities
