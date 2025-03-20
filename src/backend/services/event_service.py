"""
Services for emitting WebSocket events for real-time updates.
"""

from flask import current_app
from src.backend.websocket import broadcast_event


def emit_schedule_updated(schedule_data):
    """
    Emit a schedule_updated event to all subscribed clients.

    Args:
        schedule_data (dict): Data about the updated schedule
    """
    try:
        broadcast_event("schedule_updated", schedule_data)
        current_app.logger.info(f"Emitted schedule_updated event: {schedule_data}")
    except Exception as e:
        current_app.logger.error(f"Error emitting schedule_updated event: {str(e)}")


def emit_availability_updated(availability_data):
    """
    Emit an availability_updated event to all subscribed clients.

    Args:
        availability_data (dict): Data about the updated availability
    """
    try:
        broadcast_event("availability_updated", availability_data)
        current_app.logger.info(
            f"Emitted availability_updated event: {availability_data}"
        )
    except Exception as e:
        current_app.logger.error(f"Error emitting availability_updated event: {str(e)}")


def emit_absence_updated(absence_data):
    """
    Emit an absence_updated event to all subscribed clients.

    Args:
        absence_data (dict): Data about the updated absence
    """
    try:
        broadcast_event("absence_updated", absence_data)
        current_app.logger.info(f"Emitted absence_updated event: {absence_data}")
    except Exception as e:
        current_app.logger.error(f"Error emitting absence_updated event: {str(e)}")


def emit_settings_updated(settings_data):
    """
    Emit a settings_updated event to all subscribed clients.

    Args:
        settings_data (dict): Data about the updated settings
    """
    try:
        broadcast_event("settings_updated", settings_data)
        current_app.logger.info(f"Emitted settings_updated event: {settings_data}")
    except Exception as e:
        current_app.logger.error(f"Error emitting settings_updated event: {str(e)}")


def emit_coverage_updated(coverage_data):
    """
    Emit a coverage_updated event to all subscribed clients.

    Args:
        coverage_data (dict): Data about the updated coverage
    """
    try:
        broadcast_event("coverage_updated", coverage_data)
        current_app.logger.info(f"Emitted coverage_updated event: {coverage_data}")
    except Exception as e:
        current_app.logger.error(f"Error emitting coverage_updated event: {str(e)}")


def emit_shift_template_updated(shift_template_data):
    """
    Emit a shift_template_updated event to all subscribed clients.

    Args:
        shift_template_data (dict): Data about the updated shift template
    """
    try:
        broadcast_event("shift_template_updated", shift_template_data)
        current_app.logger.info(
            f"Emitted shift_template_updated event: {shift_template_data}"
        )
    except Exception as e:
        current_app.logger.error(
            f"Error emitting shift_template_updated event: {str(e)}"
        )
