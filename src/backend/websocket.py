# Import eventlet initialization module first
try:
    from src.backend.eventlet_init import eventlet
except ImportError:
    try:
        import eventlet

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
    cors_allowed_origins="*", async_mode="eventlet", logger=True, engineio_logger=True
)


def init_app(app, **kwargs):
    """Initialize SocketIO with the Flask app"""
    # Merge provided kwargs with default options
    options = {"cors_allowed_origins": "*", "async_mode": "eventlet"}
    options.update(kwargs)

    # Initialize the SocketIO instance with the app
    socketio.init_app(app, **options)
    return socketio


# Store connected clients
connected_clients = {}


@socketio.on("connect")
def handle_connect():
    """Handle client connection"""
    client_id = request.sid

    # Check for authentication token
    auth_token = request.args.get("token") if hasattr(request, "args") else None

    # Default to unauthenticated
    is_authenticated = False
    user_id = None

    # Validate token if provided
    if auth_token:
        try:
            # Get the JWT secret key from app config
            if current_app and hasattr(current_app, "config"):
                jwt_secret = current_app.config.get(
                    "JWT_SECRET_KEY", "default-secret-key"
                )

                # Decode and validate token
                payload = jwt.decode(auth_token, jwt_secret, algorithms=["HS256"])
                is_authenticated = True
                user_id = payload.get("user_id")

                if hasattr(current_app, "logger"):
                    current_app.logger.info(
                        f"Authenticated WebSocket connection from user {user_id}"
                    )
            else:
                if hasattr(current_app, "logger"):
                    current_app.logger.warning(
                        "Cannot authenticate WebSocket: Flask app context not available"
                    )
        except jwt.PyJWTError as e:
            if hasattr(current_app, "logger"):
                current_app.logger.warning(f"Invalid authentication token: {str(e)}")
        except Exception as e:
            if hasattr(current_app, "logger"):
                current_app.logger.error(f"Error authenticating WebSocket: {str(e)}")

    connected_clients[client_id] = {
        "connected_at": datetime.utcnow().isoformat(),
        "subscriptions": set(),
        "is_authenticated": is_authenticated,
        "user_id": user_id,
    }

    emit(
        "connection_established",
        {
            "client_id": client_id,
            "is_authenticated": is_authenticated,
            "user_id": user_id,
        },
    )


@socketio.on("disconnect")
def handle_disconnect():
    """Handle client disconnection"""
    client_id = request.sid
    if client_id in connected_clients:
        del connected_clients[client_id]


@socketio.on("subscribe")
def handle_subscribe(data):
    """Handle subscription to specific events"""
    client_id = request.sid
    event_type = data.get("event_type")

    if client_id in connected_clients and event_type:
        # Check if event requires authentication
        requires_auth = event_type in AUTHENTICATED_EVENTS
        is_authenticated = connected_clients[client_id].get("is_authenticated", False)

        if requires_auth and not is_authenticated:
            emit(
                "subscription_error",
                {
                    "event_type": event_type,
                    "message": f"Authentication required to subscribe to {event_type} events",
                    "code": "AUTH_REQUIRED",
                },
            )
            return

        connected_clients[client_id]["subscriptions"].add(event_type)
        emit(
            "subscription_confirmed",
            {
                "event_type": event_type,
                "message": f"Successfully subscribed to {event_type} events",
            },
        )


@socketio.on("unsubscribe")
def handle_unsubscribe(data):
    """Handle unsubscription from specific events"""
    client_id = request.sid
    event_type = data.get("event_type")

    if client_id in connected_clients and event_type:
        connected_clients[client_id]["subscriptions"].discard(event_type)
        emit(
            "unsubscription_confirmed",
            {
                "event_type": event_type,
                "message": f"Successfully unsubscribed from {event_type} events",
            },
        )


def broadcast_event(event_type, data):
    """Broadcast event to all subscribed clients"""
    # Check if this event type requires authentication
    requires_auth = event_type in AUTHENTICATED_EVENTS

    for client_id, client_info in connected_clients.items():
        if event_type in client_info["subscriptions"]:
            # For authenticated events, check if the client is authenticated
            if requires_auth and not client_info.get("is_authenticated", False):
                continue

            emit(event_type, data, room=client_id)


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
