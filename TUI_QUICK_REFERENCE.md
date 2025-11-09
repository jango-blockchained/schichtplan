# Schichtplan Development Manager TUI - Quick Reference

## Overview
The Development Manager TUI is a terminal-based interface for managing all Schichtplan development services including Backend, Frontend, MCP Server, Conversational AI, and Telegram Bot.

## Quick Start

### Installation
```bash
# Install TUI dependencies
pip install -r requirements-tui.txt

# Start the TUI
python3 dev_manager.py
```

## Services Managed

| Service | Port | Description |
|---------|------|-------------|
| Backend | 5000 | Flask API server |
| Frontend | 5173 | Vite development server (Bun) |
| MCP Server | 8001 | Model Context Protocol server |
| Conversational AI | 8002 | AI orchestration service |
| Telegram Bot | N/A | Telegram bot service (polling/webhook) |

## Keyboard Shortcuts

### Essential
- **`q`** - Quit the TUI
- **`Ctrl+C`** - Force quit

### Service Control
- **`a`** - Start all services
- **`s`** - Stop all services
- **`r`** - Restart all services

### Navigation
- **`l`** - Switch to Logs tab
- **`h`** - Switch to Health tab
- **`c`** - Switch to Config tab

### Search
- **`f`** - Focus search input
- Type to filter services by name/ID

## Tabs

### 1. Services Tab
**Purpose:** View and control all services

**Features:**
- Color-coded service cards (🟢 Running, ⭕ Stopped, 🟡 Starting)
- Start/Stop/Restart buttons per service
- Real-time status updates
- Search bar for filtering services

**Actions:**
- Click **Start** to launch a service
- Click **Stop** to terminate a service
- Click **Restart** to restart a running service

### 2. Logs Tab
**Purpose:** View aggregated logs from all services

**Features:**
- Auto-scrolling log viewer
- Color-coded service names
- Timestamps for all events
- Real-time log tailing

**Log Sources:**
- Service stdout/stderr
- MCP Server logs (`mcp_server.log`)
- Backend logs (`instance/logs/app.log`)
- Telegram Bot logs (`instance/logs/telegram.log`)

### 3. Health Tab
**Purpose:** Monitor service health and connectivity

**Columns:**
- **Service** - Service name with status emoji
- **Status** - Health status (Healthy, Starting, Stopped, etc.)
- **Port** - Listening port or N/A
- **Response Time** - Socket connection time (cached for 30s)
- **Last Check** - Timestamp of last health check

**Status Indicators:**
- 🟢 Healthy - Service running and responding
- 🟡 Starting/No Response - Service running but not responding
- ⭕ Stopped - Service not running
- ⚠️ Access Denied - Process exists but can't access

### 4. Stats Tab
**Purpose:** View resource usage statistics

**Columns:**
- **Service** - Service name
- **PID** - Process ID
- **CPU %** - CPU usage percentage
- **Memory (MB)** - Memory usage in megabytes
- **Uptime** - Time since service started

**Refresh Rate:** Based on monitor interval (default 10s)

### 5. Config Tab ⚙️
**Purpose:** Configure TUI behavior and access quick actions

**Sections:**

#### Monitor Interval
- Adjust polling frequency (1-60 seconds)
- Lower = more responsive, higher CPU
- Higher = less responsive, lower CPU
- Default: 10 seconds

#### Auto-refresh Logs
- Toggle automatic log refresh
- Turn off to reduce CPU when not watching logs
- Default: On

#### Quick Actions
- **📂 Open Project Folder** - Opens project root in file manager
- **🌐 Open Backend** - Opens http://localhost:5000 in browser
- **🌐 Open Frontend** - Opens http://localhost:5173 in browser

## Special Features

### Telegram Bot Integration

**Requirements:**
1. Create `.env` file in project root
2. Add `TELEGRAM_BOT_TOKEN=your-bot-token`
3. Add `ENABLE_TELEGRAM_BOT=true`

**Starting:**
1. Configure .env as above
2. Navigate to Services tab
3. Click Start on Telegram Bot service
4. Check logs for "Bot started successfully"

**Troubleshooting:**
- ⚠️ Warning about missing token → Check `.env` file
- ⚠️ Warning about ENABLE_TELEGRAM_BOT → Set to "true"
- Service fails to start → Check logs for specific error

### Service Search

**How to Use:**
1. Press `f` or click search input
2. Type service name or ID
3. Matching services shown, others hidden
4. Clear search to show all

**Search Examples:**
- "back" → Shows Backend
- "telegram" → Shows Telegram Bot
- "ai" → Shows Conversational AI

### Performance Tuning

**For Better Responsiveness:**
- Lower monitor interval (5-7 seconds)
- Keep auto-refresh logs on
- Close unused tabs

**For Lower CPU Usage:**
- Increase monitor interval (15-20 seconds)
- Turn off auto-refresh logs
- Minimize the TUI window

## Common Workflows

### Starting Full Stack Development
1. Start TUI: `python3 dev_manager.py`
2. Press `a` to start all services
3. Wait for services to become healthy (🟢)
4. Press `c` and click "Open Frontend" to view app

### Debugging a Service
1. Navigate to the problematic service in Services tab
2. Click **Stop** if running
3. Press `l` to view logs tab
4. Click **Start** and watch logs for errors
5. Press `h` to check health status

### Monitoring System Resources
1. Press `h` to view health tab (connectivity)
2. Navigate to Stats tab (CPU/memory usage)
3. Identify high resource consumers
4. Consider restarting or investigating

### Quick Browser Testing
1. Press `c` to open config tab
2. Click "Open Backend" to test API
3. Click "Open Frontend" to test UI
4. Services must be running (start with `a`)

## Tips & Tricks

### Efficient Service Management
- Use `a` to start all services at once
- Use `s` to stop all before shutting down
- Use `r` sparingly (stops then starts all)

### Log Monitoring
- Keep logs tab visible during development
- Watch for error patterns
- Use search to find specific service logs
- Disable auto-refresh when not needed (saves CPU)

### Health Checks
- Health checks are cached for 30 seconds
- Force refresh by waiting for next cycle
- Response time indicates network/app health
- "No Response" may mean service still starting

### Resource Optimization
- Increase monitor interval if CPU is high
- Disable log auto-refresh when not viewing
- Close the TUI when not actively managing services
- Use `stop_all` (`s`) before long breaks

## Environment Variables

The TUI respects these environment variables:

### For Services
- `PYTHONPATH` - Set to project root automatically
- `FLASK_ENV` - Set to "development" automatically

### For Telegram Bot
- `TELEGRAM_BOT_TOKEN` - Required for bot to start
- `ENABLE_TELEGRAM_BOT` - Must be "true" to start
- `TELEGRAM_BOT_MODE` - "polling" or "webhook"
- `TELEGRAM_BOT_WEBHOOK_URL` - For webhook mode
- `TELEGRAM_BOT_ALLOWED_USERS` - Comma-separated user IDs
- `TELEGRAM_BOT_ADMIN_USERS` - Comma-separated admin IDs

## Troubleshooting

### TUI Won't Start
```bash
# Check dependencies
pip install -r requirements-tui.txt

# Verify Python version
python3 --version  # Should be 3.10+

# Check for import errors
python3 -c "import textual, psutil"
```

### Service Won't Start
1. Check if port is already in use
2. Verify command path is correct
3. Check logs tab for error messages
4. Ensure dependencies are installed

### High CPU Usage
1. Increase monitor interval in Config tab
2. Disable auto-refresh logs
3. Check Stats tab for resource hogs
4. Consider restarting problematic service

### Logs Not Showing
1. Enable auto-refresh logs toggle
2. Check if log files exist
3. Verify log file permissions
4. Wait for next refresh cycle (1 second)

### Services Show "Access Denied"
1. Check process permissions
2. Try restarting the TUI
3. Stop and restart the service
4. Verify service is owned by current user

## Limitations

- Cannot manage services not defined in code
- Log file paths are hardcoded
- Assumes virtual environment at specific location
- Quick actions may not work on all platforms
- No support for remote service management

## Getting Help

### In-App Help
- Check Logs tab for error messages
- Review Health tab for connectivity issues
- Monitor Stats tab for resource problems

### External Resources
- Main Documentation: `README.md`
- Enhancement Details: `TUI_ENHANCEMENT_SUMMARY.md`
- Telegram Bot Docs: `src/backend/services/telegram_bot_service.py`
- Issue Tracker: GitHub Issues

## Exit and Cleanup

### Proper Shutdown
1. Press `s` to stop all services
2. Wait for services to stop gracefully
3. Press `q` to quit the TUI

### Force Shutdown
- Press `Ctrl+C` to force quit
- Services will be terminated forcefully
- May leave orphaned processes

### After Exit
- Services are automatically terminated
- Log files remain in `instance/logs/`
- No cleanup required

---

**Version:** 2.0.0
**Last Updated:** 2025-11-09

For detailed technical information, see `TUI_ENHANCEMENT_SUMMARY.md`
