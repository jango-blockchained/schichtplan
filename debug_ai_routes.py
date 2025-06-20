#!/usr/bin/env python3
"""
Safe AI Routes Blueprint Debug Script

This script safely tests the AI routes blueprint without trying to access
the url_map attribute directly, which causes AttributeError.
"""

import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))


def test_ai_blueprint_import():
    """Test importing the AI blueprint safely"""
    try:
        print("Testing AI routes blueprint import...")
        from src.backend.routes.ai_routes import ai_bp, get_blueprint_info

        print("✅ AI routes import successful")
        print(f"Blueprint name: {ai_bp.name}")
        print(f"Blueprint URL prefix: {ai_bp.url_prefix}")

        # Get blueprint info safely
        blueprint_info = get_blueprint_info()
        print(f"Blueprint info: {blueprint_info}")

        return True

    except ImportError as e:
        print(f"❌ Import error: {e}")
        return False
    except AttributeError as e:
        print(f"❌ Attribute error: {e}")
        print("This is the error we're trying to fix!")
        return False
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        return False


def test_with_app_context():
    """Test the blueprint with Flask app context"""
    try:
        print("\nTesting with Flask app context...")
        from src.backend.app import create_app

        app = create_app()

        with app.app_context():
            # Now we can safely access routes
            print("App context established")

            # List all routes that belong to our blueprint
            ai_routes = []
            for rule in app.url_map.iter_rules():
                if rule.endpoint.startswith("ai."):
                    ai_routes.append(
                        {
                            "endpoint": rule.endpoint,
                            "rule": rule.rule,
                            "methods": list(rule.methods),
                        }
                    )

            print(f"Found {len(ai_routes)} AI routes:")
            for route in ai_routes:
                print(f"  {route['endpoint']}: {route['rule']} {route['methods']}")

        return True

    except Exception as e:
        print(f"❌ App context test failed: {e}")
        return False


def main():
    """Main test function"""
    print("AI Routes Blueprint Debug Test")
    print("=" * 40)

    # Test 1: Basic import
    import_success = test_ai_blueprint_import()

    # Test 2: With app context
    if import_success:
        app_success = test_with_app_context()
    else:
        print("Skipping app context test due to import failure")
        app_success = False

    print("\n" + "=" * 40)
    if import_success and app_success:
        print("✅ All tests passed!")
    else:
        print("❌ Some tests failed!")

    return import_success and app_success


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
