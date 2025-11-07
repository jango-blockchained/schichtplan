#!/usr/bin/env python
"""
Emergency tool to reset admin passkey via CLI.
Useful for regaining access when passkey is lost.

Usage:
  python reset_admin_passkey.py          # Interactive mode
  python reset_admin_passkey.py --force  # Force reset without confirmation
"""

import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))


def reset_admin_passkey(force=False):
    """
    Reset the admin passkey and generate new recovery codes.

    Args:
        force: If True, skip confirmation prompts

    Returns:
        dict: Contains success status and recovery codes
    """
    # Import Flask and models - avoid loading full app routes
    from flask import Flask

    from src.backend.config import Config
    from src.backend.models import User, UserRole, db
    from src.backend.utils.logger import logger

    # Create minimal Flask app
    app = Flask(__name__)
    app.config.from_object(Config)
    db.init_app(app)

    with app.app_context():
        try:
            # Get the admin user
            admin_user = User.query.filter_by(role=UserRole.ADMIN).first()

            if not admin_user:
                print("❌ Error: No admin user exists in the database")
                return {"success": False, "error": "No admin user found"}

            # Confirmation
            if not force:
                print(
                    f"\n⚠️  About to reset admin passkey for user: {admin_user.username}"
                )
                print("This will:")
                print("  • Clear the current passkey")
                print("  • Generate 4 new recovery codes")
                print(
                    "  • Allow access via recovery codes until a new passkey is set\n"
                )

                response = input("Are you sure? (yes/no): ").strip().lower()
                if response not in ["yes", "y"]:
                    print("❌ Reset cancelled")
                    return {"success": False, "error": "User cancelled reset"}

            # Clear credentials
            print("\nResetting admin passkey...")
            admin_user.webauthn_credentials = None

            # Generate new recovery codes
            recovery_codes = admin_user.generate_recovery_codes(count=4)

            # Save
            db.session.commit()

            print("✅ Admin passkey reset successfully!\n")
            print("Recovery Codes (save these in a secure place):")
            print("-" * 50)
            for i, code in enumerate(recovery_codes, 1):
                print(f"  {i}. {code}")
            print("-" * 50)
            print(f"\nUsername: {admin_user.username}")
            print(f"Email: {admin_user.email}")
            print("\nYou can now log in using:")
            print("  • A recovery code (each code can only be used once)")
            print("  • Then re-register a new passkey\n")

            logger.info(f"Admin passkey reset via CLI for user: {admin_user.username}")

            return {
                "success": True,
                "username": admin_user.username,
                "email": admin_user.email,
                "recovery_codes": recovery_codes,
            }

        except Exception as e:
            print(f"❌ Error: {str(e)}")
            logger.error(
                f"Error resetting admin passkey via CLI: {str(e)}", exc_info=True
            )
            return {"success": False, "error": str(e)}


def save_recovery_codes(recovery_codes, filename="recovery_codes.txt"):
    """
    Save recovery codes to a file for backup.

    Args:
        recovery_codes: List of recovery codes
        filename: Output filename
    """
    try:
        output_path = Path(filename)
        with open(output_path, "w") as f:
            f.write("SCHICHTPLAN RECOVERY CODES\n")
            f.write("=" * 50 + "\n\n")
            f.write("Save these codes in a secure location.\n")
            f.write("Each code can be used once to log in.\n\n")
            for i, code in enumerate(recovery_codes, 1):
                f.write(f"{i}. {code}\n")
            f.write("\n" + "=" * 50 + "\n")
            f.write(
                "Generated: " + __import__("datetime").datetime.now().isoformat() + "\n"
            )

        print(f"✅ Recovery codes saved to: {output_path.absolute()}")
        return True
    except Exception as e:
        print(f"❌ Error saving recovery codes: {str(e)}")
        return False


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(
        description="Reset admin passkey for emergency access recovery"
    )
    parser.add_argument(
        "--force", action="store_true", help="Skip confirmation prompts"
    )
    parser.add_argument(
        "--save",
        nargs="?",
        const="recovery_codes.txt",
        help="Save recovery codes to file",
    )

    args = parser.parse_args()

    result = reset_admin_passkey(force=args.force)

    if result["success"] and args.save:
        save_recovery_codes(result["recovery_codes"], args.save)

    sys.exit(0 if result["success"] else 1)
