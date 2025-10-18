#!/usr/bin/env python3
"""
Test script for AI Conversation Multi-Step Generation
"""

import json
from datetime import datetime, timedelta

import requests

# Configuration
BASE_URL = "http://localhost:5000"
CONVERSATION_ENDPOINT = "/api/v2/ai-conversation/ai/conversation"


def test_conversation_flow():
    """Test the complete multi-step conversation flow"""
    print("=" * 80)
    print("AI CONVERSATION MULTI-STEP GENERATION TEST")
    print("=" * 80)

    # Define test period
    start_date = (datetime.now().date() + timedelta(days=7)).strftime("%Y-%m-%d")
    end_date = (datetime.now().date() + timedelta(days=13)).strftime("%Y-%m-%d")

    conversation_id = None

    # Step 1: Initialize Conversation
    print("\nStep 1: Initialize Conversation")
    print("-" * 40)

    init_payload = {
        "action": "start_conversation",
        "context": {
            "start_date": start_date,
            "end_date": end_date,
            "generation_type": "interactive",
            "version_id": 1,
        },
    }

    print(f"Request: {json.dumps(init_payload, indent=2)}")

    try:
        response = requests.post(
            f"{BASE_URL}{CONVERSATION_ENDPOINT}",
            json=init_payload,
            headers={"Content-Type": "application/json"},
        )

        print(f"Status: {response.status_code}")
        result = response.json()
        print(f"Response: {json.dumps(result, indent=2)}")

        if result.get("status") == "success":
            conversation_id = result.get("conversation_id")
            print(f"\n✓ Conversation initialized: {conversation_id}")
        else:
            print("\n✗ Failed to initialize conversation")
            return

    except Exception as e:
        print(f"\n✗ Error: {e}")
        return

    # Step 2: Analyze Current State
    print("\n\nStep 2: Analyze Current State")
    print("-" * 40)

    analyze_payload = {
        "action": "analyze_current_state",
        "conversation_id": conversation_id,
        "include": ["conflicts", "coverage_gaps", "workload_distribution"],
    }

    print(f"Request: {json.dumps(analyze_payload, indent=2)}")

    try:
        response = requests.post(
            f"{BASE_URL}{CONVERSATION_ENDPOINT}",
            json=analyze_payload,
            headers={"Content-Type": "application/json"},
        )

        print(f"Status: {response.status_code}")
        result = response.json()
        print(f"Response: {json.dumps(result, indent=2)}")

        if result.get("status") == "success":
            print("\n✓ Analysis completed")
            if result.get("analysis"):
                print(
                    f"  - Total issues: {result['analysis'].get('summary', {}).get('total_issues', 'N/A')}"
                )
                print(
                    f"  - Severity: {result['analysis'].get('summary', {}).get('severity', 'N/A')}"
                )
        else:
            print("\n✗ Analysis failed")

    except Exception as e:
        print(f"\n✗ Error: {e}")

    # Step 3: Get Recommendations
    print("\n\nStep 3: Get Recommendations")
    print("-" * 40)

    recommend_payload = {
        "action": "get_recommendations",
        "conversation_id": conversation_id,
        "optimization_goals": ["fairness", "coverage", "preferences"],
    }

    print(f"Request: {json.dumps(recommend_payload, indent=2)}")

    try:
        response = requests.post(
            f"{BASE_URL}{CONVERSATION_ENDPOINT}",
            json=recommend_payload,
            headers={"Content-Type": "application/json"},
        )

        print(f"Status: {response.status_code}")
        result = response.json()
        print(f"Response: {json.dumps(result, indent=2)}")

        if result.get("status") == "success":
            print("\n✓ Recommendations generated")
            if result.get("recommendations"):
                print(
                    f"  - Strategy: {result['recommendations'].get('generation_strategy', 'N/A')}"
                )
                print(
                    f"  - Focus areas: {len(result['recommendations'].get('focus_areas', []))}"
                )
        else:
            print("\n✗ Failed to get recommendations")

    except Exception as e:
        print(f"\n✗ Error: {e}")

    # Step 4: Check Conversation Status
    print("\n\nStep 4: Check Conversation Status")
    print("-" * 40)

    try:
        response = requests.get(
            f"{BASE_URL}{CONVERSATION_ENDPOINT}/{conversation_id}",
            headers={"Content-Type": "application/json"},
        )

        print(f"Status: {response.status_code}")
        result = response.json()
        print(f"Response: {json.dumps(result, indent=2)}")

    except Exception as e:
        print(f"\n✗ Error: {e}")

    # Step 5: Preview Optimized Data
    print("\n\nStep 5: Preview Optimized Data")
    print("-" * 40)

    preview_payload = {
        "start_date": start_date,
        "end_date": end_date,
        "constraints": {"min_daily_coverage": 2, "keyholder_required_daily": True},
    }

    print(f"Request: {json.dumps(preview_payload, indent=2)}")

    try:
        response = requests.post(
            f"{BASE_URL}{CONVERSATION_ENDPOINT}/preview-optimized-data",
            json=preview_payload,
            headers={"Content-Type": "application/json"},
        )

        print(f"Status: {response.status_code}")
        result = response.json()
        print(f"Response: {json.dumps(result, indent=2)}")

    except Exception as e:
        print(f"\n✗ Error: {e}")


def test_error_handling():
    """Test error handling scenarios"""
    print("\n\n" + "=" * 80)
    print("ERROR HANDLING TESTS")
    print("=" * 80)

    # Test invalid action
    print("\nTest 1: Invalid Action")
    print("-" * 40)

    invalid_payload = {"action": "invalid_action", "conversation_id": "test"}

    try:
        response = requests.post(
            f"{BASE_URL}{CONVERSATION_ENDPOINT}",
            json=invalid_payload,
            headers={"Content-Type": "application/json"},
        )

        print(f"Status: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2)}")

    except Exception as e:
        print(f"Error: {e}")

    # Test missing conversation ID
    print("\n\nTest 2: Missing Conversation ID")
    print("-" * 40)

    missing_id_payload = {"action": "analyze_current_state"}

    try:
        response = requests.post(
            f"{BASE_URL}{CONVERSATION_ENDPOINT}",
            json=missing_id_payload,
            headers={"Content-Type": "application/json"},
        )

        print(f"Status: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2)}")

    except Exception as e:
        print(f"Error: {e}")


if __name__ == "__main__":
    print("Starting AI Conversation Tests...")
    print(f"Target: {BASE_URL}")
    print(f"Time: {datetime.now()}")

    # Run conversation flow test
    test_conversation_flow()

    # Run error handling tests
    test_error_handling()

    print("\n" + "=" * 80)
    print("TEST COMPLETE")
    print("=" * 80)
