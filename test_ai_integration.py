#!/usr/bin/env python3
"""
Test script to verify AI integration endpoints
"""

import requests


def test_ai_endpoints():
    base_url = "http://localhost:5000"

    # Test health endpoint
    try:
        response = requests.get(f"{base_url}/api/ai/health")
        print(f"Health endpoint: {response.status_code}")
        if response.status_code == 200:
            print(f"Response: {response.json()}")
        else:
            print(f"Error: {response.text}")
    except Exception as e:
        print(f"Health endpoint failed: {e}")

    # Test chat endpoint
    try:
        chat_data = {
            "message": "Hello, can you help me with scheduling?",
            "conversation_id": "test-001",
        }
        response = requests.post(f"{base_url}/api/ai/chat", json=chat_data)
        print(f"Chat endpoint: {response.status_code}")
        if response.status_code == 200:
            print(f"Response: {response.json()}")
        else:
            print(f"Error: {response.text}")
    except Exception as e:
        print(f"Chat endpoint failed: {e}")

    # Test agents endpoint
    try:
        response = requests.get(f"{base_url}/api/ai/agents")
        print(f"Agents endpoint: {response.status_code}")
        if response.status_code == 200:
            print(f"Response: {response.json()}")
        else:
            print(f"Error: {response.text}")
    except Exception as e:
        print(f"Agents endpoint failed: {e}")


if __name__ == "__main__":
    test_ai_endpoints()
