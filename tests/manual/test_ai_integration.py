#!/usr/bin/env python3
"""
Test script for AI Integration

This script tests the new AI integration features:
- Streaming chat endpoint
- Background task management
- Proactive suggestions
- Quick actions integration

Usage:
    python tests/manual/test_ai_integration.py [--endpoint ENDPOINT]
"""

import argparse
import json
import sys
import time
from datetime import datetime, timedelta

import requests

# Configuration
BASE_URL = "http://localhost:5000"
API_BASE = f"{BASE_URL}/api/ai"


def print_header(text: str):
    """Print a formatted header."""
    print("\n" + "=" * 70)
    print(f" {text}")
    print("=" * 70)


def print_success(text: str):
    """Print success message."""
    print(f"✅ {text}")


def print_error(text: str):
    """Print error message."""
    print(f"❌ {text}")


def print_info(text: str):
    """Print info message."""
    print(f"ℹ️  {text}")


def test_health_check():
    """Test if the API is accessible."""
    print_header("Testing API Health")

    try:
        response = requests.get(f"{API_BASE}/health", timeout=5)
        if response.status_code == 200:
            print_success("API is accessible")
            data = response.json()
            print_info(f"Status: {data.get('status', 'unknown')}")
            return True
        else:
            print_error(f"API returned status code: {response.status_code}")
            return False
    except Exception as e:
        print_error(f"Failed to connect to API: {str(e)}")
        print_info(f"Make sure the backend is running at {BASE_URL}")
        return False


def test_streaming_chat():
    """Test the streaming chat endpoint."""
    print_header("Testing Streaming Chat Endpoint")

    try:
        url = f"{API_BASE}/chat/stream"
        payload = {
            "message": "Hello, can you help me optimize my schedule?",
            "conversation_id": f"test_{int(time.time())}",
            "context": {"page": "schedule", "view": "calendar"},
        }

        print_info(f"Sending request to {url}")
        print_info(f"Message: {payload['message']}")

        response = requests.post(
            url,
            json=payload,
            headers={"Accept": "text/event-stream"},
            stream=True,
            timeout=30,
        )

        if response.status_code == 200:
            print_success("Streaming connection established")
            print_info("Receiving chunks:")

            chunk_count = 0
            for line in response.iter_lines():
                if line:
                    decoded = line.decode("utf-8")
                    if decoded.startswith("data: "):
                        chunk_count += 1
                        data = json.loads(decoded[6:])
                        chunk_type = data.get("type", "unknown")

                        if chunk_type == "start":
                            print(
                                f"  [START] Conversation: {data.get('conversation_id')}"
                            )
                        elif chunk_type == "content":
                            print(f"  [CONTENT] {data.get('content', '')[:50]}...")
                        elif chunk_type == "metadata":
                            print(
                                f"  [META] Agent: {data.get('agent')}, Tools: {data.get('tools_used')}"
                            )
                        elif chunk_type == "done":
                            print("  [DONE]")
                            break
                        elif chunk_type == "error":
                            print_error(f"Stream error: {data.get('error')}")
                            return False

            print_success(f"Received {chunk_count} chunks successfully")
            return True
        else:
            print_error(f"Failed with status code: {response.status_code}")
            print(response.text)
            return False

    except Exception as e:
        print_error(f"Streaming test failed: {str(e)}")
        return False


def test_background_tasks():
    """Test background task creation and monitoring."""
    print_header("Testing Background Task Management")

    try:
        # Create a task
        url = f"{API_BASE}/tasks/background"
        today = datetime.now().strftime("%Y-%m-%d")
        next_week = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")

        payload = {
            "task_type": "schedule_optimization",
            "parameters": {"start_date": today, "end_date": next_week},
            "metadata": {"test": True, "created_by": "test_script"},
        }

        print_info(f"Creating task: {payload['task_type']}")
        response = requests.post(url, json=payload, timeout=10)

        if response.status_code != 200:
            print_error(f"Failed to create task: {response.status_code}")
            print(response.text)
            return False

        task_data = response.json()
        task = task_data.get("task", {})
        task_id = task.get("id")

        print_success(f"Task created: {task_id}")
        print_info(f"Status: {task.get('status')}")

        # Monitor progress
        print_info("Monitoring task progress...")
        max_polls = 15
        poll_count = 0

        while poll_count < max_polls:
            time.sleep(1)
            poll_count += 1

            progress_url = f"{API_BASE}/tasks/{task_id}/progress"
            progress_response = requests.get(progress_url, timeout=5)

            if progress_response.status_code == 200:
                progress_data = progress_response.json()
                task_info = progress_data.get("task", {})
                status = task_info.get("status")
                progress = task_info.get("progress", {})

                if progress:
                    percentage = progress.get("percentage", 0)
                    message = progress.get("message", "")
                    print(f"  Progress: {percentage:.1f}% - {message}")

                if status in ["completed", "failed", "cancelled"]:
                    print_success(f"Task {status}!")

                    if status == "completed":
                        result = task_info.get("result", {})
                        print_info(f"Result: {json.dumps(result, indent=2)}")
                    elif status == "failed":
                        error = task_info.get("error", "Unknown error")
                        print_error(f"Task failed: {error}")

                    return status == "completed"

        print_error("Task did not complete within timeout")
        return False

    except Exception as e:
        print_error(f"Background task test failed: {str(e)}")
        import traceback

        traceback.print_exc()
        return False


def test_proactive_suggestions():
    """Test proactive suggestions endpoint."""
    print_header("Testing Proactive Suggestions")

    try:
        url = f"{API_BASE}/suggestions/proactive"

        # Test for schedule page
        payload = {
            "context": {
                "page": "schedule",
                "view": "calendar",
                "data": {
                    "start_date": datetime.now().strftime("%Y-%m-%d"),
                    "end_date": (datetime.now() + timedelta(days=7)).strftime(
                        "%Y-%m-%d"
                    ),
                },
            },
            "limit": 5,
        }

        print_info("Requesting suggestions for schedule page")
        response = requests.post(url, json=payload, timeout=10)

        if response.status_code == 200:
            data = response.json()
            suggestions = data.get("suggestions", [])
            count = data.get("count", 0)

            print_success(f"Received {count} suggestions")

            for i, suggestion in enumerate(suggestions, 1):
                print(f"\n  Suggestion {i}:")
                print(f"    Type: {suggestion.get('type')}")
                print(f"    Priority: {suggestion.get('priority')}")
                print(f"    Title: {suggestion.get('title')}")
                print(f"    Impact: {suggestion.get('impact')}")

            return True
        else:
            print_error(f"Failed with status code: {response.status_code}")
            print(response.text)
            return False

    except Exception as e:
        print_error(f"Proactive suggestions test failed: {str(e)}")
        return False


def test_task_listing():
    """Test task listing with filters."""
    print_header("Testing Task Listing")

    try:
        url = f"{API_BASE}/tasks"
        params = {"limit": 10}

        print_info("Fetching recent tasks")
        response = requests.get(url, params=params, timeout=10)

        if response.status_code == 200:
            data = response.json()
            tasks = data.get("tasks", [])
            stats = data.get("statistics", {})

            print_success(f"Found {len(tasks)} tasks")
            print_info(f"Statistics: {json.dumps(stats, indent=2)}")

            if tasks:
                print_info("\nRecent tasks:")
                for task in tasks[:5]:
                    print(f"  - {task.get('type')} ({task.get('status')})")

            return True
        else:
            print_error(f"Failed with status code: {response.status_code}")
            return False

    except Exception as e:
        print_error(f"Task listing test failed: {str(e)}")
        return False


def run_all_tests():
    """Run all integration tests."""
    print("\n" + "🚀 " * 20)
    print("AI INTEGRATION TEST SUITE")
    print("🚀 " * 20)

    results = {
        "health_check": test_health_check(),
    }

    if not results["health_check"]:
        print_error("\n❌ API is not accessible. Cannot proceed with tests.")
        print_info("Please start the backend: ./start.sh")
        return False

    results["streaming_chat"] = test_streaming_chat()
    results["background_tasks"] = test_background_tasks()
    results["proactive_suggestions"] = test_proactive_suggestions()
    results["task_listing"] = test_task_listing()

    # Summary
    print_header("Test Results Summary")

    passed = sum(1 for v in results.values() if v)
    total = len(results)

    for test_name, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status}: {test_name}")

    print(f"\n{'=' * 70}")
    print(f"Results: {passed}/{total} tests passed")

    if passed == total:
        print_success("All tests passed! 🎉")
        return True
    else:
        print_error(f"{total - passed} test(s) failed")
        return False


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(description="Test AI Integration")
    parser.add_argument(
        "--endpoint",
        choices=["all", "health", "streaming", "tasks", "suggestions", "listing"],
        default="all",
        help="Which endpoint to test",
    )
    parser.add_argument(
        "--base-url",
        default=BASE_URL,
        help=f"Base URL for the API (default: {BASE_URL})",
    )

    args = parser.parse_args()

    global BASE_URL, API_BASE
    BASE_URL = args.base_url
    API_BASE = f"{BASE_URL}/api/ai"

    if args.endpoint == "all":
        success = run_all_tests()
    elif args.endpoint == "health":
        success = test_health_check()
    elif args.endpoint == "streaming":
        success = test_health_check() and test_streaming_chat()
    elif args.endpoint == "tasks":
        success = test_health_check() and test_background_tasks()
    elif args.endpoint == "suggestions":
        success = test_health_check() and test_proactive_suggestions()
    elif args.endpoint == "listing":
        success = test_health_check() and test_task_listing()

    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
