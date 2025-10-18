#!/usr/bin/env python3
"""
Test script for AI Schedule Generation
Tests the current implementation and examines data collection optimization
"""

import json
import time
from datetime import datetime, timedelta
from typing import Any, Dict

import requests

# Configuration
BASE_URL = "http://localhost:5000"
API_ENDPOINT = "/api/v2/schedule/generate-ai"
PREVIEW_ENDPOINT = "/api/v2/ai/schedule/preview-ai-data"


def test_ai_schedule_generation():
    """Test the AI schedule generation endpoint"""
    print("=" * 80)
    print("AI SCHEDULE GENERATION TEST")
    print("=" * 80)

    # Define test period (next week)
    start_date = datetime.now().date() + timedelta(days=7)
    end_date = start_date + timedelta(days=6)

    # Test 1: Preview AI Data Collection
    print("\n1. Testing AI Data Preview (examining data collection)...")
    preview_payload = {
        "start_date": start_date.strftime("%Y-%m-%d"),
        "end_date": end_date.strftime("%Y-%m-%d"),
    }

    try:
        preview_response = requests.post(
            f"{BASE_URL}{PREVIEW_ENDPOINT}",
            json=preview_payload,
            headers={"Content-Type": "application/json"},
        )

        if preview_response.status_code == 200:
            preview_data = preview_response.json()
            analyze_preview_data(preview_data)
        else:
            print(f"Preview failed: {preview_response.status_code}")
            print(f"Response: {preview_response.text}")
    except Exception as e:
        print(f"Preview error: {e}")

    # Test 2: Simple AI Generation Request
    print("\n2. Testing Simple AI Generation...")
    simple_payload = {
        "start_date": start_date.strftime("%Y-%m-%d"),
        "end_date": end_date.strftime("%Y-%m-%d"),
        "version_id": 1,
        "ai_model_params": {"temperature": 0.7, "max_tokens": 2000},
    }

    test_generation_request(simple_payload, "Simple Generation")

    # Test 3: Detailed AI Generation with Options
    print("\n3. Testing Detailed AI Generation with Options...")
    detailed_payload = {
        "start_date": start_date.strftime("%Y-%m-%d"),
        "end_date": end_date.strftime("%Y-%m-%d"),
        "version_id": 1,
        "generation_mode": "detailed",
        "ai_options": {
            "prioritySettings": {
                "employeeSatisfaction": 70,
                "fairness": 80,
                "consistency": 60,
                "workloadBalance": 75,
            },
            "constraintOverrides": {
                "ignoreNonCriticalAvailability": False,
                "allowOvertime": False,
                "strictKeyholder": True,
                "minimumRestPeriods": True,
            },
            "employeeOptions": {
                "onlyFixedPreferred": True,
                "respectPreferenceWeights": True,
                "considerHistoricalPatterns": True,
            },
            "aiModelParams": {"temperature": 0.5, "creativity": 0.3},
        },
    }

    # Try alternative endpoint for detailed generation
    detailed_endpoint = "/api/v2/schedules/ai-generate"
    test_generation_request(detailed_payload, "Detailed Generation", detailed_endpoint)


def test_generation_request(
    payload: Dict[str, Any], test_name: str, endpoint: str = API_ENDPOINT
):
    """Test a generation request and analyze the response"""
    print(f"\n{test_name}:")
    print(f"Payload: {json.dumps(payload, indent=2)}")

    start_time = time.time()

    try:
        response = requests.post(
            f"{BASE_URL}{endpoint}",
            json=payload,
            headers={"Content-Type": "application/json"},
        )

        duration = time.time() - start_time

        print(f"Status Code: {response.status_code}")
        print(f"Response Time: {duration:.2f}s")

        if response.status_code == 200:
            result = response.json()
            analyze_generation_response(result)
        else:
            print(f"Error Response: {response.text[:500]}")

    except Exception as e:
        print(f"Request failed: {e}")


def analyze_preview_data(data: Dict[str, Any]):
    """Analyze the preview data to understand what's being collected"""
    print("\nAI Data Collection Analysis:")
    print("-" * 40)

    if "collected_data" in data:
        collected = data["collected_data"]

        # Analyze data size and structure
        for key, value in collected.items():
            if isinstance(value, list):
                print(f"{key}: {len(value)} items")
                # Sample first item if available
                if value and isinstance(value[0], dict):
                    print(f"  Sample: {list(value[0].keys())}")
            elif isinstance(value, dict):
                print(f"{key}: {len(value)} entries")
            else:
                print(f"{key}: {type(value).__name__}")

        # Calculate data size
        json_str = json.dumps(collected)
        print(
            f"\nTotal data size: {len(json_str)} bytes ({len(json_str) / 1024:.2f} KB)"
        )

        # Identify optimization opportunities
        print("\nOptimization Opportunities:")

        if "employees" in collected:
            employees = collected["employees"]
            print(f"- Employees: {len(employees)} total")
            # Check for filtering
            if all("availability_summary" not in emp for emp in employees):
                print("  ⚠️  No availability pre-filtering detected")

        if "shifts" in collected:
            shifts = collected["shifts"]
            print(f"- Shifts: {len(shifts)} templates")
            # Check if filtered by active days
            active_count = sum(1 for s in shifts if s.get("active_days"))
            print(f"  Active for period: {active_count}")

        if "coverage_rules" in collected:
            coverage = collected["coverage_rules"]
            print(f"- Coverage Rules: {len(coverage)} rules")
            # Check if filtered by weekday
            weekdays = set(c.get("day_index") for c in coverage if "day_index" in c)
            print(f"  Unique weekdays: {len(weekdays)}")

        if "availability" in collected:
            availability = collected["availability"]
            print(f"- Availability: {len(availability)} windows")
            # Check data structure efficiency
            if availability:
                sample = availability[0]
                if "hour" in sample:
                    print("  ⚠️  Using hour-by-hour data (inefficient)")
                elif any(k.endswith("_time_range") for k in sample):
                    print("  ✓ Using time ranges (efficient)")


def analyze_generation_response(result: Dict[str, Any]):
    """Analyze the generation response"""
    print("\nGeneration Response Analysis:")
    print("-" * 40)

    # Check response structure
    status = result.get("status", "unknown")
    print(f"Status: {status}")

    if "message" in result:
        print(f"Message: {result['message']}")

    if "generated_assignments_count" in result:
        print(f"Assignments Generated: {result['generated_assignments_count']}")

    if "diagnostic_log" in result:
        print(f"Diagnostic Log: {result['diagnostic_log']}")

    if "session_id" in result:
        print(f"Session ID: {result['session_id']}")

    # Check for optimization metadata
    if "generation_mode" in result:
        print(f"Generation Mode: {result['generation_mode']}")

    if "ai_options" in result:
        print("AI Options Applied: Yes")
        options = result["ai_options"]
        if "priority_settings" in options:
            print(f"  Priority Settings: {list(options['priority_settings'].keys())}")

    # Identify missing features
    print("\nMissing Features:")
    if "conversation_id" not in result:
        print("- No conversation ID (single request process)")
    if "partial_results" not in result:
        print("- No partial results (not multi-step)")
    if "optimization_metrics" not in result:
        print("- No optimization metrics returned")
    if "alternative_schedules" not in result:
        print("- No alternative schedules provided")


def test_multi_step_generation():
    """Test multi-step generation process (proposed implementation)"""
    print("\n" + "=" * 80)
    print("PROPOSED MULTI-STEP GENERATION TEST")
    print("=" * 80)

    # Step 1: Initialize conversation
    print("\nStep 1: Initialize AI Conversation")
    init_payload = {
        "action": "start_conversation",
        "context": {
            "start_date": (datetime.now().date() + timedelta(days=7)).strftime(
                "%Y-%m-%d"
            ),
            "end_date": (datetime.now().date() + timedelta(days=13)).strftime(
                "%Y-%m-%d"
            ),
            "generation_type": "interactive",
        },
    }
    print(f"Proposed payload: {json.dumps(init_payload, indent=2)}")

    # Step 2: Analyze current state
    print("\nStep 2: Request Analysis")
    analysis_payload = {
        "action": "analyze_current_state",
        "conversation_id": "mock-conversation-id",
        "include": ["conflicts", "coverage_gaps", "workload_distribution"],
    }
    print(f"Proposed payload: {json.dumps(analysis_payload, indent=2)}")

    # Step 3: Get recommendations
    print("\nStep 3: Get Optimization Recommendations")
    recommendations_payload = {
        "action": "get_recommendations",
        "conversation_id": "mock-conversation-id",
        "optimization_goals": ["fairness", "coverage", "preferences"],
    }
    print(f"Proposed payload: {json.dumps(recommendations_payload, indent=2)}")

    # Step 4: Generate with feedback
    print("\nStep 4: Generate Schedule with Constraints")
    generation_payload = {
        "action": "generate_schedule",
        "conversation_id": "mock-conversation-id",
        "apply_recommendations": True,
        "constraints": {
            "must_include_employees": [1, 2, 3],
            "avoid_overtime": True,
            "prefer_consistent_shifts": True,
        },
    }
    print(f"Proposed payload: {json.dumps(generation_payload, indent=2)}")

    # Step 5: Review and adjust
    print("\nStep 5: Review and Adjust")
    adjust_payload = {
        "action": "adjust_schedule",
        "conversation_id": "mock-conversation-id",
        "modifications": [
            {
                "date": "2024-01-15",
                "employee_id": 1,
                "action": "remove",
                "reason": "Employee requested day off",
            }
        ],
        "regenerate_affected": True,
    }
    print(f"Proposed payload: {json.dumps(adjust_payload, indent=2)}")


if __name__ == "__main__":
    print("Starting AI Schedule Generation Tests...")
    print(f"Target: {BASE_URL}")
    print(f"Time: {datetime.now()}")

    # Run current implementation tests
    test_ai_schedule_generation()

    # Show proposed multi-step process
    test_multi_step_generation()

    print("\n" + "=" * 80)
    print("TEST COMPLETE")
    print("=" * 80)
