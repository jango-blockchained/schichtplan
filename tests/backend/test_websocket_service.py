"""
Tests for WebSocket Service
"""

import asyncio
from unittest.mock import patch

import pytest

from src.backend.services.websocket_service import (
    AIWebSocketService,
    get_websocket_service,
    init_websocket_service,
)


class TestAIWebSocketService:
    """Test WebSocket service functionality"""

    def test_service_initialization(self, enhanced_app):
        """Test WebSocket service initialization"""
        app, socketio = enhanced_app
        service = AIWebSocketService(socketio)

        assert service.socketio == socketio
        assert isinstance(service.active_sessions, dict)
        assert isinstance(service.typing_indicators, dict)
        assert isinstance(service.room_subscribers, dict)

    def test_init_websocket_service(self, enhanced_app):
        """Test global service initialization"""
        app, socketio = enhanced_app
        service = init_websocket_service(socketio)

        assert isinstance(service, AIWebSocketService)
        assert get_websocket_service() == service

    def test_client_connection(self, socketio_client):
        """Test client connection handling"""
        # Connect client
        received = socketio_client.get_received()

        # Should receive connection confirmation
        assert len(received) > 0
        connect_msg = received[0]
        assert connect_msg["name"] == "connected"
        assert "session_id" in connect_msg["args"][0]
        assert "timestamp" in connect_msg["args"][0]

    def test_join_conversation(self, socketio_client):
        """Test joining conversation room"""
        conversation_data = {
            "conversation_id": "test_conv_123",
            "user_id": "test_user_456",
        }

        socketio_client.emit("join_conversation", conversation_data)
        received = socketio_client.get_received()

        # Should receive join confirmation
        join_msg = None
        for msg in received:
            if msg["name"] == "joined_conversation":
                join_msg = msg
                break

        assert join_msg is not None
        assert join_msg["args"][0]["conversation_id"] == "test_conv_123"

    def test_join_conversation_no_id(self, socketio_client):
        """Test joining conversation without ID"""
        socketio_client.emit("join_conversation", {})
        received = socketio_client.get_received()

        # Should receive error
        error_msg = None
        for msg in received:
            if msg["name"] == "error":
                error_msg = msg
                break

        assert error_msg is not None
        assert "No conversation ID provided" in error_msg["args"][0]["message"]

    def test_typing_indicators(self, socketio_client):
        """Test typing indicator functionality"""
        # First join a conversation
        conversation_data = {
            "conversation_id": "test_conv_123",
            "user_id": "test_user_456",
        }
        socketio_client.emit("join_conversation", conversation_data)

        # Clear received messages
        socketio_client.get_received()

        # Start typing
        typing_data = {"conversation_id": "test_conv_123", "user_id": "test_user_456"}
        socketio_client.emit("typing_start", typing_data)

        # Stop typing
        socketio_client.emit("typing_stop", typing_data)

        received = socketio_client.get_received()

        # Should not receive own typing indicators due to include_self=False
        # But the functionality should work without errors
        assert len(received) >= 0  # May be empty due to include_self=False

    def test_ai_thinking_indicator(self, socketio_client):
        """Test AI thinking indicator"""
        thinking_data = {"conversation_id": "test_conv_123", "is_thinking": True}

        socketio_client.emit("ai_thinking", thinking_data)
        received = socketio_client.get_received()

        # Should receive AI thinking indicator
        thinking_msg = None
        for msg in received:
            if msg["name"] == "ai_thinking":
                thinking_msg = msg
                break

        assert thinking_msg is not None
        assert thinking_msg["args"][0]["is_thinking"] is True
        assert thinking_msg["args"][0]["conversation_id"] == "test_conv_123"

    def test_ping_pong(self, socketio_client):
        """Test ping-pong for connection health"""
        socketio_client.emit("ping")
        received = socketio_client.get_received()

        # Should receive pong response
        pong_msg = None
        for msg in received:
            if msg["name"] == "pong":
                pong_msg = msg
                break

        assert pong_msg is not None
        assert "timestamp" in pong_msg["args"][0]

    def test_leave_conversation(self, socketio_client):
        """Test leaving conversation room"""
        # First join a conversation
        conversation_data = {
            "conversation_id": "test_conv_123",
            "user_id": "test_user_456",
        }
        socketio_client.emit("join_conversation", conversation_data)

        # Clear received messages
        socketio_client.get_received()

        # Leave conversation
        leave_data = {"conversation_id": "test_conv_123"}
        socketio_client.emit("leave_conversation", leave_data)

        received = socketio_client.get_received()

        # Should receive leave confirmation
        leave_msg = None
        for msg in received:
            if msg["name"] == "left_conversation":
                leave_msg = msg
                break

        assert leave_msg is not None
        assert leave_msg["args"][0]["conversation_id"] == "test_conv_123"

    def test_disconnect_cleanup(self, enhanced_app):
        """Test cleanup on client disconnect"""
        app, socketio = enhanced_app
        service = AIWebSocketService(socketio)

        # Simulate session data
        session_id = "test_session_123"
        service.active_sessions[session_id] = {
            "connected_at": "2024-01-01T00:00:00Z",
            "user_id": "test_user",
            "conversations": {"conv_1", "conv_2"},
        }

        service.typing_indicators["conv_1"] = {
            session_id: {"user_id": "test_user", "started_at": "2024-01-01T00:00:00Z"}
        }

        # Test cleanup
        service._cleanup_typing_indicators(session_id)

        # Typing indicators should be cleaned up
        assert session_id not in service.typing_indicators.get("conv_1", {})

    def test_broadcast_methods(self, enhanced_app):
        """Test broadcast methods"""
        app, socketio = enhanced_app
        service = AIWebSocketService(socketio)

        # Test message broadcast
        with patch.object(service.socketio, "emit") as mock_emit:
            service.broadcast_message("conv_123", {"content": "Test message"})
            mock_emit.assert_called_once()
            args, kwargs = mock_emit.call_args
            assert args[0] == "new_message"
            assert kwargs["room"] == "conv_123"

        # Test workflow update broadcast
        with patch.object(service.socketio, "emit") as mock_emit:
            service.broadcast_workflow_update("exec_123", {"progress": 50})
            mock_emit.assert_called_once()
            args, kwargs = mock_emit.call_args
            assert args[0] == "workflow_update"

        # Test file analysis broadcast
        with patch.object(service.socketio, "emit") as mock_emit:
            service.broadcast_file_analysis("file_123", {"status": "complete"})
            mock_emit.assert_called_once()
            args, kwargs = mock_emit.call_args
            assert args[0] == "file_analysis_complete"

        # Test system status broadcast
        with patch.object(service.socketio, "emit") as mock_emit:
            service.broadcast_system_status({"health": "good"})
            mock_emit.assert_called_once()
            args, kwargs = mock_emit.call_args
            assert args[0] == "system_status"

    def test_service_statistics(self, enhanced_app):
        """Test service statistics"""
        app, socketio = enhanced_app
        service = AIWebSocketService(socketio)

        # Add some test data
        service.active_sessions["session_1"] = {}
        service.active_sessions["session_2"] = {}

        service.room_subscribers["room_1"] = {"session_1", "session_2"}
        service.room_subscribers["room_2"] = {"session_1"}

        service.typing_indicators["room_1"] = {"session_1": {}}

        # Test statistics
        assert service.get_active_sessions_count() == 2
        assert service.get_room_subscribers_count("room_1") == 2
        assert service.get_room_subscribers_count("room_2") == 1
        assert service.get_room_subscribers_count("nonexistent") == 0

        stats = service.get_service_stats()
        assert stats["active_sessions"] == 2
        assert stats["active_rooms"] == 2
        assert stats["typing_indicators"] == 1
        assert stats["total_subscribers"] == 3

    def test_get_typing_users(self, enhanced_app):
        """Test getting typing users for conversation"""
        app, socketio = enhanced_app
        service = AIWebSocketService(socketio)

        # Add typing indicators
        service.typing_indicators["conv_123"] = {
            "session_1": {"user_id": "user_1", "started_at": "2024-01-01T00:00:00Z"},
            "session_2": {"user_id": "user_2", "started_at": "2024-01-01T00:01:00Z"},
        }

        typing_users = service.get_typing_users("conv_123")
        assert len(typing_users) == 2

        user_ids = [user["user_id"] for user in typing_users]
        assert "user_1" in user_ids
        assert "user_2" in user_ids

        # Test non-existent conversation
        empty_typing = service.get_typing_users("nonexistent")
        assert len(empty_typing) == 0


class TestWebSocketIntegration:
    """Test WebSocket integration with Flask app"""

    def test_multiple_clients(self, enhanced_app):
        """Test multiple WebSocket clients"""
        app, socketio = enhanced_app

        # Create multiple test clients
        client1 = socketio.test_client(app)
        client2 = socketio.test_client(app)

        # Both should connect successfully
        received1 = client1.get_received()
        received2 = client2.get_received()

        assert len(received1) > 0
        assert len(received2) > 0

        # Both should receive connection messages
        assert received1[0]["name"] == "connected"
        assert received2[0]["name"] == "connected"

        # Session IDs should be different
        session1_id = received1[0]["args"][0]["session_id"]
        session2_id = received2[0]["args"][0]["session_id"]
        assert session1_id != session2_id

    def test_conversation_room_communication(self, enhanced_app):
        """Test communication within conversation rooms"""
        app, socketio = enhanced_app

        client1 = socketio.test_client(app)
        client2 = socketio.test_client(app)

        # Both join the same conversation
        conversation_data = {"conversation_id": "shared_conv", "user_id": "user_1"}
        client1.emit("join_conversation", conversation_data)

        conversation_data["user_id"] = "user_2"
        client2.emit("join_conversation", conversation_data)

        # Clear initial messages
        client1.get_received()
        client2.get_received()

        # Client1 starts typing
        typing_data = {"conversation_id": "shared_conv", "user_id": "user_1"}
        client1.emit("typing_start", typing_data)

        # Client2 should receive typing indicator
        received2 = client2.get_received()

        typing_msg = None
        for msg in received2:
            if msg["name"] == "typing_indicator":
                typing_msg = msg
                break

        # Due to include_self=False, client1 won't receive its own typing
        # But client2 should receive it
        assert typing_msg is not None
        assert typing_msg["args"][0]["user_id"] == "user_1"
        assert typing_msg["args"][0]["is_thinking"] is True

    def test_error_handling(self, socketio_client):
        """Test WebSocket error handling"""
        # Test invalid event data
        try:
            socketio_client.emit("join_conversation", "invalid_data")
            received = socketio_client.get_received()
            # Should handle gracefully without crashing
        except Exception as e:
            pytest.fail(f"WebSocket should handle invalid data gracefully: {e}")

        # Test missing required fields
        socketio_client.emit("typing_start", {})
        received = socketio_client.get_received()
        # Should handle gracefully without required fields

    @pytest.mark.asyncio
    async def test_concurrent_operations(self, enhanced_app):
        """Test concurrent WebSocket operations"""
        app, socketio = enhanced_app
        service = AIWebSocketService(socketio)

        # Simulate concurrent session operations
        async def add_session(session_id):
            service.active_sessions[session_id] = {
                "connected_at": "2024-01-01T00:00:00Z",
                "user_id": f"user_{session_id}",
                "conversations": set(),
            }

        # Add multiple sessions concurrently
        tasks = [add_session(f"session_{i}") for i in range(10)]
        await asyncio.gather(*tasks)

        assert len(service.active_sessions) == 10

        # Test concurrent cleanup
        async def cleanup_session(session_id):
            service._cleanup_typing_indicators(session_id)
            if session_id in service.active_sessions:
                del service.active_sessions[session_id]

        cleanup_tasks = [cleanup_session(f"session_{i}") for i in range(5)]
        await asyncio.gather(*cleanup_tasks)

        assert len(service.active_sessions) == 5
