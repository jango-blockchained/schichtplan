#!/usr/bin/env python3
"""
Telegram Bot Startup Script

This script starts the Telegram bot service independently or as part of the
main application startup.
"""

import asyncio
import logging
import os
import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.absolute()
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

from dotenv import load_dotenv

from src.backend.app import create_app
from src.backend.services.telegram_bot_service import start_telegram_bot
from src.backend.utils.logger import logger


async def main():
    """Main entry point for Telegram bot."""
    # Load environment variables
    load_dotenv()

    # Check if bot is enabled
    if os.getenv("ENABLE_TELEGRAM_BOT", "false").lower() != "true":
        logger.info("Telegram bot is disabled. Set ENABLE_TELEGRAM_BOT=true to enable.")
        return

    # Check for token
    if not os.getenv("TELEGRAM_BOT_TOKEN"):
        logger.error("TELEGRAM_BOT_TOKEN not set. Cannot start bot.")
        return

    logger.info("Starting Telegram bot service...")

    # Create Flask app
    app = create_app()

    # Start bot
    try:
        bot = await start_telegram_bot(app)
        if bot:
            logger.info("Telegram bot started successfully")

            # Keep running
            try:
                # If polling mode, the bot will keep running
                if bot.mode == "polling":
                    logger.info("Bot is running in polling mode. Press Ctrl+C to stop.")
                    # Keep the event loop running
                    while True:
                        await asyncio.sleep(1)
                else:
                    logger.info("Bot is running in webhook mode.")
                    # In webhook mode, the Flask app handles the requests
                    logger.info("Start the Flask app to receive webhook updates.")
            except KeyboardInterrupt:
                logger.info("Received shutdown signal")
                await bot.stop()
                logger.info("Bot stopped")
        else:
            logger.error("Failed to start Telegram bot")
            sys.exit(1)

    except Exception as e:
        logger.error(f"Error starting bot: {e}", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Telegram bot shutdown")
