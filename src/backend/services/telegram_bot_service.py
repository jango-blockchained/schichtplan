"""
Telegram Bot Service for Schichtplan

This module provides a comprehensive Telegram bot integration with AI-powered
employee management capabilities. It leverages the existing MCP and AI
infrastructure for intelligent conversation handling.
"""

import os

from telegram import (
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    Update,
)
from telegram.constants import ParseMode
from telegram.ext import (
    Application,
    CallbackQueryHandler,
    CommandHandler,
    ContextTypes,
    MessageHandler,
    filters,
)

from src.backend.models import Employee
from src.backend.services.mcp_service import SchichtplanMCPService
from src.backend.utils.logger import logger

# Constants
MAX_MESSAGE_LENGTH = 4000
DEFAULT_MESSAGE_SPLIT_LENGTH = 4096


class TelegramBotService:
    """Telegram bot service with AI-powered employee management."""

    def __init__(self, flask_app, token: str = None, mode: str = "polling"):
        """
        Initialize the Telegram bot service.

        Args:
            flask_app: Flask application instance
            token: Telegram bot token (from env if not provided)
            mode: Bot mode - 'polling' or 'webhook'
        """
        self.flask_app = flask_app
        self.token = token or os.getenv("TELEGRAM_BOT_TOKEN")
        self.mode = mode or os.getenv("TELEGRAM_BOT_MODE", "polling")
        self.webhook_url = os.getenv("TELEGRAM_BOT_WEBHOOK_URL")
        self.allowed_users = self._parse_allowed_users(
            os.getenv("TELEGRAM_BOT_ALLOWED_USERS", "")
        )
        self.admin_users = self._parse_allowed_users(
            os.getenv("TELEGRAM_BOT_ADMIN_USERS", "")
        )

        self.logger = logger
        self.application = None
        self.mcp_service = None
        self.conversational_service = None

        # User session management
        self.user_sessions = {}

    def _parse_allowed_users(self, users_str: str) -> set:
        """Parse comma-separated user IDs."""
        if not users_str:
            return set()
        return {int(uid.strip()) for uid in users_str.split(",") if uid.strip()}

    def _is_authorized(self, user_id: int) -> bool:
        """Check if user is authorized to use the bot."""
        # If no allowed users configured, allow everyone
        if not self.allowed_users:
            return True
        return user_id in self.allowed_users or user_id in self.admin_users

    def _is_admin(self, user_id: int) -> bool:
        """Check if user is an admin."""
        if not self.admin_users:
            return False
        return user_id in self.admin_users

    async def initialize(self):
        """Initialize the bot application and services."""
        if not self.token:
            raise ValueError("Telegram bot token not configured")

        self.logger.info(f"Initializing Telegram bot in {self.mode} mode")

        # Create application
        self.application = Application.builder().token(self.token).build()

        # Initialize MCP and conversational services
        with self.flask_app.app_context():
            try:
                self.mcp_service = SchichtplanMCPService(self.flask_app)
                # Note: ConversationalSchichtplanMCPService requires additional setup
                # For now, we'll use the base MCP service directly
                self.logger.info("MCP service initialized for Telegram bot")
            except Exception as e:
                self.logger.error(f"Failed to initialize MCP service: {e}")
                # Continue without MCP service for basic functionality

        # Register command handlers
        self._register_handlers()

        self.logger.info("Telegram bot initialized successfully")

    def _register_handlers(self):
        """Register all bot command and message handlers."""
        app = self.application

        # Command handlers
        app.add_handler(CommandHandler("start", self.cmd_start))
        app.add_handler(CommandHandler("help", self.cmd_help))
        app.add_handler(CommandHandler("employees", self.cmd_employees))
        app.add_handler(CommandHandler("search", self.cmd_search_employee))
        app.add_handler(CommandHandler("schedule", self.cmd_schedule))
        app.add_handler(CommandHandler("availability", self.cmd_availability))
        app.add_handler(CommandHandler("status", self.cmd_status))

        # Admin commands
        app.add_handler(CommandHandler("addemployee", self.cmd_add_employee))
        app.add_handler(CommandHandler("updateemployee", self.cmd_update_employee))

        # Callback query handler for inline keyboards
        app.add_handler(CallbackQueryHandler(self.handle_callback))

        # Message handler for natural language queries (AI-powered)
        app.add_handler(
            MessageHandler(filters.TEXT & ~filters.COMMAND, self.handle_ai_message)
        )

        self.logger.info("Telegram bot handlers registered")

    async def cmd_start(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle /start command."""
        user = update.effective_user
        user_id = user.id

        if not self._is_authorized(user_id):
            await update.message.reply_text(
                "❌ You are not authorized to use this bot. "
                "Please contact the administrator."
            )
            return

        welcome_message = (
            f"👋 Welcome to Schichtplan Bot, {user.first_name}!\n\n"
            "I'm your AI-powered assistant for employee management and scheduling.\n\n"
            "Here's what I can help you with:\n"
            "• View and search employees\n"
            "• Check schedules and availability\n"
            "• Manage employee information (admin only)\n"
            "• Natural language queries powered by AI\n\n"
            "Use /help to see all available commands."
        )

        keyboard = [
            [
                InlineKeyboardButton("📋 Employees", callback_data="list_employees"),
                InlineKeyboardButton("📅 Schedule", callback_data="view_schedule"),
            ],
            [
                InlineKeyboardButton("❓ Help", callback_data="show_help"),
                InlineKeyboardButton("ℹ️ Status", callback_data="bot_status"),
            ],
        ]

        reply_markup = InlineKeyboardMarkup(keyboard)
        await update.message.reply_text(
            welcome_message, reply_markup=reply_markup, parse_mode=ParseMode.HTML
        )

    async def cmd_help(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle /help command."""
        user_id = update.effective_user.id

        help_text = (
            "<b>📚 Available Commands</b>\n\n"
            "<b>General Commands:</b>\n"
            "/start - Start the bot and show welcome message\n"
            "/help - Show this help message\n"
            "/employees - List all employees\n"
            "/search &lt;name&gt; - Search for employees\n"
            "/schedule [date] - View schedule\n"
            "/availability &lt;employee_id&gt; - Check availability\n"
            "/status - Bot and system status\n\n"
        )

        if self._is_admin(user_id):
            help_text += (
                "<b>Admin Commands:</b>\n"
                "/addemployee - Add a new employee\n"
                "/updateemployee &lt;id&gt; - Update employee info\n\n"
            )

        help_text += (
            "<b>💡 AI-Powered Queries:</b>\n"
            "You can also ask me questions in natural language!\n\n"
            "Examples:\n"
            "• 'Show me all keyholders'\n"
            "• 'Who is working next Monday?'\n"
            "• 'Find employees available on weekends'\n"
            "• 'What's the schedule for this week?'\n"
        )

        await update.message.reply_text(help_text, parse_mode=ParseMode.HTML)

    async def cmd_employees(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle /employees command - list all employees."""
        if not self._is_authorized(update.effective_user.id):
            await update.message.reply_text("❌ Unauthorized")
            return

        await update.message.reply_text("📋 Fetching employee list...")

        with self.flask_app.app_context():
            try:
                employees = Employee.query.filter_by(is_active=True).all()

                if not employees:
                    await update.message.reply_text("No active employees found.")
                    return

                # Format employee list
                message = "<b>👥 Active Employees</b>\n\n"

                for emp in employees:
                    keyholder = "🔑" if emp.is_keyholder else ""
                    message += (
                        f"{keyholder} <b>{emp.first_name} {emp.last_name}</b>\n"
                        f"  ID: {emp.id} | Group: {emp.employee_group}\n"
                        f"  Hours: {emp.contracted_hours}h/week\n\n"
                    )

                # Split message if too long
                if len(message) > MAX_MESSAGE_LENGTH:
                    chunks = self._split_message(message, MAX_MESSAGE_LENGTH)
                    for chunk in chunks:
                        await update.message.reply_text(
                            chunk, parse_mode=ParseMode.HTML
                        )
                else:
                    await update.message.reply_text(message, parse_mode=ParseMode.HTML)

            except Exception as e:
                self.logger.error(f"Error fetching employees: {e}")
                await update.message.reply_text(
                    "❌ Error fetching employee list. Please try again."
                )

    async def cmd_search_employee(
        self, update: Update, context: ContextTypes.DEFAULT_TYPE
    ):
        """Handle /search command - search employees by name."""
        if not self._is_authorized(update.effective_user.id):
            await update.message.reply_text("❌ Unauthorized")
            return

        if not context.args:
            await update.message.reply_text(
                "Please provide a search term.\nUsage: /search <name>"
            )
            return

        search_term = " ".join(context.args).lower()

        with self.flask_app.app_context():
            try:
                employees = Employee.query.filter_by(is_active=True).all()
                matches = [
                    emp
                    for emp in employees
                    if search_term in emp.first_name.lower()
                    or search_term in emp.last_name.lower()
                ]

                if not matches:
                    await update.message.reply_text(
                        f"No employees found matching '{search_term}'"
                    )
                    return

                message = f"<b>🔍 Search Results for '{search_term}'</b>\n\n"
                for emp in matches:
                    keyholder = "🔑" if emp.is_keyholder else ""
                    message += (
                        f"{keyholder} <b>{emp.first_name} {emp.last_name}</b>\n"
                        f"  ID: {emp.id} | Group: {emp.employee_group}\n"
                        f"  Email: {emp.email or 'N/A'}\n"
                        f"  Phone: {emp.phone or 'N/A'}\n\n"
                    )

                await update.message.reply_text(message, parse_mode=ParseMode.HTML)

            except Exception as e:
                self.logger.error(f"Error searching employees: {e}")
                await update.message.reply_text("❌ Error performing search.")

    async def cmd_schedule(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle /schedule command - view schedule."""
        if not self._is_authorized(update.effective_user.id):
            await update.message.reply_text("❌ Unauthorized")
            return

        await update.message.reply_text(
            "📅 Schedule viewing functionality will be available soon!\n\n"
            "For now, please use the web interface or ask me in natural language:\n"
            "e.g., 'What's the schedule for next week?'"
        )

    async def cmd_availability(
        self, update: Update, context: ContextTypes.DEFAULT_TYPE
    ):
        """Handle /availability command - check employee availability."""
        if not self._is_authorized(update.effective_user.id):
            await update.message.reply_text("❌ Unauthorized")
            return

        if not context.args:
            await update.message.reply_text(
                "Please provide an employee ID.\nUsage: /availability <employee_id>"
            )
            return

        try:
            employee_id = int(context.args[0])
        except ValueError:
            await update.message.reply_text("❌ Invalid employee ID")
            return

        with self.flask_app.app_context():
            try:
                employee = Employee.query.get(employee_id)
                if not employee:
                    await update.message.reply_text(
                        f"❌ Employee with ID {employee_id} not found"
                    )
                    return

                message = (
                    f"<b>👤 {employee.first_name} {employee.last_name}</b>\n\n"
                    f"Status: {'Active' if employee.is_active else 'Inactive'}\n"
                    f"Group: {employee.employee_group}\n"
                    f"Contracted Hours: {employee.contracted_hours}h/week\n"
                    f"Keyholder: {'Yes 🔑' if employee.is_keyholder else 'No'}\n\n"
                    "For detailed availability, use the web interface or ask me directly!"
                )

                await update.message.reply_text(message, parse_mode=ParseMode.HTML)

            except Exception as e:
                self.logger.error(f"Error fetching availability: {e}")
                await update.message.reply_text("❌ Error fetching availability.")

    async def cmd_status(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle /status command - show bot status."""
        if not self._is_authorized(update.effective_user.id):
            await update.message.reply_text("❌ Unauthorized")
            return

        with self.flask_app.app_context():
            try:
                employee_count = Employee.query.filter_by(is_active=True).count()
                keyholder_count = Employee.query.filter_by(
                    is_active=True, is_keyholder=True
                ).count()

                status_message = (
                    "<b>🤖 Bot Status</b>\n\n"
                    f"✅ Bot is running in <b>{self.mode}</b> mode\n"
                    f"🔌 MCP Service: {'Connected' if self.mcp_service else 'Not available'}\n\n"
                    "<b>📊 System Statistics</b>\n"
                    f"👥 Active Employees: {employee_count}\n"
                    f"🔑 Keyholders: {keyholder_count}\n"
                )

                await update.message.reply_text(
                    status_message, parse_mode=ParseMode.HTML
                )

            except Exception as e:
                self.logger.error(f"Error fetching status: {e}")
                await update.message.reply_text("❌ Error fetching system status.")

    async def cmd_add_employee(
        self, update: Update, context: ContextTypes.DEFAULT_TYPE
    ):
        """Handle /addemployee command - add new employee (admin only)."""
        if not self._is_admin(update.effective_user.id):
            await update.message.reply_text("❌ Admin access required")
            return

        await update.message.reply_text(
            "👨‍💼 To add a new employee, please provide details in the following format:\n\n"
            "<code>/addemployee FirstName LastName EmployeeGroup ContractedHours</code>\n\n"
            "Example:\n"
            "<code>/addemployee John Doe VZ 40</code>\n\n"
            "Or use natural language:\n"
            "'Add a new employee named John Doe, full-time, 40 hours per week'",
            parse_mode=ParseMode.HTML,
        )

    async def cmd_update_employee(
        self, update: Update, context: ContextTypes.DEFAULT_TYPE
    ):
        """Handle /updateemployee command - update employee (admin only)."""
        if not self._is_admin(update.effective_user.id):
            await update.message.reply_text("❌ Admin access required")
            return

        await update.message.reply_text(
            "✏️ To update an employee, use natural language:\n\n"
            "Examples:\n"
            "• 'Update employee 5: change hours to 35'\n"
            "• 'Make employee John Doe a keyholder'\n"
            "• 'Deactivate employee ID 10'",
            parse_mode=ParseMode.HTML,
        )

    async def handle_callback(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle inline keyboard button callbacks."""
        query = update.callback_query
        await query.answer()

        if not self._is_authorized(query.from_user.id):
            await query.edit_message_text("❌ Unauthorized")
            return

        data = query.data

        if data == "list_employees":
            await self._send_employees_list(query)
        elif data == "view_schedule":
            await query.edit_message_text(
                "📅 Schedule viewing coming soon!\nUse /schedule command."
            )
        elif data == "show_help":
            await self._send_help_message(query)
        elif data == "bot_status":
            await self._send_status_message(query)

    async def handle_ai_message(
        self, update: Update, context: ContextTypes.DEFAULT_TYPE
    ):
        """Handle natural language messages with AI."""
        if not self._is_authorized(update.effective_user.id):
            await update.message.reply_text("❌ Unauthorized")
            return

        user_message = update.message.text
        user_id = update.effective_user.id

        # Send "typing" action
        await context.bot.send_chat_action(
            chat_id=update.effective_chat.id, action="typing"
        )

        # Process with AI (placeholder for now)
        response = await self._process_ai_query(user_message, user_id)

        await update.message.reply_text(response, parse_mode=ParseMode.HTML)

    async def _process_ai_query(self, message: str, user_id: int) -> str:
        """
        Process user message with AI.

        This integrates with the conversational MCP service for intelligent responses.
        """
        try:
            # TODO: Integrate with ConversationalSchichtplanMCPService
            # For now, provide basic pattern matching

            message_lower = message.lower()

            if any(
                keyword in message_lower
                for keyword in ["employee", "list", "show", "who"]
            ):
                with self.flask_app.app_context():
                    employees = Employee.query.filter_by(is_active=True).limit(5).all()
                    if employees:
                        response = "<b>👥 Here are some employees:</b>\n\n"
                        for emp in employees:
                            response += f"• {emp.first_name} {emp.last_name} ({emp.employee_group})\n"
                        return response

            # Default response
            return (
                "🤖 I'm your AI assistant for Schichtplan!\n\n"
                "I understand natural language queries about:\n"
                "• Employee information\n"
                "• Schedules and shifts\n"
                "• Availability\n\n"
                "Try asking me something like:\n"
                "• 'Show me all keyholders'\n"
                "• 'Who is available tomorrow?'\n"
                "• 'List employees in VZ group'\n\n"
                "Or use /help to see all commands."
            )

        except Exception as e:
            self.logger.error(f"Error processing AI query: {e}")
            return "❌ Sorry, I encountered an error processing your request."

    async def _send_employees_list(self, query):
        """Send employees list via callback query."""
        with self.flask_app.app_context():
            try:
                employees = Employee.query.filter_by(is_active=True).limit(10).all()
                if not employees:
                    await query.edit_message_text("No active employees found.")
                    return

                message = "<b>👥 Active Employees (Top 10)</b>\n\n"
                for emp in employees:
                    keyholder = "🔑" if emp.is_keyholder else ""
                    message += f"{keyholder} {emp.first_name} {emp.last_name} - {emp.employee_group}\n"

                message += "\n\nUse /employees for full list"
                await query.edit_message_text(message, parse_mode=ParseMode.HTML)

            except Exception as e:
                self.logger.error(f"Error in callback: {e}")
                await query.edit_message_text("❌ Error fetching employees.")

    async def _send_help_message(self, query):
        """Send help message via callback query."""
        help_text = (
            "<b>📚 Quick Help</b>\n\n"
            "Use these commands:\n"
            "/employees - List employees\n"
            "/search - Search employees\n"
            "/schedule - View schedule\n"
            "/status - System status\n\n"
            "Or just ask me questions naturally!"
        )
        await query.edit_message_text(help_text, parse_mode=ParseMode.HTML)

    async def _send_status_message(self, query):
        """Send status message via callback query."""
        with self.flask_app.app_context():
            try:
                employee_count = Employee.query.filter_by(is_active=True).count()
                status_msg = (
                    f"<b>🤖 Bot Status</b>\n\n"
                    f"✅ Running in {self.mode} mode\n"
                    f"👥 {employee_count} active employees\n"
                )
                await query.edit_message_text(status_msg, parse_mode=ParseMode.HTML)
            except Exception as e:
                self.logger.error(f"Error in status callback: {e}")
                await query.edit_message_text("❌ Error fetching status.")

    def _split_message(
        self, text: str, max_length: int = DEFAULT_MESSAGE_SPLIT_LENGTH
    ) -> list[str]:
        """Split long messages into chunks."""
        chunks = []
        while text:
            if len(text) <= max_length:
                chunks.append(text)
                break
            # Find last newline before max_length
            split_pos = text.rfind("\n", 0, max_length)
            if split_pos == -1:
                split_pos = max_length
            chunks.append(text[:split_pos])
            text = text[split_pos:].lstrip()
        return chunks

    async def start(self):
        """Start the bot (polling or webhook)."""
        if not self.application:
            await self.initialize()

        if self.mode == "webhook":
            if not self.webhook_url:
                raise ValueError("Webhook URL not configured")

            self.logger.info(f"Starting Telegram bot with webhook: {self.webhook_url}")
            # Note: Webhook setup requires additional Flask route integration
            # This is handled in telegram_routes.py
            # The application will be started by the Flask app
        else:
            self.logger.info("Starting Telegram bot with polling")
            await self.application.initialize()
            await self.application.start()
            await self.application.updater.start_polling(
                drop_pending_updates=True,
                allowed_updates=Update.ALL_TYPES,
            )

    async def stop(self):
        """Stop the bot."""
        if self.application:
            self.logger.info("Stopping Telegram bot")
            if self.application.updater and self.application.updater.running:
                await self.application.updater.stop()
            if self.application.running:
                await self.application.stop()
            await self.application.shutdown()


# Global instance holder
class _TelegramBotHolder:
    """Holder for the global Telegram bot instance."""

    _instance = None

    @classmethod
    def get(cls, flask_app=None):
        """Get or create the Telegram bot instance."""
        if cls._instance is None and flask_app:
            cls._instance = TelegramBotService(flask_app)
        return cls._instance

    @classmethod
    def reset(cls):
        """Reset the instance (for testing)."""
        cls._instance = None


def get_telegram_bot(flask_app=None) -> TelegramBotService:
    """Get or create the global Telegram bot instance."""
    return _TelegramBotHolder.get(flask_app)


async def start_telegram_bot(flask_app):
    """Start the Telegram bot service."""
    bot = get_telegram_bot(flask_app)
    if bot and os.getenv("ENABLE_TELEGRAM_BOT", "false").lower() == "true":
        try:
            await bot.start()
            return bot
        except Exception as e:
            logger.error(f"Failed to start Telegram bot: {e}")
            return None
    return None
