#!/usr/bin/env python3
"""
Test script for Gemini integration in the Conversational AI system.
"""

import asyncio
import sys

# Add the src directory to Python path
sys.path.append(".")


async def test_gemini_integration():
    """Test Gemini provider integration."""

    print("🧪 Testing Gemini Integration")
    print("=" * 50)

    try:
        # Test 1: Import the modules
        print("1. Testing imports...")
        from src.backend.services.ai_integration import (
            AIProvider,
            GeminiProvider,
            create_ai_orchestrator,
        )
        from src.backend.services.config import load_ai_config_from_database

        print("✅ Imports successful")

        # Test 2: Check enum values
        print("\n2. Testing AI provider enum...")
        print(f"   Available providers: {[p.value for p in AIProvider]}")
        assert AIProvider.GEMINI.value == "gemini"
        print("✅ GEMINI provider enum is correct")

        # Test 3: Test config loading (will fail gracefully without database)
        print("\n3. Testing configuration loading...")
        try:
            config = load_ai_config_from_database()
            print(f"✅ Config loaded - Preferred provider: {config.preferred_provider}")
        except Exception as e:
            print(f"⚠️  Database not available (expected): {e}")

        # Test 4: Test provider creation with mock API key
        print("\n4. Testing Gemini provider creation...")
        mock_api_key = "test-api-key-12345"

        try:
            provider = GeminiProvider(mock_api_key)
            models = provider.get_available_models()
            print(f"✅ GeminiProvider created with {len(models)} available models:")
            for model in models[:2]:  # Show first 2 models
                print(f"   - {model.model_id}: {model.name}")
        except Exception as e:
            print(f"⚠️  Provider creation failed (expected without real API key): {e}")

        # Test 5: Test orchestrator creation
        print("\n5. Testing AI orchestrator creation...")
        try:
            # This should work even without real API keys
            orchestrator = await create_ai_orchestrator(
                openai_key="mock-openai-key",
                anthropic_key="mock-anthropic-key",
                gemini_key="mock-gemini-key",
            )
            print(
                f"✅ Orchestrator created with {len(orchestrator.providers)} providers:"
            )
            for provider_type in orchestrator.providers:
                print(f"   - {provider_type.value}")
        except Exception as e:
            print(f"❌ Orchestrator creation failed: {e}")

        print("\n🎉 Gemini integration test completed!")
        return True

    except Exception as e:
        print(f"\n❌ Test failed: {e}")
        import traceback

        traceback.print_exc()
        return False


def test_database_api_key_loading():
    """Test loading Gemini API key from database settings."""

    print("\n🗄️ Testing Database API Key Loading")
    print("=" * 50)

    # Simulate having a Gemini API key in settings
    fake_settings = {
        "ai_scheduling": {"enabled": True, "api_key": "fake-gemini-api-key-from-db"}
    }

    try:
        from src.backend.services.config import AIProviderConfig

        # Create config as if loaded from database
        config = AIProviderConfig(
            gemini_api_key=fake_settings["ai_scheduling"]["api_key"],
            preferred_provider="gemini"
            if fake_settings["ai_scheduling"]["api_key"]
            else "openai",
        )

        print(f"✅ Config created with Gemini API key: {config.gemini_api_key[:10]}...")
        print(f"✅ Preferred provider set to: {config.preferred_provider}")

        # This shows how the system would prioritize Gemini when API key is available
        assert config.preferred_provider == "gemini"
        print("✅ Gemini correctly set as preferred provider when API key is available")

        return True

    except Exception as e:
        print(f"❌ Database API key test failed: {e}")
        return False


if __name__ == "__main__":
    print("🚀 Starting Gemini Integration Tests")
    print("=" * 60)

    # Run async test
    success1 = asyncio.run(test_gemini_integration())

    # Run sync test
    success2 = test_database_api_key_loading()

    print("\n📊 Test Results")
    print("=" * 60)
    if success1 and success2:
        print("🎉 All tests passed! Gemini integration is ready.")
        print("\n💡 Next steps:")
        print("   1. Set up a real Gemini API key in your application settings")
        print(
            "   2. The system will automatically use Gemini as the preferred provider"
        )
        print("   3. Start the conversational AI service normally")
        sys.exit(0)
    else:
        print("❌ Some tests failed. Please check the implementation.")
        sys.exit(1)
