from flask_socketio import SocketIO, emit
from flask import request
from datetime import datetime

socketio = SocketIO(cors_allowed_origins="*")

# Store connected clients
connected_clients = {}


@socketio.on("connect")
def handle_connect():
    """Handle client connection"""
    client_id = request.sid
    connected_clients[client_id] = {
        "connected_at": datetime.utcnow().isoformat(),
        "subscriptions": set(),
    }
    emit("connection_established", {"client_id": client_id})


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
    for client_id, client_info in connected_clients.items():
        if event_type in client_info["subscriptions"]:
            emit(event_type, data, room=client_id)


# Event types
SCHEDULE_UPDATED = "schedule_updated"
AVAILABILITY_UPDATED = "availability_updated"
ABSENCE_UPDATED = "absence_updated"
SETTINGS_UPDATED = "settings_updated"
