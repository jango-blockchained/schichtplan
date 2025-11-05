"""
Telegram Bot Routes for Webhook Support

This module provides Flask routes for Telegram webhook integration.
"""

import json
import os

from flask import Blueprint, jsonify, request
from telegram import Update

from src.backend.services.telegram_bot_service import get_telegram_bot
from src.backend.utils.logger import logger

telegram_bp = Blueprint("telegram", __name__, url_prefix="/api/telegram")


@telegram_bp.route("/webhook", methods=["POST"])
async def telegram_webhook():
    """
    Handle incoming Telegram webhook updates.

    This endpoint receives updates from Telegram when webhook mode is enabled.
    """
    try:
        bot_service = get_telegram_bot()

        if not bot_service:
            logger.error("Telegram bot service not initialized")
            return jsonify({"error": "Bot not configured"}), 500

        if not bot_service.application:
            logger.error("Telegram bot application not initialized")
            return jsonify({"error": "Bot not ready"}), 500

        # Get the update from request
        update_data = request.get_json(force=True)
        logger.debug(f"Received webhook update: {json.dumps(update_data)[:200]}")

        # Create Update object
        update = Update.de_json(update_data, bot_service.application.bot)

        # Process the update
        await bot_service.application.process_update(update)

        return jsonify({"ok": True}), 200

    except Exception as e:
        logger.error(f"Error processing webhook: {e}", exc_info=True)
        return jsonify({"error": "Internal error"}), 500


@telegram_bp.route("/set_webhook", methods=["POST"])
async def set_webhook():
    """
    Set the Telegram webhook URL.

    This endpoint configures the Telegram API to send updates to our webhook.
    Admin only endpoint.
    """
    try:
        bot_service = get_telegram_bot()

        if not bot_service:
            return jsonify({"error": "Bot not configured"}), 500

        webhook_url = os.getenv("TELEGRAM_BOT_WEBHOOK_URL")
        if not webhook_url:
            return jsonify({"error": "Webhook URL not configured"}), 400

        if not bot_service.application:
            await bot_service.initialize()

        # Set webhook
        success = await bot_service.application.bot.set_webhook(
            url=webhook_url,
            drop_pending_updates=True,
            allowed_updates=["message", "callback_query"],
        )

        if success:
            logger.info(f"Webhook set successfully to: {webhook_url}")
            return jsonify(
                {
                    "ok": True,
                    "message": "Webhook configured successfully",
                    "webhook_url": webhook_url,
                }
            )
        else:
            return jsonify({"error": "Failed to set webhook"}), 500

    except Exception as e:
        logger.error(f"Error setting webhook: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500


@telegram_bp.route("/webhook_info", methods=["GET"])
async def webhook_info():
    """
    Get current webhook information.

    Returns the current webhook configuration from Telegram.
    """
    try:
        bot_service = get_telegram_bot()

        if not bot_service or not bot_service.application:
            return jsonify({"error": "Bot not configured"}), 500

        webhook_info = await bot_service.application.bot.get_webhook_info()

        return jsonify(
            {
                "ok": True,
                "webhook_info": {
                    "url": webhook_info.url,
                    "has_custom_certificate": webhook_info.has_custom_certificate,
                    "pending_update_count": webhook_info.pending_update_count,
                    "last_error_date": webhook_info.last_error_date,
                    "last_error_message": webhook_info.last_error_message,
                    "max_connections": webhook_info.max_connections,
                    "allowed_updates": webhook_info.allowed_updates,
                },
            }
        )

    except Exception as e:
        logger.error(f"Error getting webhook info: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500


@telegram_bp.route("/delete_webhook", methods=["POST"])
async def delete_webhook():
    """
    Delete the current webhook.

    This switches the bot back to polling mode.
    Admin only endpoint.
    """
    try:
        bot_service = get_telegram_bot()

        if not bot_service or not bot_service.application:
            return jsonify({"error": "Bot not configured"}), 500

        success = await bot_service.application.bot.delete_webhook(
            drop_pending_updates=True
        )

        if success:
            logger.info("Webhook deleted successfully")
            return jsonify({"ok": True, "message": "Webhook deleted successfully"})
        else:
            return jsonify({"error": "Failed to delete webhook"}), 500

    except Exception as e:
        logger.error(f"Error deleting webhook: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500


@telegram_bp.route("/status", methods=["GET"])
def telegram_status():
    """
    Get Telegram bot status.

    Returns information about the bot's current state and configuration.
    """
    try:
        bot_service = get_telegram_bot()

        if not bot_service:
            return jsonify(
                {
                    "ok": False,
                    "enabled": False,
                    "message": "Telegram bot not configured",
                }
            )

        status = {
            "ok": True,
            "enabled": os.getenv("ENABLE_TELEGRAM_BOT", "false").lower() == "true",
            "mode": bot_service.mode,
            "initialized": bot_service.application is not None,
            "has_token": bool(bot_service.token),
            "webhook_url": bot_service.webhook_url
            if bot_service.mode == "webhook"
            else None,
        }

        return jsonify(status)

    except Exception as e:
        logger.error(f"Error getting status: {e}")
        return jsonify({"ok": False, "error": str(e)}), 500


@telegram_bp.route("/health", methods=["GET"])
def telegram_health():
    """
    Health check endpoint for Telegram bot.

    Returns a simple health status for monitoring.
    """
    try:
        bot_service = get_telegram_bot()
        enabled = os.getenv("ENABLE_TELEGRAM_BOT", "false").lower() == "true"

        if not enabled:
            return jsonify({"status": "disabled"}), 200

        if not bot_service or not bot_service.application:
            return jsonify({"status": "not_ready"}), 503

        return jsonify({"status": "healthy"}), 200

    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return jsonify({"status": "unhealthy", "error": str(e)}), 503
