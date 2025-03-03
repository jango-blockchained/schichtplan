# Shift-MCP Server

A Model Context Protocol (MCP) server for shift planning and browser tools integration with Cursor IDE.

## Features

- **Employee Management**: Create, update, and retrieve employee information
- **Schedule Management**: Generate and publish work schedules
- **Shift Management**: Manage shifts and assignments
- **Browser Tools**: Interact with browser for debugging and testing
- **System Settings**: Configure system settings

## Installation

```bash
# Install dependencies
npm install

# Build the server
npm run build

# Start the server
npm start
```

## Running with npx (No Installation Required)

You can run the Shift-MCP server without installing it using npx:

```bash
# Run from the current directory
npx .

# Run from GitHub (if the repository is public)
npx github:username/shift-mcp

# Run from npm registry (if published)
npx shift-mcp
```

The first method is the simplest if you have the code locally. The other methods require publishing the package to GitHub or npm.

## Usage

This MCP server is designed to be used with Cursor IDE. It provides tools and resources for shift planning and browser interaction.

### Tools

#### Employee Management
- `createEmployee`: Create a new employee
- `updateEmployee`: Update an existing employee

#### Schedule Management
- `generateSchedule`: Generate a new schedule
- `publishSchedule`: Publish a schedule
- `exportSchedulePDF`: Export schedule as PDF
- `exportEmployeeSchedulePDF`: Export employee schedule as PDF

#### Browser Tools
- `getConsoleLogs`: Check browser logs
- `getConsoleErrors`: Check browser console errors
- `getNetworkErrorLogs`: Check network error logs
- `getNetworkSuccessLogs`: Check network success logs
- `takeScreenshot`: Take a screenshot of the current browser tab
- `getSelectedElement`: Get the selected element from the browser
- `wipeLogs`: Wipe all browser logs from memory

### Resources

- `/resources/employees`: Get all employees
- `/resources/employee?id={employeeId}`: Get a specific employee
- `/resources/shifts`: Get all shifts
- `/resources/shift?id={shiftId}`: Get a specific shift
- `/resources/schedules`: Get all schedules
- `/resources/currentSchedule`: Get the current schedule
- `/resources/settings`: Get all settings
- `/resources/systemInfo`: Get system information

## Development

```bash
# Run in development mode with auto-restart
npm run dev
```

## License

ISC 