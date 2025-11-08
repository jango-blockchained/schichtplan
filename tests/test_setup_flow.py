"""
Test script to verify setup flow functionality
"""

import sys
import os

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def test_imports():
    """Test that all necessary modules can be imported"""
    print("Testing imports...")

    try:
        from src.backend.models.user import User, UserRole
        from src.backend.models.settings import Settings
        from src.backend.routes.setup import bp as setup_bp
        from src.backend.routes.passkey_auth import bp as passkey_bp

        print("✓ All imports successful")
        return True
    except Exception as e:
        print(f"✗ Import failed: {e}")
        return False


def test_user_model():
    """Test User model passkey and recovery code methods"""
    print("\nTesting User model...")

    try:
        from src.backend.models.user import User, UserRole

        # Create a test user (in memory, not saved to DB)
        user = User(
            username="test_admin",
            email="test@example.com",
            password="test_password",
            role=UserRole.ADMIN,
        )

        # Test recovery code generation
        codes = user.generate_recovery_codes(count=4)
        assert len(codes) == 4, "Should generate 4 recovery codes"
        assert all(len(code) == 12 for code in codes), (
            "Each code should be 12 characters"
        )
        print(f"✓ Generated {len(codes)} recovery codes")

        # Test recovery code verification
        test_code = codes[0]
        assert user.verify_recovery_code(test_code), (
            "Should verify correct recovery code"
        )
        assert not user.verify_recovery_code(test_code), (
            "Should not verify same code twice"
        )
        print("✓ Recovery code verification works")

        # Test remaining codes count
        remaining = user.get_remaining_recovery_codes_count()
        assert remaining == 3, f"Should have 3 codes remaining, got {remaining}"
        print(f"✓ Recovery codes count: {remaining}")

        # Test WebAuthn credential methods
        test_credential = {
            "credential_id": "test_id_123",
            "credential_public_key": "test_key_456",
            "sign_count": 0,
            "transports": ["usb", "nfc"],
        }
        user.add_webauthn_credential(test_credential)
        credentials = user.get_webauthn_credentials()
        assert len(credentials) == 1, "Should have 1 credential"
        print("✓ WebAuthn credential management works")

        # Test to_dict includes new fields
        user_dict = user.to_dict()
        assert "setup_completed" in user_dict, "to_dict should include setup_completed"
        assert "has_passkey" in user_dict, "to_dict should include has_passkey"
        assert "remaining_recovery_codes" in user_dict, (
            "to_dict should include remaining_recovery_codes"
        )
        print("✓ User serialization includes new fields")

        return True

    except Exception as e:
        print(f"✗ User model test failed: {e}")
        import traceback

        traceback.print_exc()
        return False


def test_settings_model():
    """Test Settings model additions"""
    print("\nTesting Settings model...")

    try:
        from src.backend.models.settings import Settings

        # Create test settings (in memory)
        settings = Settings()

        # Check that initial_setup_completed field exists
        assert hasattr(settings, "initial_setup_completed"), (
            "Settings should have initial_setup_completed field"
        )
        # Note: In-memory instances don't get SQLAlchemy defaults, so we just check it exists
        print("✓ Settings model has initial_setup_completed field")

        # Test get_default_settings which should properly initialize
        default_settings = Settings.get_default_settings()
        # This should be properly initialized
        print(
            f"✓ Default settings created (initial_setup_completed: {default_settings.initial_setup_completed})"
        )

        return True

    except Exception as e:
        print(f"✗ Settings model test failed: {e}")
        import traceback

        traceback.print_exc()
        return False


def main():
    """Run all tests"""
    print("=" * 60)
    print("Setup Flow Verification Tests")
    print("=" * 60)

    results = []

    # Run tests
    results.append(("Imports", test_imports()))
    results.append(("User Model", test_user_model()))
    results.append(("Settings Model", test_settings_model()))

    # Print summary
    print("\n" + "=" * 60)
    print("Test Summary")
    print("=" * 60)

    passed = sum(1 for _, result in results if result)
    total = len(results)

    for name, result in results:
        status = "PASS" if result else "FAIL"
        symbol = "✓" if result else "✗"
        print(f"{symbol} {name}: {status}")

    print("\n" + "=" * 60)
    print(f"Results: {passed}/{total} tests passed")
    print("=" * 60)

    return 0 if passed == total else 1


if __name__ == "__main__":
    sys.exit(main())
