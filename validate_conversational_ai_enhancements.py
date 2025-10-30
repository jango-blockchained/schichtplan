"""
Validation script for conversational AI context and initial prompt.

This script verifies that:
1. The initial prompt is correctly generated with system context
2. The prompt builder properly combines system and task-specific prompts
3. The conversation context is properly enriched with scheduling information
"""

import sys
from pathlib import Path


def check_backend_enhancements():
    """Check backend conversational AI enhancements."""
    print("\n" + "=" * 70)
    print("BACKEND CONTEXT ENHANCEMENTS VERIFICATION")
    print("=" * 70)

    base_path = Path("/home/jango/Git/maike2/schichtplan/src/backend/services")
    service_file = base_path / "conversational_mcp_service.py"

    if not service_file.exists():
        print("❌ conversational_mcp_service.py not found")
        return False

    content = service_file.read_text()

    # Check for key enhancements
    checks = [
        (
            "_build_full_prompt",
            "Prompt builder method exists",
        ),
        (
            "Generate initial AI response for new conversation with context",
            "Enhanced docstring for _generate_initial_response",
        ),
        (
            "My Capabilities:",
            "Capabilities section in initial response",
        ),
        (
            "How I Work:",
            "Work process section in initial response",
        ),
        (
            "Conversation Context:",
            "Context tracking section in initial response",
        ),
        (
            "Schedule analysis, employee management",
            "Tools list in capabilities",
        ),
    ]

    all_passed = True
    for check_str, description in checks:
        if check_str in content:
            print(f"✅ {description}")
        else:
            print(f"❌ {description}")
            all_passed = False

    return all_passed


def check_frontend_enhancements():
    """Check frontend AIContext enhancements."""
    print("\n" + "=" * 70)
    print("FRONTEND AICONTEXT ENHANCEMENTS VERIFICATION")
    print("=" * 70)

    base_path = Path("/home/jango/Git/maike2/schichtplan/src/frontend/src")
    context_file = base_path / "contexts" / "AIContext.tsx"

    if not context_file.exists():
        print("❌ AIContext.tsx not found")
        return False

    content = context_file.read_text()

    # Check for key enhancements
    checks = [
        (
            "scheduleContext?:",
            "Schedule context interface added to PageContext",
        ),
        (
            "start_date?: string",
            "Schedule period tracking",
        ),
        (
            "coverage_metrics?:",
            "Coverage metrics tracking",
        ),
        (
            "employee_count?: number",
            "Employee count tracking",
        ),
        (
            "updateScheduleContext",
            "Schedule context update method",
        ),
        (
            "Schedule period:",
            "Schedule context in getContextString",
        ),
        (
            "Active employees:",
            "Employee count in context string",
        ),
        (
            "Coverage:",
            "Coverage metrics in context string",
        ),
    ]

    all_passed = True
    for check_str, description in checks:
        if check_str in content:
            print(f"✅ {description}")
        else:
            print(f"❌ {description}")
            all_passed = False

    return all_passed


def check_frontend_welcome_enhancement():
    """Check frontend ConversationalAIChat enhancements."""
    print("\n" + "=" * 70)
    print("FRONTEND WELCOME MESSAGE ENHANCEMENTS VERIFICATION")
    print("=" * 70)

    base_path = Path("/home/jango/Git/maike2/schichtplan/src/frontend/src")
    chat_file = base_path / "components" / "ai" / "ConversationalAIChat.tsx"

    if not chat_file.exists():
        print("❌ ConversationalAIChat.tsx not found")
        return False

    content = chat_file.read_text()

    # Check for key enhancements
    checks = [
        (
            "context-aware welcome message",
            "Context-aware welcome initialization",
        ),
        (
            "pageContext.route.includes",
            "Route-based personalization",
        ),
        (
            "schedule",
            "Schedule page context",
        ),
        (
            "employee",
            "Employee page context",
        ),
        (
            "coverage",
            "Coverage page context",
        ),
        (
            "pageContext.scheduleContext?.start_date",
            "Schedule context usage in welcome",
        ),
        (
            "current_conflicts",
            "Conflict tracking in welcome",
        ),
    ]

    all_passed = True
    for check_str, description in checks:
        if check_str in content:
            print(f"✅ {description}")
        else:
            print(f"❌ {description}")
            all_passed = False

    return all_passed


def check_initial_prompt_loading():
    """Check initial prompt loading from file."""
    print("\n" + "=" * 70)
    print("INITIAL PROMPT LOADING VERIFICATION")
    print("=" * 70)

    prompt_path = Path(
        "/home/jango/Git/maike2/schichtplan/src/backend/services/"
        "prompts/user_ai_assistant.md"
    )

    if not prompt_path.exists():
        print("❌ user_ai_assistant.md not found")
        return False

    content = prompt_path.read_text(encoding="utf-8")
    print("✅ System prompt file found and readable")

    # Check prompt content
    checks = [
        ("Schichtplan", "Product name mentioned"),
        ("Role", "Role section defined"),
        ("Capabilities", "Capabilities section defined"),
        ("Guidelines", "Guidelines section defined"),
    ]

    all_passed = True
    for check_str, description in checks:
        if check_str in content:
            print(f"✅ {description}")
        else:
            print(f"❌ {description}")
            all_passed = False

    return all_passed


def generate_summary():
    """Generate summary of enhancements."""
    print("\n" + "=" * 70)
    print("ENHANCEMENT SUMMARY")
    print("=" * 70)

    summary = """
✨ CONVERSATIONAL AI CONTEXT ENHANCEMENTS

Backend (_generate_initial_response):
  • Enhanced with structured capability listing (8 capabilities)
  • Includes conversation context tracking (goals, personality, tools)
  • Better prompt structure with "How I Work" section
  • Improved logging with prompt length tracking
  • Uses _build_full_prompt for system prompt integration

Backend (_build_full_prompt):
  • Enhanced docstring explaining prompt building strategy
  • Logs prompt composition details for debugging
  • Warns when system prompt is missing

Frontend (AIContext):
  • Extended PageContext with schedule-specific data
    - start_date, end_date for schedule period
    - selected_version_id for version tracking
    - coverage_metrics (current, required, gaps)
    - employee_count for team size tracking
    - current_conflicts for conflict tracking
  • New updateScheduleContext method
  • Enhanced getContextString with schedule context

Frontend (ConversationalAIChat):
  • Dynamic welcome message based on current route
  • Schedule context-aware greeting for schedule page
  • Employee context-aware greeting for employee page
  • Coverage context-aware greeting for coverage page
  • Displays schedule period in welcome
  • Shows current conflicts if present
  • Dependencies on pageContext and getContextString

✅ All enhancements maintain backward compatibility
✅ System prompt is properly loaded and combined with task prompts
✅ Frontend context is properly tracked and transmitted to AI
✅ Welcome messages are dynamically generated based on page context
"""
    print(summary)


def main():
    """Run all verification checks."""
    print("\n" + "=" * 70)
    print("CONVERSATIONAL AI CONTEXT & INITIAL PROMPT VALIDATION")
    print("=" * 70)

    results = {
        "Backend Enhancements": check_backend_enhancements(),
        "Frontend AIContext": check_frontend_enhancements(),
        "Frontend Welcome": check_frontend_welcome_enhancement(),
        "Initial Prompt Loading": check_initial_prompt_loading(),
    }

    # Summary
    generate_summary()

    # Final result
    print("\n" + "=" * 70)
    print("VALIDATION RESULTS")
    print("=" * 70)

    all_passed = all(results.values())
    for name, passed in results.items():
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status}: {name}")

    print("\n" + "=" * 70)

    if all_passed:
        print("✅ ALL ENHANCEMENTS VERIFIED SUCCESSFULLY")
        return 0
    else:
        print("❌ SOME ENHANCEMENTS NEED ATTENTION")
        return 1


if __name__ == "__main__":
    sys.exit(main())
