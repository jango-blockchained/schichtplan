"""
WebSocket Service for real-time AI features (Socket.IO)
"""
# pylint: disable=broad-except

import logging
from datetime import datetime
from typing import Any, cast

from flask import request as flask_request
from flask_socketio import (  # type: ignore[import-untyped]
    SocketIO,
    emit,
    join_room,
    leave_room,
)

logger = logging.getLogger(__name__)


class AIWebSocketService:
    """WebSocket service for real-time AI features"""

    def __init__(self, socketio: SocketIO):
        self.socketio = socketio
        self.active_sessions: dict[str, dict] = {}
        self.typing_indicators: dict[str, dict] = {}
        self.room_subscribers: dict[str, set[str]] = {}

        # Register event handlers
        self._register_handlers()

    def _register_handlers(self) -> None:
        """Register WebSocket event handlers"""
        socketio = self.socketio

        @socketio.on("connect")
        def handle_connect():
            """Handle client connection"""
            try:
                # Use Flask's request object in Socket.IO handlers
                session_id = cast(Any, flask_request).sid
                logger.info("Client connected: %s", session_id)

                # Initialize session
                self.active_sessions[session_id] = {
                    "connected_at": datetime.now().isoformat(),
                    "user_id": None,
                    "conversations": set(),
                }

                emit(
                    "connected",
                    {
                        "session_id": session_id,
                        "timestamp": datetime.now().isoformat(),
                    },
                )
            except Exception as e:  # noqa: BLE001
                # pylint: disable=broad-except
                logger.error("Connection error: %s", str(e))

        @socketio.on("disconnect")
        def handle_disconnect():
            """Handle client disconnection"""
            try:
                session_id = cast(Any, flask_request).sid
                logger.info("Client disconnected: %s", session_id)

                # Clean up session data
                if session_id in self.active_sessions:
                    session = self.active_sessions[session_id]

                    # Leave all conversation rooms
                    for conv_id in session.get("conversations", set()):
                        self._leave_conversation(session_id, conv_id)

                    # Remove session
                    del self.active_sessions[session_id]

                # Clean up typing indicators
                self._cleanup_typing_indicators(session_id)
            except Exception as e:  # noqa: BLE001
                # pylint: disable=broad-except
                logger.error("Disconnection error: %s", str(e))

        @socketio.on("join_conversation")
        def handle_join_conversation(data):
            """Handle joining a conversation room"""
            try:
                session_id = cast(Any, flask_request).sid
                conversation_id = data.get("conversation_id")
                user_id = data.get("user_id", "anonymous")

                if not conversation_id:
                    emit("error", {"message": "No conversation ID provided"})
                    return

                # Join room
                join_room(conversation_id)

                # Update session
                if session_id in self.active_sessions:
                    self.active_sessions[session_id]["user_id"] = user_id
                    self.active_sessions[session_id]["conversations"].add(
                        conversation_id
                    )

                # Track room subscribers
                if conversation_id not in self.room_subscribers:
                    self.room_subscribers[conversation_id] = set()
                self.room_subscribers[conversation_id].add(session_id)

                emit(
                    "joined_conversation",
                    {
                        "conversation_id": conversation_id,
                        "timestamp": datetime.now().isoformat(),
                    },
                )

                # Notify others in room
                emit(
                    "user_joined",
                    {
                        "user_id": user_id,
                        "conversation_id": conversation_id,
                        "timestamp": datetime.now().isoformat(),
                    },
                    to=conversation_id,
                    include_self=False,
                )
            except Exception as e:  # noqa: BLE001
                # pylint: disable=broad-except
                logger.error("Join conversation error: %s", str(e))
                emit("error", {"message": str(e)})

        @socketio.on("leave_conversation")
        def handle_leave_conversation(data):
            """Handle leaving a conversation room"""
            try:
                session_id = cast(Any, flask_request).sid
                conversation_id = data.get("conversation_id")

                if conversation_id:
                    self._leave_conversation(session_id, conversation_id)
            except Exception as e:  # noqa: BLE001
                # pylint: disable=broad-except
                logger.error("Leave conversation error: %s", str(e))
                emit("error", {"message": str(e)})

        @socketio.on("typing_start")
        def handle_typing_start(data):
            """Handle typing start event"""
            try:
                session_id = cast(Any, flask_request).sid
                conversation_id = data.get("conversation_id")
                user_id = data.get("user_id", "anonymous")

                if not conversation_id:
                    return

                # Track typing indicator
                if conversation_id not in self.typing_indicators:
                    self.typing_indicators[conversation_id] = {}

                self.typing_indicators[conversation_id][session_id] = {
                    "user_id": user_id,
                    "started_at": datetime.now().isoformat(),
                }

                # Broadcast to room
                emit(
                    "typing_indicator",
                    {
                        "user_id": user_id,
                        "conversation_id": conversation_id,
                        "is_typing": True,
                        "is_thinking": True,  # backward compat
                        "timestamp": datetime.now().isoformat(),
                    },
                    to=conversation_id,
                    include_self=False,
                )
            except Exception as e:  # noqa: BLE001
                # pylint: disable=broad-except
                logger.error("Typing start error: %s", str(e))

        @socketio.on("typing_stop")
        def handle_typing_stop(data):
            """Handle typing stop event"""
            try:
                session_id = cast(Any, flask_request).sid
                conversation_id = data.get("conversation_id")
                user_id = data.get("user_id", "anonymous")

                if not conversation_id:
                    return

                # Remove typing indicator
                if (
                    conversation_id in self.typing_indicators
                    and session_id in self.typing_indicators[conversation_id]
                ):
                    del self.typing_indicators[conversation_id][session_id]

                    if not self.typing_indicators[conversation_id]:
                        del self.typing_indicators[conversation_id]

                # Broadcast to room
                emit(
                    "typing_indicator",
                    {
                        "user_id": user_id,
                        "conversation_id": conversation_id,
                        "is_typing": False,
                        "is_thinking": False,  # backward compat
                        "timestamp": datetime.now().isoformat(),
                    },
                    to=conversation_id,
                    include_self=False,
                )
            except Exception as e:  # noqa: BLE001
                # pylint: disable=broad-except
                logger.error("Typing stop error: %s", str(e))

        @socketio.on("ai_thinking")
        def handle_ai_thinking(data):
            """Handle AI thinking indicator"""
            try:
                conversation_id = data.get("conversation_id")
                is_thinking = data.get("is_thinking", False)

                if conversation_id:
                    emit(
                        "ai_thinking",
                        {
                            "conversation_id": conversation_id,
                            "is_thinking": is_thinking,
                            "timestamp": datetime.now().isoformat(),
                        },
                        to=conversation_id,
                    )
            except Exception as e:  # noqa: BLE001
                # pylint: disable=broad-except
                logger.error("AI thinking error: %s", str(e))

        @socketio.on("ping")
        def handle_ping():
            """Handle ping for connection keep-alive"""
            emit("pong", {"timestamp": datetime.now().isoformat()})

    def _leave_conversation(self, session_id: str, conversation_id: str) -> None:
        """Helper to leave a conversation room"""
        try:
            leave_room(conversation_id)

            # Update session
            if session_id in self.active_sessions:
                self.active_sessions[session_id]["conversations"].discard(
                    conversation_id
                )

            # Update room subscribers
            if conversation_id in self.room_subscribers:
                self.room_subscribers[conversation_id].discard(session_id)
                if not self.room_subscribers[conversation_id]:
                    del self.room_subscribers[conversation_id]

            # Clean up typing indicators
            if (
                conversation_id in self.typing_indicators
                and session_id in self.typing_indicators[conversation_id]
            ):
                del self.typing_indicators[conversation_id][session_id]
                if not self.typing_indicators[conversation_id]:
                    del self.typing_indicators[conversation_id]

            emit(
                "left_conversation",
                {
                    "conversation_id": conversation_id,
                    "timestamp": datetime.now().isoformat(),
                },
            )

            # Notify others in room
            user_id = None
            if session_id in self.active_sessions:
                user_id = self.active_sessions[session_id].get("user_id")

            if user_id:
                emit(
                    "user_left",
                    {
                        "user_id": user_id,
                        "conversation_id": conversation_id,
                        "timestamp": datetime.now().isoformat(),
                    },
                    to=conversation_id,
                )
        except Exception as e:  # noqa: BLE001
            # pylint: disable=broad-except
            logger.error("Leave conversation helper error: %s", str(e))

    def _cleanup_typing_indicators(self, session_id: str) -> None:
        """Clean up typing indicators for disconnected session"""
        try:
            conversations_to_clean = []

            for conv_id, indicators in list(self.typing_indicators.items()):
                if session_id in indicators:
                    user_id = indicators[session_id].get("user_id")
                    del indicators[session_id]

                    # Notify room that user stopped typing
                    if user_id:
                        emit(
                            "typing_indicator",
                            {
                                "user_id": user_id,
                                "conversation_id": conv_id,
                                "is_typing": False,
                                "is_thinking": False,  # backward compat
                                "timestamp": datetime.now().isoformat(),
                            },
                            to=conv_id,
                        )

                    if not indicators:
                        conversations_to_clean.append(conv_id)

            # Clean up empty typing indicator entries
            for conv_id in conversations_to_clean:
                del self.typing_indicators[conv_id]
        except Exception as e:  # noqa: BLE001
            # pylint: disable=broad-except
            logger.error("Cleanup typing indicators error: %s", str(e))

    def broadcast_message(self, conversation_id: str, message_data: dict) -> None:
        """Broadcast new message to conversation room"""
        try:
            self.socketio.emit(
                "new_message",
                {
                    "conversation_id": conversation_id,
                    "message": message_data,
                    "timestamp": datetime.now().isoformat(),
                },
                to=conversation_id,
            )
        except Exception as e:  # noqa: BLE001
            # pylint: disable=broad-except
            logger.error("Broadcast message error: %s", str(e))

    def broadcast_workflow_update(self, execution_id: str, update_data: dict) -> None:
        """Broadcast workflow execution update"""
        try:
            self.socketio.emit(
                "workflow_update",
                {
                    "execution_id": execution_id,
                    "update": update_data,
                    "timestamp": datetime.now().isoformat(),
                },
            )
        except Exception as e:  # noqa: BLE001
            # pylint: disable=broad-except
            logger.error("Broadcast workflow update error: %s", str(e))

    def broadcast_file_analysis(self, file_id: str, analysis_data: dict) -> None:
        """Broadcast file analysis completion"""
        try:
            self.socketio.emit(
                "file_analysis_complete",
                {
                    "file_id": file_id,
                    "analysis": analysis_data,
                    "timestamp": datetime.now().isoformat(),
                },
            )
        except Exception as e:  # noqa: BLE001
            # pylint: disable=broad-except
            logger.error("Broadcast file analysis error: %s", str(e))

    def broadcast_system_status(self, status_data: dict) -> None:
        """Broadcast system status update"""
        try:
            self.socketio.emit(
                "system_status",
                {
                    "status": status_data,
                    "timestamp": datetime.now().isoformat(),
                },
            )
        except Exception as e:  # noqa: BLE001
            # pylint: disable=broad-except
            logger.error("Broadcast system status error: %s", str(e))

    def get_active_sessions_count(self) -> int:
        """Get count of active sessions"""
        return len(self.active_sessions)

    def get_room_subscribers_count(self, conversation_id: str) -> int:
        """Get count of subscribers in a conversation room"""
        return len(self.room_subscribers.get(conversation_id, set()))

    def get_typing_users(self, conversation_id: str) -> list:
        """Get list of users currently typing in conversation"""
        if conversation_id not in self.typing_indicators:
            return []

        typing_users = []
        for indicator in self.typing_indicators[conversation_id].values():
            typing_users.append(
                {
                    "user_id": indicator["user_id"],
                    "started_at": indicator["started_at"],
                }
            )
        return typing_users

    def get_service_stats(self) -> dict:
        """Get WebSocket service statistics"""
        return {
            "active_sessions": len(self.active_sessions),
            "active_rooms": len(self.room_subscribers),
            "typing_indicators": sum(
                len(indicators) for indicators in self.typing_indicators.values()
            ),
            "total_subscribers": sum(
                len(subs) for subs in self.room_subscribers.values()
            ),
        }


# Global WebSocket service instance
ws_service: AIWebSocketService | None = None


def init_websocket_service(socketio: SocketIO) -> AIWebSocketService:
    """Initialize WebSocket service"""
    global ws_service  # pylint: disable=global-statement
    ws_service = AIWebSocketService(socketio)
    return ws_service


def get_websocket_service() -> AIWebSocketService | None:
    """Get WebSocket service instance"""
    return ws_service
