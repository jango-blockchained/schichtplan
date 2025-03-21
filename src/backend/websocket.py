"""
WebSocket module for handling real-time communication.
"""

# Import eventlet initialization module first
try:
    from src.backend.eventlet_init import eventlet
except ImportError:
    try:
        import eventlet

        eventlet.monkey_patch()
        print(
            "Warning: Using fallback eventlet import. This may cause issues if not imported before other modules."
        )
    except ImportError:
        print("Eventlet not installed. Please install it with: pip install eventlet")
        raise

from flask_socketio import SocketIO, emit
from flask import request, current_app
from datetime import datetime
import jwt

# Create SocketIO instance with async_mode explicitly set to 'eventlet'
socketio = SocketIO(
    async_mode="eventlet",
    logger=True,
    engineio_logger=True,
    ping_timeout=35,
    ping_interval=25,
    cors_allowed_origins="*",
    manage_session=False,
)

# Store connected clients
connected_clients = {}


def broadcast_event(event_type, data):
    """Broadcast event to all subscribed clients"""
    for client_id, client_info in connected_clients.items():
        if event_type in client_info["subscriptions"]:
            emit(event_type, data, room=client_id)


def register_handlers():
    """Register all SocketIO event handlers"""

    @socketio.on("connect")
    def handle_connect():
        """Handle client connection"""
        try:
            # Get the token from query string
            token = request.args.get("token")
            if not token:
                return False

            # Verify the token
            try:
                payload = jwt.decode(
                    token,
                    current_app.config["JWT_SECRET_KEY"],
                    algorithms=["HS256"],
                )
                client_id = payload.get("sub")
                if not client_id:
                    return False
            except jwt.InvalidTokenError:
                return False

            # Store client info
            connected_clients[request.sid] = {
                "client_id": client_id,
                "connected_at": datetime.utcnow(),
                "subscriptions": set(),
            }

            emit("connect_response", {"status": "connected", "client_id": client_id})
            return True

        except Exception as e:
            current_app.logger.error(f"Error in handle_connect: {str(e)}")
            return False

    @socketio.on("disconnect")
    def handle_disconnect():
        """Handle client disconnection"""
        if request.sid in connected_clients:
            del connected_clients[request.sid]

    @socketio.on("subscribe")
    def handle_subscribe(data):
        """Handle subscription to updates"""
        try:
            if request.sid not in connected_clients:
                return {"status": "error", "message": "Not connected"}

            event_type = data.get("event_type")
            if not event_type:
                return {"status": "error", "message": "No event type specified"}

            client = connected_clients[request.sid]
            client["subscriptions"].add(event_type)

            return {"status": "success", "message": f"Subscribed to {event_type}"}

        except Exception as e:
            current_app.logger.error(f"Error in handle_subscribe: {str(e)}")
            return {"status": "error", "message": str(e)}

    @socketio.on("unsubscribe")
    def handle_unsubscribe(data):
        """Handle unsubscription from updates"""
        try:
            if request.sid not in connected_clients:
                return {"status": "error", "message": "Not connected"}

            event_type = data.get("event_type")
            if not event_type:
                return {"status": "error", "message": "No event type specified"}

            client = connected_clients[request.sid]
            client["subscriptions"].discard(event_type)

            return {"status": "success", "message": f"Unsubscribed from {event_type}"}

        except Exception as e:
            current_app.logger.error(f"Error in handle_unsubscribe: {str(e)}")
            return {"status": "error", "message": str(e)}


# Register handlers immediately
register_handlers()


@socketio.on("ping")
def handle_ping():
    emit("pong")


# Event types
SCHEDULE_UPDATED = "schedule_updated"
AVAILABILITY_UPDATED = "availability_updated"
ABSENCE_UPDATED = "absence_updated"
SETTINGS_UPDATED = "settings_updated"
COVERAGE_UPDATED = "coverage_updated"
SHIFT_TEMPLATE_UPDATED = "shift_template_updated"

# Events that require authentication
AUTHENTICATED_EVENTS = [
    # Currently, all events are public
    # Add event types here if they should require authentication
]
