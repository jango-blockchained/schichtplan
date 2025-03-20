import eventlet

eventlet.monkey_patch()

from services.event_service import emit_schedule_updated
from app import create_app


def test_websocket():
    # Create the Flask app with SocketIO
    app, socketio = create_app()

    # Create an application context
    with app.app_context():
        # Emit a test event
        emit_schedule_updated(
            {"message": "Test schedule update", "timestamp": "2025-03-20T16:15:00"}
        )

        print("Test event emitted. Check the WebSocket test page for the event.")


if __name__ == "__main__":
    test_websocket()
