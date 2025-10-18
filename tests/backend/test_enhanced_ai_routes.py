"""
Tests for Enhanced AI Routes
"""

import json
from io import BytesIO
from unittest.mock import Mock, patch


class TestVoiceEndpoints:
    """Test voice processing endpoints"""

    def test_process_voice_command_success(
        self, enhanced_client, sample_audio_file, mock_speech_recognition
    ):
        """Test successful voice command processing"""
        client, socketio = enhanced_client

        # Mock successful speech recognition
        mock_speech_recognition.recognize_google.return_value = (
            "Optimiere den Schichtplan"
        )

        with open(sample_audio_file, "rb") as audio_file:
            response = client.post(
                "/api/v2/voice/command",
                data={"audio": (audio_file, "test.wav")},
                content_type="multipart/form-data",
            )

        assert response.status_code == 200
        data = json.loads(response.data)

        assert "transcript" in data
        assert "confidence" in data
        assert "timestamp" in data
        assert data["transcript"] == "Optimiere den Schichtplan"
        assert data["action"] == "optimize_schedule"

    def test_process_voice_command_no_audio(self, enhanced_client):
        """Test voice command without audio file"""
        client, socketio = enhanced_client

        response = client.post("/api/v2/voice/command", data={})

        assert response.status_code == 400
        data = json.loads(response.data)
        assert "error" in data
        assert "No audio file provided" in data["error"]

    def test_process_voice_command_recognition_failure(
        self, enhanced_client, sample_audio_file
    ):
        """Test voice command with recognition failure"""
        client, socketio = enhanced_client

        with patch("speech_recognition.Recognizer") as mock_recognizer:
            mock_instance = Mock()
            mock_recognizer.return_value = mock_instance
            mock_instance.recognize_google.side_effect = Exception("Recognition failed")
            mock_instance.recognize_sphinx.side_effect = Exception("Sphinx failed")

            with open(sample_audio_file, "rb") as audio_file:
                response = client.post(
                    "/api/v2/voice/command",
                    data={"audio": (audio_file, "test.wav")},
                    content_type="multipart/form-data",
                )

        assert response.status_code == 400
        data = json.loads(response.data)
        assert "error" in data
        assert "Could not recognize speech" in data["error"]

    def test_enable_voice_recognition(self, enhanced_client):
        """Test enabling voice recognition"""
        client, socketio = enhanced_client

        response = client.post("/api/v2/voice/enable")

        assert response.status_code == 200
        data = json.loads(response.data)

        assert data["success"] is True
        assert "message" in data
        assert "supported_languages" in data
        assert "engines" in data
        assert "de-DE" in data["supported_languages"]


class TestFileEndpoints:
    """Test file upload and analysis endpoints"""

    def test_upload_file_success(self, enhanced_client, sample_csv_file):
        """Test successful file upload"""
        client, socketio = enhanced_client

        with open(sample_csv_file, "rb") as csv_file:
            response = client.post(
                "/api/v2/files/upload",
                data={"file": (csv_file, "test.csv")},
                content_type="multipart/form-data",
            )

        assert response.status_code == 200
        data = json.loads(response.data)

        assert "id" in data
        assert "name" in data
        assert "type" in data
        assert "size" in data
        assert "upload_time" in data
        assert data["name"] == "test.csv"
        assert data["processed"] is False

    def test_upload_file_no_file(self, enhanced_client):
        """Test file upload without file"""
        client, socketio = enhanced_client

        response = client.post("/api/v2/files/upload", data={})

        assert response.status_code == 400
        data = json.loads(response.data)
        assert "error" in data
        assert "No file provided" in data["error"]

    def test_upload_file_invalid_type(self, enhanced_client):
        """Test file upload with invalid file type"""
        client, socketio = enhanced_client

        # Create a fake executable file
        fake_file = BytesIO(b"fake executable content")

        response = client.post(
            "/api/v2/files/upload",
            data={"file": (fake_file, "malware.exe")},
            content_type="multipart/form-data",
        )

        assert response.status_code == 400
        data = json.loads(response.data)
        assert "error" in data
        assert "File type not allowed" in data["error"]

    def test_analyze_file_success(self, enhanced_client):
        """Test successful file analysis"""
        client, socketio = enhanced_client

        response = client.post("/api/v2/files/test_file_123/analyze")

        assert response.status_code == 200
        data = json.loads(response.data)

        assert "analysis" in data
        analysis = data["analysis"]
        assert "summary" in analysis
        assert "insights" in analysis
        assert "recommendations" in analysis
        assert isinstance(analysis["insights"], list)
        assert isinstance(analysis["recommendations"], list)

    def test_get_uploaded_files(self, enhanced_client):
        """Test getting list of uploaded files"""
        client, socketio = enhanced_client

        response = client.get("/api/v2/files")

        assert response.status_code == 200
        data = json.loads(response.data)

        assert isinstance(data, list)
        if data:  # If there are files in the response
            file_data = data[0]
            assert "id" in file_data
            assert "name" in file_data
            assert "type" in file_data
            assert "size" in file_data
            assert "processed" in file_data
            assert "upload_time" in file_data


class TestWorkflowEndpoints:
    """Test workflow execution endpoints"""

    def test_create_workflow(self, enhanced_client, sample_workflow_data):
        """Test creating workflow template"""
        client, socketio = enhanced_client

        response = client.post(
            "/api/v2/workflows/templates",
            json=sample_workflow_data,
            content_type="application/json",
        )

        assert response.status_code == 200
        data = json.loads(response.data)

        assert "id" in data
        assert data["name"] == sample_workflow_data["name"]
        assert data["description"] == sample_workflow_data["description"]
        assert data["category"] == sample_workflow_data["category"]
        assert "created_at" in data

    def test_get_workflow_steps(self, enhanced_client):
        """Test getting workflow execution steps"""
        client, socketio = enhanced_client
        execution_id = "test_execution_123"

        response = client.get(f"/api/v2/workflows/executions/{execution_id}/steps")

        assert response.status_code == 200
        data = json.loads(response.data)

        assert isinstance(data, list)
        if data:  # If there are steps in the response
            step = data[0]
            assert "id" in step
            assert "name" in step
            assert "status" in step
            assert "progress" in step

    def test_pause_workflow(self, enhanced_client, mock_websocket_service):
        """Test pausing workflow execution"""
        client, socketio = enhanced_client
        execution_id = "test_execution_123"

        response = client.post(f"/api/v2/workflows/executions/{execution_id}/pause")

        assert response.status_code == 200
        data = json.loads(response.data)
        assert data["success"] is True
        assert "message" in data

    def test_resume_workflow(self, enhanced_client, mock_websocket_service):
        """Test resuming workflow execution"""
        client, socketio = enhanced_client
        execution_id = "test_execution_123"

        response = client.post(f"/api/v2/workflows/executions/{execution_id}/resume")

        assert response.status_code == 200
        data = json.loads(response.data)
        assert data["success"] is True
        assert "message" in data

    def test_cancel_workflow(self, enhanced_client, mock_websocket_service):
        """Test canceling workflow execution"""
        client, socketio = enhanced_client
        execution_id = "test_execution_123"

        response = client.post(f"/api/v2/workflows/executions/{execution_id}/cancel")

        assert response.status_code == 200
        data = json.loads(response.data)
        assert data["success"] is True
        assert "message" in data


class TestMCPToolEndpoints:
    """Test enhanced MCP tool endpoints"""

    def test_get_tool_categories(self, enhanced_client):
        """Test getting MCP tool categories"""
        client, socketio = enhanced_client

        response = client.get("/api/v2/tools/categories")

        assert response.status_code == 200
        data = json.loads(response.data)

        assert isinstance(data, list)
        expected_categories = [
            "schedule_optimization",
            "data_analysis",
            "employee_management",
            "reporting",
            "automation",
            "utilities",
        ]
        for category in expected_categories:
            assert category in data

    def test_search_tools_no_filters(self, enhanced_client):
        """Test searching tools without filters"""
        client, socketio = enhanced_client

        response = client.get("/api/v2/tools/search")

        assert response.status_code == 200
        data = json.loads(response.data)

        assert isinstance(data, list)
        if data:  # If there are tools in the response
            tool = data[0]
            assert "id" in tool
            assert "name" in tool
            assert "description" in tool
            assert "category" in tool
            assert "status" in tool

    def test_search_tools_with_query(self, enhanced_client):
        """Test searching tools with query"""
        client, socketio = enhanced_client

        response = client.get("/api/v2/tools/search?query=optimize")

        assert response.status_code == 200
        data = json.loads(response.data)

        assert isinstance(data, list)
        # Should filter results based on query

    def test_search_tools_with_category(self, enhanced_client):
        """Test searching tools with category filter"""
        client, socketio = enhanced_client

        response = client.get("/api/v2/tools/search?category=schedule_optimization")

        assert response.status_code == 200
        data = json.loads(response.data)

        assert isinstance(data, list)
        # Should filter results based on category


class TestAnalyticsEndpoints:
    """Test analytics endpoints"""

    def test_get_detailed_analytics(self, enhanced_client):
        """Test getting detailed analytics"""
        client, socketio = enhanced_client

        response = client.get("/api/v2/analytics/detailed")

        assert response.status_code == 200
        data = json.loads(response.data)

        assert "performance" in data
        assert "usage" in data
        assert "trends" in data

        # Check performance metrics
        performance = data["performance"]
        assert "response_times" in performance
        assert "success_rates" in performance
        assert "error_rates" in performance

        # Check usage metrics
        usage = data["usage"]
        assert "peak_hours" in usage
        assert "user_activity" in usage
        assert "feature_usage" in usage

    def test_get_detailed_analytics_with_timeframe(self, enhanced_client):
        """Test getting detailed analytics with timeframe"""
        client, socketio = enhanced_client

        response = client.get("/api/v2/analytics/detailed?timeframe=30d")

        assert response.status_code == 200
        data = json.loads(response.data)

        assert "performance" in data
        assert "usage" in data
        assert "trends" in data


class TestProviderTestingEndpoints:
    """Test AI provider testing endpoints"""

    def test_test_openai_provider(self, enhanced_client):
        """Test OpenAI provider connection"""
        client, socketio = enhanced_client

        response = client.post("/api/v2/providers/openai/test")

        assert response.status_code == 200
        data = json.loads(response.data)

        assert "success" in data
        assert "response_time" in data
        assert isinstance(data["response_time"], (int, float))

    def test_test_anthropic_provider(self, enhanced_client):
        """Test Anthropic provider connection"""
        client, socketio = enhanced_client

        response = client.post("/api/v2/providers/anthropic/test")

        assert response.status_code == 200
        data = json.loads(response.data)

        assert "success" in data
        assert "response_time" in data

    def test_test_gemini_provider(self, enhanced_client):
        """Test Gemini provider connection"""
        client, socketio = enhanced_client

        response = client.post("/api/v2/providers/gemini/test")

        assert response.status_code == 200
        data = json.loads(response.data)

        assert "success" in data
        assert "response_time" in data

    def test_test_unknown_provider(self, enhanced_client):
        """Test unknown provider"""
        client, socketio = enhanced_client

        response = client.post("/api/v2/providers/unknown/test")

        assert response.status_code == 200
        data = json.loads(response.data)

        assert data["success"] is False
        assert "error" in data


class TestConversationExportEndpoints:
    """Test conversation export endpoints"""

    def test_export_conversation_json(self, enhanced_client):
        """Test exporting conversation as JSON"""
        client, socketio = enhanced_client
        conversation_id = "test_conv_123"

        response = client.get(f"/api/v2/chat/export/{conversation_id}?format=json")

        assert response.status_code == 200
        assert response.content_type == "application/json"

        data = json.loads(response.data)
        assert "conversation_id" in data
        assert "messages" in data
        assert "exported_at" in data
        assert data["conversation_id"] == conversation_id

    def test_export_conversation_unsupported_format(self, enhanced_client):
        """Test exporting conversation with unsupported format"""
        client, socketio = enhanced_client
        conversation_id = "test_conv_123"

        response = client.get(f"/api/v2/chat/export/{conversation_id}?format=xml")

        assert response.status_code == 400
        data = json.loads(response.data)
        assert "error" in data
        assert "Unsupported format" in data["error"]


class TestScheduleOptimizationEndpoints:
    """Test schedule optimization endpoints"""

    def test_optimize_schedule_with_ai(self, enhanced_client):
        """Test AI-powered schedule optimization"""
        client, socketio = enhanced_client

        optimization_data = {
            "week_start": "2024-01-15",
            "department": "sales",
            "optimization_level": "high",
        }

        response = client.post(
            "/api/v2/schedule/optimize-ai",
            json=optimization_data,
            content_type="application/json",
        )

        assert response.status_code == 200
        data = json.loads(response.data)

        assert data["success"] is True
        assert "optimized_schedule" in data
        assert "improvements" in data
        assert "recommendations" in data

        # Check optimization results
        schedule = data["optimized_schedule"]
        assert "week_start" in schedule
        assert "improvements_made" in schedule
        assert "efficiency_gain" in schedule

        # Check improvements
        improvements = data["improvements"]
        assert isinstance(improvements, list)
        if improvements:
            improvement = improvements[0]
            assert "metric" in improvement
            assert "before" in improvement
            assert "after" in improvement
            assert "improvement_percent" in improvement
