# Features Overview

Schichtplan is packed with powerful features designed to make employee scheduling effortless and efficient. This page provides an overview of all major capabilities.

## 🎨 Schedule Management

### Visual Schedule Builder

Create and manage schedules with an intuitive, drag-and-drop interface:

- **Calendar View**: Visual representation of all shifts
- **Week Navigation**: Easy navigation between weeks with month boundary handling
- **Version Control**: Create and compare multiple schedule versions
- **Real-time Validation**: Instant feedback on coverage and conflicts
- **Color-Coded Display**: Easy identification of shift types and employee groups

[:octicons-arrow-right-24: Learn more about Schedule Management](schedule-management.md)

### Coverage Management

Define and track staffing requirements with precision:

- **Interval-Based Coverage**: Set minimum staff requirements for any time period
- **Time Blocks**: Define coverage for specific time ranges (e.g., morning, afternoon, evening)
- **Visual Indicators**: See at a glance where coverage is insufficient
- **Automatic Calculations**: System tracks actual vs. required staffing
- **Smart Recommendations**: AI suggests optimal staffing levels

### Shift Templates

Create reusable shift patterns:

- **Flexible Timing**: Define start and end times for shifts
- **Day Patterns**: Specify which days shifts apply to
- **Keyholder Requirements**: Mark shifts that require keyholder presence
- **Pause Times**: Configure break periods
- **Employee Types**: Assign shifts to specific employee groups (VZ, TZ, GFB, TL)

## 👥 Employee Management

### Employee Profiles

Comprehensive employee information management:

- **Personal Details**: Names, contact information, employment dates
- **Employment Type**: Full-time (VZ), Part-time (TZ), Mini-Job (GFB), Team Lead (TL)
- **Contract Hours**: Track weekly and monthly hour limits
- **Keyholder Status**: Mark employees authorized to open/close
- **Active Status**: Enable/disable employees without deletion

### Availability Management

Track when employees can work:

- **Day-by-Day Availability**: Set available time slots for each weekday
- **Preference Levels**: Mark times as "Fixed" or "Preferred"
- **Visual Display**: Hover over employee names to see availability
- **Quick Access**: Instant availability lookup during scheduling
- **Bulk Import**: Import availability from CSV files

[:octicons-arrow-right-24: Employee Management Guide](employee-management.md)

### Vacation Planning

Integrated vacation and time-off management:

- **Vacation Requests**: Employees request time off
- **Approval Workflow**: Managers approve or deny requests
- **Calendar Integration**: Vacation automatically blocks scheduling
- **Balance Tracking**: Monitor remaining vacation days
- **Conflict Detection**: Alerts when multiple employees request same dates

[:octicons-arrow-right-24: Vacation Planning Guide](vacation-planning.md)

## 🤖 AI & Automation

### AI-Powered Scheduling

Leverage artificial intelligence for optimal schedules:

- **Automatic Assignment**: AI assigns shifts based on availability, preferences, and coverage
- **Conflict Resolution**: Detects and suggests fixes for scheduling conflicts
- **Workload Balancing**: Ensures fair distribution of hours across employees
- **Compliance Checking**: Validates against contract hours and labor laws
- **Natural Language Queries**: Ask questions about schedules in plain English

[:octicons-arrow-right-24: AI Integration Guide](ai-integration.md)

### Model Context Protocol (MCP)

Advanced AI integration for development tools:

- **Tool Integration**: Use Schichtplan data in Claude, ChatGPT, and other AI tools
- **Programmatic Access**: AI tools can read and modify schedules
- **Custom Workflows**: Build AI-powered automation for your specific needs
- **Multiple Transports**: stdio, SSE, and HTTP for different integration scenarios

### Telegram Bot

Manage schedules from your phone:

- **Natural Language Commands**: Chat with the bot like a person
- **Employee Lookup**: Search and view employee details
- **Schedule Queries**: Check schedules and availability
- **Notifications**: Receive alerts about schedule changes
- **Access Control**: Role-based permissions for secure access

[:octicons-arrow-right-24: Telegram Bot Setup](telegram-bot.md)

## 📊 Reporting & Export

### PDF Export

Professional schedule printouts:

- **Customizable Layouts**: Choose from multiple PDF templates
- **Employee Views**: Generate per-employee schedules
- **Master Schedules**: Full week/month overview PDFs
- **Professional Formatting**: Clean, readable output
- **Print-Ready**: Optimized for printing and distribution

[:octicons-arrow-right-24: PDF Export Guide](pdf-export.md)

### Statistics & Analytics

Track scheduling metrics:

- **Coverage Statistics**: See coverage percentages for each time block
- **Hour Summaries**: Total hours per employee, per week, per month
- **Cost Calculations**: Estimate labor costs (when wage data provided)
- **Trend Analysis**: Identify patterns in scheduling over time
- **Compliance Reports**: Track adherence to contract hours

## 🔐 Security & Authentication

### Passwordless Authentication

Modern, secure access with WebAuthn:

- **Passkey Support**: Use biometrics or security keys to log in
- **No Passwords**: Eliminates password-related security risks
- **Recovery Codes**: Backup authentication via single-use codes
- **Daily Re-Authentication**: Enhanced security with 24-hour sessions
- **Multi-Device**: Passkeys sync across your devices

### Access Control

Manage who can do what:

- **Role-Based Permissions**: Admin and user roles
- **Secure API Access**: JWT tokens for programmatic access
- **Audit Trail**: Log of user actions and changes
- **Session Management**: Active session tracking and termination

## 🚀 Deployment Options

### Web Application

Run as a traditional web app:

- **Responsive Design**: Works on desktop, tablet, and mobile
- **Modern Browsers**: Chrome, Firefox, Safari, Edge
- **Real-Time Updates**: Changes sync instantly
- **Offline Capable**: Progressive Web App features

### Docker Containers

Containerized deployment:

- **Easy Setup**: One-command deployment
- **Isolated Environment**: No conflicts with other applications
- **Scalable**: Run multiple instances
- **Multi-Architecture**: Supports amd64 and arm64

[:octicons-arrow-right-24: Docker Deployment Guide](../deployment/docker.md)

### Desktop Applications

Native apps for all major platforms:

- **Windows**: NSIS installer or portable EXE
- **macOS**: DMG installer for Intel and Apple Silicon
- **Linux**: AppImage, DEB, and RPM packages
- **Offline Mode**: Works without internet connection
- **Native Performance**: Faster than web version

[:octicons-arrow-right-24: Desktop App Guide](../deployment/desktop.md)

## 🛠️ Developer Features

### REST API

Comprehensive programmatic access:

- **Full CRUD Operations**: Create, read, update, delete all resources
- **OpenAPI Documentation**: Interactive API explorer
- **JSON Responses**: Standard, predictable data format
- **Authentication**: JWT token-based security
- **Rate Limiting**: Protects against abuse

[:octicons-arrow-right-24: API Reference](../api/rest-api.md)

### MCP Server

AI tool integration:

- **16 Tools**: Employee management, schedule generation, system status
- **7 Resources**: Read-only access to system data
- **6 Prompts**: Pre-built AI interaction templates
- **Multiple Transports**: stdio, SSE, HTTP

[:octicons-arrow-right-24: MCP Documentation](../api/mcp-server.md)

### Extensibility

Customize and extend:

- **Plugin System**: Add custom functionality
- **Theme Support**: Customize colors and styling
- **Webhook Support**: React to events in real-time
- **Database Migrations**: Safe schema evolution

## 📈 Monitoring & Diagnostics

### Comprehensive Logging

Track everything that happens:

- **Structured Logs**: JSON-formatted for easy parsing
- **Multiple Log Files**: Separate logs for different concerns
- **Log Rotation**: Automatic cleanup of old logs
- **Error Tracking**: Dedicated error log with stack traces
- **Audit Trail**: Track user actions for compliance

### Diagnostic Tools

Built-in debugging utilities:

- **Database Validation**: Check database integrity
- **Schedule Analysis**: Detailed breakdown of schedule generation
- **Performance Metrics**: Track slow operations
- **Health Checks**: Verify system is running correctly

## 🎯 Key Differentiators

What makes Schichtplan special:

| Feature | Schichtplan | Typical Alternatives |
|---------|-------------|---------------------|
| **AI Integration** | ✅ MCP + Multiple AI providers | ❌ No AI or basic automation |
| **Authentication** | ✅ Passwordless WebAuthn | ⚠️ Traditional passwords |
| **Deployment** | ✅ Web, Docker, Desktop, Telegram | ⚠️ Web only or SaaS only |
| **Pricing** | ✅ Open source, free | 💰 Per-user fees |
| **Data Control** | ✅ Self-hosted, your data | ⚠️ Cloud-only, vendor lock-in |
| **Customization** | ✅ Full source access | ❌ Limited customization |
| **API** | ✅ RESTful + MCP | ⚠️ Limited or no API |
| **Mobile** | ✅ Responsive web + Telegram | ⚠️ Web only or separate app |

## Coming Soon

Features in development:

- 📱 Native mobile apps (iOS, Android)
- 📧 Email notifications
- 📊 Advanced analytics dashboard
- 🔄 Multi-location support
- 🌐 Multi-language interface
- 📅 Calendar sync (Google Calendar, Outlook)
- 💬 In-app messaging
- 🎓 Training mode for new schedulers

---

## Next Steps

Ready to explore specific features?

- [Schedule Management](schedule-management.md) - Master schedule creation
- [Employee Management](employee-management.md) - Manage your team
- [AI Integration](ai-integration.md) - Set up AI features
- [Telegram Bot](telegram-bot.md) - Mobile management
- [PDF Export](pdf-export.md) - Create professional printouts
