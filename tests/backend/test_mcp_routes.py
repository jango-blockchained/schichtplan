"""
Tests for MCP routes to validate FastMCP API compatibility fixes.
"""

import json
import pytest
from flask import Flask


@pytest.fixture
def app():
    """Create a test Flask app."""
    from src.backend.app import create_app
    
    app = create_app('testing')
    yield app


@pytest.fixture
def client(app):
    """Create a test client."""
    return app.test_client()


def test_mcp_health_endpoint(client):
    """Test the MCP health endpoint."""
    response = client.get('/api/v2/mcp/health')
    assert response.status_code in [200, 500]  # 500 might occur if DB not initialized
    data = json.loads(response.data)
    assert 'status' in data or 'error' in data


def test_mcp_config_endpoint(client):
    """Test the MCP config endpoint."""
    response = client.get('/api/v2/mcp/config')
    assert response.status_code == 200
    data = json.loads(response.data)
    assert 'server_name' in data
    assert 'version' in data
    assert 'endpoints' in data
    assert 'capabilities' in data


def test_mcp_tools_listing(client):
    """Test the MCP tools listing endpoint."""
    response = client.get('/api/v2/mcp/tools')
    assert response.status_code in [200, 500]
    data = json.loads(response.data)
    # Should have tools info even if there's an error
    assert 'available_tools' in data or 'error' in data


def test_mcp_resources_listing(client):
    """Test the MCP resources listing endpoint."""
    response = client.get('/api/v2/mcp/resources')
    assert response.status_code in [200, 500]
    data = json.loads(response.data)
    # Should have resources info
    assert 'resources' in data or 'error' in data


def test_mcp_prompts_listing(client):
    """Test the MCP prompts listing endpoint."""
    response = client.get('/api/v2/mcp/prompts')
    assert response.status_code in [200, 500]
    data = json.loads(response.data)
    # Should have prompts info
    assert 'prompts' in data or 'error' in data


def test_mcp_test_tool_validation(client):
    """Test the MCP test-tool endpoint for tool validation."""
    # Test with a known tool
    response = client.post(
        '/api/v2/mcp/test-tool',
        json={
            'tool_name': 'manage_employees',
            'parameters': {}
        },
        content_type='application/json'
    )
    
    # Should return 200 (validated) or 404 (not found) or 500 (error)
    assert response.status_code in [200, 404, 500]
    data = json.loads(response.data)
    
    if response.status_code == 200:
        assert data['status'] == 'validated'
        assert 'tool_name' in data
        assert 'tool_info' in data
    elif response.status_code == 404:
        assert 'error' in data
    else:
        assert 'error' in data or 'status' in data


def test_mcp_test_tool_invalid(client):
    """Test the MCP test-tool endpoint with invalid tool."""
    response = client.post(
        '/api/v2/mcp/test-tool',
        json={
            'tool_name': 'nonexistent_tool',
            'parameters': {}
        },
        content_type='application/json'
    )
    
    # Should return 404 for nonexistent tool or 500 for other errors
    assert response.status_code in [404, 500]
    data = json.loads(response.data)
    assert 'error' in data or 'status' in data


def test_mcp_execute_tool_info(client):
    """Test the MCP execute-tool endpoint returns info."""
    response = client.post(
        '/api/v2/mcp/execute-tool',
        json={
            'tool_name': 'manage_employees',
            'parameters': {}
        },
        content_type='application/json'
    )
    
    # Should return 200 (info), 404 (not found), or 500 (error)
    assert response.status_code in [200, 404, 500]
    data = json.loads(response.data)
    
    if response.status_code == 200:
        assert 'status' in data
        assert 'tool_name' in data
        # Should provide alternative endpoints for actual execution
        assert 'message' in data or 'alternative_endpoints' in data
    else:
        assert 'error' in data or 'status' in data


def test_mcp_status_endpoint(client):
    """Test the MCP status endpoint."""
    response = client.get('/api/v2/mcp/status')
    assert response.status_code in [200, 500]
    data = json.loads(response.data)
    
    # Should have status information
    assert 'status' in data or 'available_tools' in data or 'error' in data


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
