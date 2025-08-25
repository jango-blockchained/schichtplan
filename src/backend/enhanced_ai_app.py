"""
Enhanced AI App Integration
Demonstrates how to integrate all AI enhancement components
"""

from flask import Flask
from flask_cors import CORS
from flask_socketio import SocketIO

from src.backend.routes.enhanced_ai_routes import (
    enhanced_ai_bp,
    init_enhanced_ai_services,
)
from src.backend.services.websocket_service import init_websocket_service


def create_enhanced_ai_app(config=None):
    """Create Flask app with enhanced AI features"""

    # Create Flask app
    app = Flask(__name__)

    # Apply configuration
    if config:
        app.config.from_object(config)

    # Enable CORS
    CORS(app, origins="*", supports_credentials=True)

    # Initialize SocketIO
    socketio = SocketIO(
        app,
        cors_allowed_origins="*",
        async_mode="threading",
        ping_timeout=60,
        ping_interval=25,
    )

    # Initialize enhanced AI services
    init_enhanced_ai_services(app, socketio)

    # Initialize WebSocket service
    init_websocket_service(socketio)

    # Register enhanced AI blueprint
    app.register_blueprint(enhanced_ai_bp)

    # Add health check endpoint
    @app.route("/health")
    def health_check():
        return {
            "status": "healthy",
            "features": [
                "voice_recognition",
                "file_upload",
                "real_time_features",
                "workflow_execution",
                "enhanced_mcp",
            ],
        }

    return app, socketio


# Usage example for running the enhanced AI server
if __name__ == "__main__":
    app, socketio = create_enhanced_ai_app()

    print("🚀 Starting Enhanced AI Server with:")
    print("   • Voice Recognition")
    print("   • File Upload & Analysis")
    print("   • Real-time WebSocket Features")
    print("   • Workflow Execution")
    print("   • Enhanced MCP Integration")
    print("\n🌐 Available at: http://localhost:5000")
    print("📡 WebSocket endpoint: ws://localhost:5000/socket.io/")

    socketio.run(app, host="0.0.0.0", port=5000, debug=True, allow_unsafe_werkzeug=True)
