# Schichtplan Desktop Application

This directory contains the Electron desktop application for Schichtplan.

## Features

- **Self-contained**: No need to install Python or set up a web server
- **Cross-platform**: Works on Windows, macOS, and Linux
- **Native integration**: System tray, native menus, file associations
- **Offline capable**: Works without internet connection
- **Auto-updates**: Automatic updates through GitHub releases

## Architecture

The desktop app consists of:

- **Electron main process**: Manages windows, backend server, and system integration
- **React frontend**: The existing web frontend, bundled for desktop
- **Python backend**: Flask server bundled as executable with PyInstaller
- **SQLite database**: Local file-based database in user data directory

## Development

### Prerequisites

- Node.js 18+
- Python 3.8+
- npm or yarn

### Setup

1. Install dependencies:

```bash
npm install
```

2. Install Python backend dependencies:

```bash
cd ../src/backend
pip install -r requirements.txt
cd ../../electron
```

3. Build frontend:

```bash
cd ../src/frontend
npm install
npm run build
cd ../../electron
```

### Running in Development

```bash
# Start both frontend and backend in development mode
npm run dev

# Or start individually:
npm run dev:backend  # Start Flask backend
npm run dev:frontend # Start React frontend
npm start           # Start Electron app
```

### Building for Production

#### Automated Build

```bash
# Linux/macOS
./build.sh

# Windows
build.bat
```

#### Manual Build

```bash
# Build frontend
npm run build:frontend

# Build backend executable
npm run build:backend

# Build Electron app
npm run build
```

## Distribution

The build process creates installers for each platform:

- **Windows**: `.exe` installer (NSIS)
- **macOS**: `.dmg` disk image
- **Linux**: `.AppImage`, `.deb`, and `.rpm` packages

## Configuration

### Desktop-specific Settings

The desktop app uses a modified configuration that:

- Stores database in user data directory
- Disables web-specific features
- Enables desktop-specific features (window controls, file dialogs)

### Environment Variables

- `FLASK_ENV=desktop`: Enables desktop mode
- `DATABASE_PATH`: Path to database directory
- `LOGS_PATH`: Path to log files

## Project Structure

```
electron/
├── src/
│   ├── main.js                 # Electron main process
│   ├── preload.js             # Preload script for security
│   ├── desktop_server.py      # Desktop-optimized Flask server
│   ├── desktop_config.py      # Desktop configuration
│   └── desktop-frontend-config.js # Frontend desktop utilities
├── resources/
│   ├── backend/               # Built backend executable
│   ├── frontend/              # Built frontend files
│   └── icons/                 # App icons
├── build.sh                   # Build script (Linux/macOS)
├── build.bat                  # Build script (Windows)
├── electron-builder.config.js # Electron builder configuration
└── package.json              # Node.js dependencies and scripts
```

## Features

### Native Integration

- **System tray**: Minimize to system tray
- **Native menus**: File, Edit, View, Window, Help menus
- **Keyboard shortcuts**: Standard shortcuts (Ctrl+N, Ctrl+O, etc.)
- **File associations**: Open .schedule files directly

### Desktop-specific UI

- **Window controls**: Minimize, maximize, close buttons
- **File dialogs**: Native file open/save dialogs
- **Notifications**: Native desktop notifications
- **Print support**: Native print dialog for schedules

### Data Management

- **Local database**: SQLite database in user data directory
- **Backup/restore**: Built-in backup and restore functionality
- **Export/import**: Export schedules to various formats
- **Data security**: Local data storage, no cloud dependencies

## Auto-updates

The app supports automatic updates through GitHub releases:

1. Check for updates on startup
2. Download updates in background
3. Notify user when update is ready
4. Install update and restart app

## Troubleshooting

### Common Issues

1. **Backend server won't start**: Check Python installation and dependencies
2. **Database errors**: Verify database file permissions
3. **Update failures**: Check internet connection and GitHub access

### Logs

Application logs are stored in:

- **Windows**: `%APPDATA%/Schichtplan/logs/`
- **macOS**: `~/Library/Logs/Schichtplan/`
- **Linux**: `~/.local/share/Schichtplan/logs/`

### Reset Application

To reset the application:

1. Close the app
2. Delete the user data directory
3. Restart the app (will create fresh database)

## Security

- **Code signing**: Binaries are signed for security
- **Sandboxing**: App runs in secure sandbox
- **No remote code execution**: All code is bundled locally
- **Data isolation**: User data is stored locally and privately

## Performance

- **Fast startup**: Optimized backend server startup
- **Memory efficient**: Efficient memory usage for desktop
- **Background processing**: Non-blocking operations
- **Caching**: Intelligent caching for better performance
