#!/usr/bin/env python3
"""Simple test for Gemini integration"""

import sys

sys.path.insert(0, "/home/jango/Git/maike2/schichtplan")


def test_imports():
    """Test that all imports work correctly."""
    try:
        print("Testing imports...")

        # Test basic imports
        from src.backend.services.ai_integration import AIProvider, GeminiProvider

        print("✅ AI integration imports successful")

        # Check enum
        print(f"Available providers: {[p.value for p in AIProvider]}")
        assert AIProvider.GEMINI in AIProvider
        print("✅ GEMINI provider found in enum")

        # Test provider creation
        provider = GeminiProvider("test-key")
        models = provider.get_available_models()
        print(f"✅ GeminiProvider created with {len(models)} models")

        for model in models:
            print(
                f"  - {model.name} ({model.model_id}) - Quality: {model.quality_score}"
            )

        return True

    except ImportError as e:
        print(f"❌ Import error: {e}")
        return False
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback

        traceback.print_exc()
        return False


if __name__ == "__main__":
    success = test_imports()
    if success:
        print("\n🎉 All tests passed! Gemini integration is working.")
    else:
        print("\n❌ Tests failed.")
    sys.exit(0 if success else 1)
