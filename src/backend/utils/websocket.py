from flask import current_app


def emit_event(event_type: str, data: dict) -> None:
    """
    Emit a WebSocket event to all connected clients.

    Args:
        event_type (str): The type of event to emit (e.g., 'schedule_updated', 'availability_updated')
        data (dict): The data to send with the event
    """
    try:
        socketio = current_app.config.get("socketio")
        if socketio:
            socketio.emit(event_type, data)
            current_app.logger.info(f"Emitted WebSocket event: {event_type}")
            current_app.logger.debug(f"Event data: {data}")
        else:
            current_app.logger.warning("SocketIO instance not found in app config")
    except Exception as e:
        current_app.logger.error(f"Error emitting WebSocket event: {str(e)}")
