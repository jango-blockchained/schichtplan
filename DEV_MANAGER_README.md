# Schichtplan Development Manager - Modern TUI

## Overview

The Schichtplan Development Manager is a professional Terminal User Interface (TUI) built with [Textual](https://textual.textualize.io/) that replaces the legacy tmux-based setup. It provides a modern, interactive, and feature-rich development environment for managing all Schichtplan services.

## Features

### 🎯 Core Features

- **Real-time Service Management** - Start, stop, and restart services with a click
- **Live Status Monitoring** - See service health, ports, and PIDs at a glance
- **Interactive Log Viewer** - Stream logs from all services in real-time
- **Resource Tracking** - Monitor CPU and memory usage per service
- **Health Dashboard** - Check service health with response times
- **Keyboard Shortcuts** - Professional keybindings for power users
- **Mouse Support** - Click buttons and navigate with your mouse
- **Clean Exit** - Gracefully stops all services on quit

### 🚀 Services Managed

1. **Backend (Flask)** - Port 5000
2. **Frontend (Vite/Bun)** - Port 5173
3. **MCP Server** - Port 8001 (optional)
4. **Conversational AI** - Port 8002 (optional)
5. **Redis** - Port 6379 (auto-managed)

## Installation

### Install TUI Dependencies

```bash
# Install using pip in the backend virtualenv
./src/backend/.venv/bin/pip install -r requirements-tui.txt
```

Or the new start.sh script will auto-install on first run.

### Required System Dependencies

- Python 3.8+
- Bun (JavaScript runtime)
- Redis (for Conversational AI)

## Usage

### Quick Start

```bash
# Start with modern TUI (recommended)
./start.sh

# Start with all AI features enabled
./start.sh --with-mcp --with-conversational-ai

# Don't auto-start services (manual control)
./start.sh --no-auto-start

# Use legacy tmux interface
./start.sh --legacy
```

### Keyboard Shortcuts

| Key      | Action                     |
| -------- | -------------------------- |
| `q`      | Quit and stop all services |
| `r`      | Restart all services       |
| `s`      | Stop all services          |
| `l`      | Show logs tab              |
| `h`      | Show health tab            |
| `Ctrl+C` | Force quit                 |

### TUI Layout

```
┌─────────────────────────────────────────────────────────────────┐
│ Schichtplan Development Manager                     [Status Bar]│
├─────────────────────────────────────────────────────────────────┤
│ [Services] [Logs] [Health] [Stats]                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Services Tab:                                                   │
│    - Service cards with status indicators                       │
│    - Start/Stop/Restart buttons per service                     │
│    - Port and PID information                                   │
│                                                                   │
│  Logs Tab:                                                       │
│    - Live streaming logs from all services                      │
│    - Auto-scroll with manual control                            │
│    - Timestamp for each log entry                               │
│                                                                   │
│  Health Tab:                                                     │
│    - Service health status                                       │
│    - Response times                                              │
│    - Last check timestamp                                        │
│                                                                   │
│  Stats Tab:                                                      │
│    - CPU usage per service                                       │
│    - Memory consumption                                          │
│    - Uptime tracking                                             │
│    - PID information                                             │
│                                                                   │
├─────────────────────────────────────────────────────────────────┤
│ q:Quit r:RestartAll s:StopAll l:Logs h:Health                  │
└─────────────────────────────────────────────────────────────────┘
```

## Architecture

### Technology Stack

- **Textual** - Modern TUI framework with reactive UI
- **psutil** - Cross-platform process and system monitoring
- **Rich** - Beautiful terminal formatting (used by Textual)
- **asyncio** - Asynchronous service management

### Service Management

Each service is managed through the `ServiceStatus` class which tracks:

- Process handle and PID
- Port number
- Start time and uptime
- Resource usage (CPU, memory)
- Current status (STOPPED, STARTING, RUNNING)

### Background Monitoring

A dedicated async task continuously monitors:

- Service process status
- CPU and memory usage
- Health check endpoints
- Log output streams

## Comparison: Legacy vs Modern TUI

| Feature              | Legacy (tmux)        | Modern (Textual)      |
| -------------------- | -------------------- | --------------------- |
| **Service Control**  | Bash scripts in menu | Interactive buttons   |
| **Log Viewing**      | `tail -f` in panes   | Integrated log viewer |
| **Status Display**   | Manual checks        | Real-time monitoring  |
| **Resource Usage**   | Not available        | CPU/Memory tracking   |
| **Health Checks**    | Manual curl commands | Automated dashboard   |
| **Error Visibility** | Hidden in log files  | Immediate alerts      |
| **UX**               | Terminal-multiplexer | Native TUI app        |
| **Maintainability**  | Complex bash scripts | Clean Python OOP      |
| **Extensibility**    | Hard to extend       | Easy to add features  |

## Migration Guide

### From tmux to TUI

**Old workflow:**

```bash
./start.sh                      # Start tmux session
# Navigate between panes with Ctrl+B arrow keys
# Use menu.sh for service control
tmux attach -t schichtplan      # Reattach to session
```

**New workflow:**

```bash
./start.sh                      # Start TUI directly
# Click buttons or use keyboard shortcuts
# Everything in one interface
# Press 'q' to quit cleanly
```

### Keeping Legacy Setup

The old tmux setup is preserved as `start-legacy.sh`:

```bash
# Use old tmux interface
./start.sh --legacy

# Or directly
./start-legacy.sh
```

## Development

### Adding New Services

Edit `dev_manager.py` and add to the `self.services` dict:

```python
self.services["myservice"] = ServiceStatus(
    name="My Service",
    port=8080,
    command=["python", "myservice.py"],
    cwd=self.project_root / "services"
)
```

### Customizing UI

The TUI uses CSS-like styling. Edit the `CSS` class variable:

```python
class DevManagerApp(App):
    CSS = """
    ServiceCard {
        border: solid $primary;
        /* Add your styles */
    }
    """
```

### Debugging

Enable Textual dev tools:

```bash
# In one terminal - run dev console
textual console

# In another terminal - run TUI
./start.sh
```

## Troubleshooting

### TUI Won't Start

```bash
# Check TUI dependencies
./src/backend/.venv/bin/python -c "import textual; print(textual.__version__)"

# Reinstall if needed
./src/backend/.venv/bin/pip install -r requirements-tui.txt --force-reinstall
```

### Services Don't Start

1. Check logs tab in TUI for error messages
2. Verify ports aren't already in use:
   ```bash
   netstat -tulpn | grep -E '5000|5173|8001|8002'
   ```
3. Ensure virtual environment is properly set up

### Legacy Mode Needed

If you encounter issues with the new TUI:

```bash
./start.sh --legacy
```

Report issues on GitHub with:

- TUI version
- Python version
- Terminal type (GNOME Terminal, iTerm2, etc.)
- Error messages from logs tab

## Future Enhancements

### Planned Features

- [ ] **Ngrok Integration** - Public URL management in TUI
- [ ] **Log Filtering** - Search and filter logs by level/service
- [ ] **Database Management** - Run migrations, check schema
- [ ] **Test Runner** - Run tests from TUI
- [ ] **Git Integration** - Branch info, commit shortcuts
- [ ] **Performance Graphs** - Historical CPU/memory charts
- [ ] **Custom Commands** - User-defined shortcuts
- [ ] **Theme Support** - Dark/light mode, custom colors
- [ ] **Split Pane Logs** - View multiple service logs simultaneously
- [ ] **Export Logs** - Save logs to file from UI

### Ideas Welcome!

Open an issue or PR with your suggestions.

## License

Same as main project.

## Credits

- Built with [Textual](https://textual.textualize.io/) by Textualize
- Uses [Rich](https://github.com/Textualize/rich) for terminal formatting
- Powered by [psutil](https://github.com/giampaolo/psutil) for system monitoring
