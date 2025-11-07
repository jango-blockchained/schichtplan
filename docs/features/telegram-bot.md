# Telegram Bot Integration Guide

## Overview

The Schichtplan Telegram Bot provides a comprehensive interface for employee management directly through Telegram, powered by AI integration. Users can interact with the bot using natural language queries or specific commands.

## Features

### 🤖 AI-Powered Interactions
- Natural language understanding for employee queries
- Context-aware conversations
- Integration with the existing MCP (Model Context Protocol) service
- Intelligent response generation

### 👥 Employee Management
- List all active employees
- Search employees by name
- View employee details and availability
- Add and update employee information (admin only)

### 📅 Schedule Management
- View schedules (coming soon)
- Check employee availability
- Schedule queries via natural language

### 🔐 Security & Authentication
- User authorization with allowed user lists
- Role-based access control (admin vs. regular users)
- Secure webhook support for production deployment

## Setup

### 1. Prerequisites

- Python 3.12+
- Telegram Bot Token (obtain from [@BotFather](https://t.me/botfather))
- Schichtplan backend installed and configured

### 2. Installation

The Telegram bot integration is already included in the Schichtplan installation. Ensure you have the required dependencies:

```bash
pip install -r requirements.txt
```

This includes `python-telegram-bot>=21.9`.

### 3. Configuration

Add the following environment variables to your `.env` file:

```bash
# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=your-bot-token-from-botfather
TELEGRAM_BOT_MODE=polling  # or 'webhook' for production
TELEGRAM_BOT_WEBHOOK_URL=https://your-domain.com/api/telegram/webhook
TELEGRAM_BOT_ALLOWED_USERS=123456789,987654321  # Optional: comma-separated user IDs
TELEGRAM_BOT_ADMIN_USERS=123456789  # Optional: comma-separated admin user IDs

# Feature Flag
ENABLE_TELEGRAM_BOT=true
```

#### Configuration Options

- **TELEGRAM_BOT_TOKEN**: Your bot token from BotFather (required)
- **TELEGRAM_BOT_MODE**: 
  - `polling` (default): Bot actively checks for updates. Best for development.
  - `webhook`: Telegram sends updates to your server. Best for production.
- **TELEGRAM_BOT_WEBHOOK_URL**: Your public webhook URL (required for webhook mode)
- **TELEGRAM_BOT_ALLOWED_USERS**: Restrict bot access to specific Telegram user IDs
- **TELEGRAM_BOT_ADMIN_USERS**: Users with admin privileges (can add/modify employees)
- **ENABLE_TELEGRAM_BOT**: Enable/disable the bot (default: false)

### 4. Getting Your Bot Token

1. Open Telegram and search for [@BotFather](https://t.me/botfather)
2. Send `/newbot` command
3. Follow the instructions to create your bot
4. Copy the token provided by BotFather
5. Add it to your `.env` file as `TELEGRAM_BOT_TOKEN`

### 5. Finding Your Telegram User ID

To restrict access or set admin users, you need your Telegram user ID:

1. Open Telegram and search for [@userinfobot](https://t.me/userinfobot)
2. Start the bot and it will show your user ID
3. Add your user ID to the configuration

## Running the Bot

### Development Mode (Polling)

**Option 1: Standalone Bot**
```bash
python start_telegram_bot.py
```

**Option 2: With Full Application**
```bash
# The bot will automatically start if ENABLE_TELEGRAM_BOT=true
./start.sh
```

### Production Mode (Webhook)

1. Set up webhook configuration:
```bash
TELEGRAM_BOT_MODE=webhook
TELEGRAM_BOT_WEBHOOK_URL=https://your-domain.com/api/telegram/webhook
```

2. Start your Flask application:
```bash
./start.sh
```

3. Configure the webhook with Telegram:
```bash
curl -X POST http://localhost:5000/api/telegram/set_webhook
```

4. Verify webhook status:
```bash
curl http://localhost:5000/api/telegram/webhook_info
```

## Bot Commands

### General Commands

- `/start` - Start the bot and show welcome message
- `/help` - Display help information and available commands
- `/employees` - List all active employees
- `/search <name>` - Search for employees by name
- `/schedule [date]` - View schedule (coming soon)
- `/availability <employee_id>` - Check employee availability
- `/status` - Show bot and system status

### Admin Commands

- `/addemployee` - Add a new employee (admin only)
- `/updateemployee <id>` - Update employee information (admin only)

### Natural Language Queries

The bot supports natural language queries powered by AI. Examples:

```
"Show me all keyholders"
"Who is working next Monday?"
"Find employees available on weekends"
"What's the schedule for this week?"
"List employees in the VZ group"
"Add a new employee named John Doe, full-time, 40 hours"
```

## API Endpoints

### Webhook Endpoints

- `POST /api/telegram/webhook` - Receive updates from Telegram
- `POST /api/telegram/set_webhook` - Configure webhook URL
- `POST /api/telegram/delete_webhook` - Remove webhook (switch to polling)
- `GET /api/telegram/webhook_info` - Get webhook status and configuration

### Monitoring Endpoints

- `GET /api/telegram/status` - Get bot status and configuration
- `GET /api/telegram/health` - Health check endpoint for monitoring

## Usage Examples

### Example 1: List Employees

**Command:** `/employees`

**Response:**
```
👥 Active Employees

🔑 John Doe
  ID: 1 | Group: VZ
  Hours: 40h/week

Jane Smith
  ID: 2 | Group: TZ
  Hours: 20h/week
```

### Example 2: Search Employee

**Command:** `/search John`

**Response:**
```
🔍 Search Results for 'John'

🔑 John Doe
  ID: 1 | Group: VZ
  Email: john.doe@example.com
  Phone: +49123456789
```

### Example 3: Natural Language Query

**User:** "Show me all keyholders"

**Response:**
```
🔑 Here are all keyholders:

• John Doe (VZ) - 40h/week
• Sarah Johnson (VZ) - 40h/week
• Mike Wilson (TZ) - 30h/week
```

## AI Integration

The Telegram bot leverages the existing MCP (Model Context Protocol) integration for intelligent interactions:

### Features

- **Context-Aware Responses**: The bot understands the context of your conversation
- **Multi-Turn Conversations**: Ask follow-up questions naturally
- **Intent Recognition**: Automatically determines what you're asking for
- **Smart Suggestions**: Provides helpful suggestions based on your queries

### AI Query Processing Flow

1. User sends a message
2. Bot analyzes the message for intent
3. Checks if it's a command or natural language query
4. For NL queries: Processes through AI orchestrator
5. Retrieves relevant data from the database
6. Formats and sends response

### Extending AI Capabilities

The bot can be extended with additional AI capabilities by:

1. Adding new tools to the MCP service
2. Implementing custom prompt templates
3. Integrating with conversational MCP service
4. Adding specialized handlers for specific query types

## Security Considerations

### Access Control

1. **User Whitelisting**: Restrict bot access to specific Telegram users
   ```bash
   TELEGRAM_BOT_ALLOWED_USERS=123456789,987654321
   ```

2. **Admin Privileges**: Separate admin users from regular users
   ```bash
   TELEGRAM_BOT_ADMIN_USERS=123456789
   ```

3. **Open Access**: Leave both empty to allow all users (not recommended for production)

### Webhook Security

When using webhook mode:

1. Use HTTPS only
2. Consider adding webhook secret token
3. Validate incoming requests
4. Use firewall rules to restrict access

### Data Privacy

- Bot has access to all employee data
- Messages are not logged by default (configure logging as needed)
- User sessions are stored in memory (cleared on restart)

## Troubleshooting

### Bot Not Responding

**Check:**
1. Bot token is correct: `echo $TELEGRAM_BOT_TOKEN`
2. Bot is enabled: `ENABLE_TELEGRAM_BOT=true`
3. Flask app is running: `curl http://localhost:5000/api/telegram/health`
4. Check logs: `tail -f src/logs/app.log`

### Webhook Issues

**Check:**
1. Webhook URL is accessible from internet
2. SSL certificate is valid
3. Webhook is set: `curl http://localhost:5000/api/telegram/webhook_info`
4. Check Telegram's webhook info for errors

**Reset webhook:**
```bash
curl -X POST http://localhost:5000/api/telegram/delete_webhook
curl -X POST http://localhost:5000/api/telegram/set_webhook
```

### Authorization Errors

**Issue:** "You are not authorized to use this bot"

**Solution:**
1. Find your Telegram user ID using [@userinfobot](https://t.me/userinfobot)
2. Add it to `TELEGRAM_BOT_ALLOWED_USERS` or leave empty for open access
3. Restart the bot

### Database Connection Issues

**Check:**
1. Database is initialized: `flask db upgrade`
2. Flask app context is available
3. Check database logs

## Development

### Testing

Run the test suite:

```bash
pytest tests/backend/test_telegram_bot.py -v
```

### Adding New Commands

1. Add handler method in `TelegramBotService` class:
```python
async def cmd_mycommand(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /mycommand."""
    await update.message.reply_text("My response")
```

2. Register in `_register_handlers()`:
```python
app.add_handler(CommandHandler("mycommand", self.cmd_mycommand))
```

### Adding AI Capabilities

1. Extend `_process_ai_query()` method
2. Integrate with MCP tools
3. Add custom prompt templates
4. Test with natural language queries

### Debugging

Enable debug logging:
```bash
LOG_LEVEL=DEBUG
```

View Telegram bot logs:
```bash
tail -f src/logs/app.log | grep -i telegram
```

## Performance Considerations

### Polling Mode
- Polls every few seconds
- Suitable for development and small deployments
- No special server configuration needed

### Webhook Mode
- Zero polling overhead
- Instant message delivery
- Requires public HTTPS endpoint
- Better for production with high traffic

### Resource Usage

- Memory: ~50-100MB per bot instance
- CPU: Minimal (event-driven)
- Network: Depends on message volume

## Roadmap

### Planned Features

- [ ] Advanced schedule viewing and filtering
- [ ] Employee availability management via Telegram
- [ ] Push notifications for schedule changes
- [ ] Shift swap requests via bot
- [ ] Multi-language support
- [ ] Voice message support
- [ ] Inline query support
- [ ] Bot analytics dashboard

## Support

For issues or questions:

1. Check this documentation
2. Review logs: `src/logs/app.log`
3. Check test cases: `tests/backend/test_telegram_bot.py`
4. Open an issue on GitHub

## References

- [python-telegram-bot Documentation](https://docs.python-telegram-bot.org/)
- [Telegram Bot API](https://core.telegram.org/bots/api)
- [MCP Integration Guide](./MCP_INTEGRATION_GUIDE.md)
- [AI Optimization Guide](./AI_OPTIMIZATION_GUIDE.md)
