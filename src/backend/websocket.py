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
    ping_timeout=20000,  # Match client timeout
    ping_interval=25000,  # Match client interval
    cors_allowed_origins="*",
    manage_session=False,
    handle_sigint=True,
    message_queue=None,
    always_connect=False,  # Don't allow connections without proper auth
    allow_upgrades=True,
    json=None,
    max_http_buffer_size=1000000,
    async_handlers=True,
    cookie=None,
    transports=["websocket", "polling"],
    cors_credentials=True,  # Allow credentials
    cors_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],  # Allow all methods
    cors_headers=["Content-Type", "Authorization"],  # Allow necessary headers
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
            # Get the token from auth data
            auth = request.args.get("token") or (
                getattr(request, "headers", {}).get("Authorization")
                or (request.get_json() or {}).get("auth", {}).get("token")
            )

            if not auth:
                print("No token provided")
                return False

            # Remove 'Bearer ' prefix if present
            if auth.startswith("Bearer "):
                auth = auth[7:]

            # Verify the token
            try:
                payload = jwt.decode(
                    auth,
                    current_app.config["JWT_SECRET_KEY"],
                    algorithms=["HS256"],
                )
                client_id = payload.get("sub")
                if not client_id:
                    print("No client_id in token")
                    return False
            except jwt.InvalidTokenError as e:
                print(f"Invalid token: {str(e)}")
                return False

            # Store client info
            connected_clients[request.sid] = {
                "client_id": client_id,
                "connected_at": datetime.utcnow(),
                "subscriptions": set(),
            }

            print(f"Client {client_id} connected with sid {request.sid}")

            # Send connection established event with auth status
            emit(
                "connection_established",
                {
                    "client_id": client_id,
                    "is_authenticated": True,
                    "user_id": client_id,
                },
            )

            return True

        except Exception as e:
            current_app.logger.error(f"Error in handle_connect: {str(e)}")
            print(f"Connection error: {str(e)}")
            return False

    @socketio.on("disconnect")
    def handle_disconnect():
        """Handle client disconnection"""
        if request.sid in connected_clients:
            client_info = connected_clients[request.sid]
            print(f"Client {client_info['client_id']} disconnected")
            del connected_clients[request.sid]

    @socketio.on("error")
    def handle_error(error):
        """Handle Socket.IO errors"""
        print(f"Socket.IO error: {error}")
        current_app.logger.error(f"Socket.IO error: {error}")

    @socketio.on_error_default
    def default_error_handler(e):
        """Handle all other Socket.IO errors"""
        print(f"Unhandled Socket.IO error: {str(e)}")
        current_app.logger.error(f"Unhandled Socket.IO error: {str(e)}")

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
