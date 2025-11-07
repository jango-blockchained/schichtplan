"""
Setup routes for first-time application setup.
Handles passkey registration, recovery codes, and AI API key configuration.
"""

import json
import secrets
from datetime import datetime
from pathlib import Path

from flask import Blueprint, current_app, jsonify, request
from webauthn import (
    generate_registration_options,
    options_to_json,
    verify_registration_response,
)
from webauthn.helpers import base64url_to_bytes, bytes_to_base64url
from webauthn.helpers.structs import (
    AuthenticatorAttestationResponse,
    RegistrationCredential,
)

from src.backend.models import Settings, User, UserRole, db
from src.backend.services.auth_service import generate_token
from src.backend.utils.logger import logger

bp = Blueprint("setup", __name__, url_prefix="/api/v2/setup")


@bp.route("/status", methods=["GET"])
def get_setup_status():
    """
    Check if the initial setup has been completed.

    Returns:
        - setup_completed: True if setup is done
        - admin_exists: True if an admin user exists
        - needs_setup: True if setup wizard should be shown
    """
    try:
        # Check if any admin user exists
        admin_user = User.query.filter_by(role=UserRole.ADMIN).first()

        # Check settings
        settings = Settings.query.first()
        setup_completed = settings.initial_setup_completed if settings else False

        # Setup is needed if no admin exists or setup not marked complete
        needs_setup = not admin_user or not setup_completed

        return jsonify(
            {
                "setup_completed": setup_completed,
                "admin_exists": bool(admin_user),
                "needs_setup": needs_setup,
            }
        )
    except Exception as e:
        logger.error(f"Error checking setup status: {str(e)}")
        return jsonify({"error": str(e)}), 500


@bp.route("/init-passkey", methods=["POST"])
def init_passkey_registration():
    """
    Initialize passkey registration for the admin user.

    Expected JSON:
        {
            "username": "admin",
            "email": "admin@example.com"
        }

    Returns:
        Registration options for WebAuthn client
    """
    try:
        data = request.json

        if not data or "username" not in data or "email" not in data:
            return jsonify({"error": "Username and email required"}), 400

        username = data["username"]
        email = data["email"]

        # Check if admin already exists
        existing_admin = User.query.filter_by(role=UserRole.ADMIN).first()
        if existing_admin and existing_admin.setup_completed:
            return jsonify({"error": "Setup already completed"}), 400

        # Generate registration options
        # In production, you should use your actual RP ID (domain)
        rp_id = current_app.config.get("WEBAUTHN_RP_ID", "localhost")
        rp_name = current_app.config.get("WEBAUTHN_RP_NAME", "Schichtplan")

        # Generate a user handle (unique identifier)
        user_handle = f"user_{username}".encode()

        registration_options = generate_registration_options(
            rp_id=rp_id,
            rp_name=rp_name,
            user_id=user_handle,
            user_name=username,
            user_display_name=username,
            exclude_credentials=[],  # No existing credentials for first setup
        )

        # Store challenge in session for verification
        # In production, use a more secure method (Redis, database, etc.)
        challenge = registration_options.challenge

        # Store registration state temporarily (in production, use cache/session)
        registration_state = {
            "challenge": bytes_to_base64url(challenge),
            "username": username,
            "email": email,
            "timestamp": datetime.utcnow().isoformat(),
        }

        # For simplicity, we'll store this in app config (NOT production-ready)
        # In production, use Redis or similar
        if not hasattr(current_app, "passkey_challenges"):
            current_app.passkey_challenges = {}

        current_app.passkey_challenges[username] = registration_state

        # Convert to JSON-serializable format
        options_json = options_to_json(registration_options)

        return jsonify(json.loads(options_json))

    except Exception as e:
        logger.error(f"Error initializing passkey registration: {str(e)}")
        return jsonify({"error": str(e)}), 500


@bp.route("/complete-passkey", methods=["POST"])
def complete_passkey_registration():
    """
    Complete passkey registration and create admin user.

    Expected JSON:
        {
            "username": "admin",
            "credential": <WebAuthn credential response>
        }

    Returns:
        User data and recovery codes
    """
    try:
        data = request.json

        if not data or "username" not in data or "credential" not in data:
            return jsonify({"error": "Username and credential required"}), 400

        username = data["username"]
        credential_data = data["credential"]

        # Retrieve stored challenge
        if (
            not hasattr(current_app, "passkey_challenges")
            or username not in current_app.passkey_challenges
        ):
            return jsonify({"error": "Registration not initialized"}), 400

        registration_state = current_app.passkey_challenges[username]
        expected_challenge = base64url_to_bytes(registration_state["challenge"])
        email = registration_state["email"]

        # Verify the registration response
        rp_id = current_app.config.get("WEBAUTHN_RP_ID", "localhost")
        expected_origin = current_app.config.get(
            "WEBAUTHN_ORIGIN", "http://localhost:5173"
        )

        # Parse credential - convert dict to RegistrationCredential
        try:
            # Extract response data and convert from base64url to bytes
            response_data = credential_data.get("response", {})
            client_data_json = base64url_to_bytes(
                response_data.get("clientDataJSON", "")
            )
            attestation_object = base64url_to_bytes(
                response_data.get("attestationObject", "")
            )

            # Create AuthenticatorAttestationResponse
            attestation_response = AuthenticatorAttestationResponse(
                client_data_json=client_data_json,
                attestation_object=attestation_object,
                transports=response_data.get("transports", []),
            )

            # Create RegistrationCredential
            registration_credential = RegistrationCredential(
                id=credential_data.get("id"),
                raw_id=base64url_to_bytes(credential_data.get("rawId", "")),
                response=attestation_response,
                type=credential_data.get("type", "public-key"),
            )
        except Exception as e:
            logger.error(f"Error parsing credential: {str(e)}")
            return jsonify({"error": f"Invalid credential format: {str(e)}"}), 400

        verification = verify_registration_response(
            credential=registration_credential,
            expected_challenge=expected_challenge,
            expected_origin=expected_origin,
            expected_rp_id=rp_id,
        )

        # Create or update admin user
        admin_user = User.query.filter_by(username=username).first()

        if not admin_user:
            # Create new admin user
            # For passkey-only auth, we still need a password field
            # (set to random string)
            random_password = secrets.token_urlsafe(32)

            admin_user = User(
                username=username,
                email=email,
                password=random_password,
                role=UserRole.ADMIN,
                is_active=True,
            )
            db.session.add(admin_user)

        # Store WebAuthn credential
        credential_record = {
            "credential_id": bytes_to_base64url(verification.credential_id),
            "credential_public_key": bytes_to_base64url(
                verification.credential_public_key
            ),
            "sign_count": verification.sign_count,
            "transports": credential_data.get("response", {}).get("transports", []),
            "created_at": datetime.utcnow().isoformat(),
        }

        admin_user.add_webauthn_credential(credential_record)

        # Generate recovery codes
        recovery_codes = admin_user.generate_recovery_codes(count=4)

        # Mark setup as started (will be completed after AI keys step)
        admin_user.setup_completed = False
        admin_user.last_login = datetime.utcnow()

        db.session.commit()

        # Clean up challenge
        del current_app.passkey_challenges[username]

        logger.info(f"Passkey registration completed for user: {username}")

        return jsonify(
            {
                "message": "Passkey registered successfully",
                "user": admin_user.to_dict(),
                "recovery_codes": recovery_codes,
            }
        ), 201

    except Exception as e:
        db.session.rollback()
        logger.error(f"Error completing passkey registration: {str(e)}")
        return jsonify({"error": str(e)}), 500


@bp.route("/configure-ai", methods=["POST"])
def configure_ai_keys():
    """
    Configure AI API keys (optional step).

    Expected JSON:
        {
            "api_keys": {
                "gemini": "key...",
                "openai": "key...",
                "anthropic": "key..."
            },
            "provider": "gemini",  # default provider
            "enabled": true
        }
    """
    try:
        data = request.json

        # Check if admin user exists
        admin_user = User.query.filter_by(role=UserRole.ADMIN).first()
        if not admin_user:
            return jsonify({"error": "Admin user not found"}), 404

        # Get or create settings
        settings = Settings.get_or_create_default()

        # Update AI scheduling settings
        ai_config = settings.ai_scheduling or {}

        if data and "api_keys" in data:
            # Update API keys
            ai_config["api_keys"] = ai_config.get("api_keys", {})
            for provider, key in data["api_keys"].items():
                if key:  # Only update if key is provided
                    ai_config["api_keys"][provider] = key

        if data and "provider" in data:
            ai_config["provider"] = data["provider"]

        if data and "enabled" in data:
            ai_config["enabled"] = bool(data["enabled"])

        settings.ai_scheduling = ai_config
        db.session.commit()

        logger.info("AI API keys configured")

        return jsonify(
            {
                "message": "AI configuration saved",
                "ai_enabled": ai_config.get("enabled", False),
            }
        )

    except Exception as e:
        db.session.rollback()
        logger.error(f"Error configuring AI keys: {str(e)}")
        return jsonify({"error": str(e)}), 500


@bp.route("/complete", methods=["POST"])
def complete_setup():
    """
    Mark the setup process as completed.
    """
    try:
        # Check if admin user exists
        admin_user = User.query.filter_by(role=UserRole.ADMIN).first()
        if not admin_user:
            return jsonify({"error": "Admin user not found"}), 404

        # Mark user setup as completed
        admin_user.setup_completed = True

        # Mark global setup as completed
        settings = Settings.get_or_create_default()
        settings.initial_setup_completed = True

        db.session.commit()

        logger.info("Initial setup completed")

        return jsonify(
            {
                "message": "Setup completed successfully",
                "user": admin_user.to_dict(),
            }
        )

    except Exception as e:
        db.session.rollback()
        logger.error(f"Error completing setup: {str(e)}")
        return jsonify({"error": str(e)}), 500


@bp.route("/recovery-code/verify", methods=["POST"])
def verify_recovery_code():
    """
    Verify a recovery code for authentication.

    Expected JSON:
        {
            "username": "admin",
            "recovery_code": "XXXXXXXXXXXX"
        }
    """
    try:
        data = request.json

        if not data or "username" not in data or "recovery_code" not in data:
            return jsonify({"error": "Username and recovery code required"}), 400

        username = data["username"]
        recovery_code = data["recovery_code"]

        # Find user
        user = User.query.filter_by(username=username).first()
        if not user:
            return jsonify({"error": "Invalid username or recovery code"}), 401

        # Verify recovery code
        if not user.verify_recovery_code(recovery_code):
            return jsonify({"error": "Invalid username or recovery code"}), 401

        # Update last login
        user.last_login = datetime.utcnow()
        db.session.commit()

        # Generate session token (reuse existing JWT logic)
        role_value = user.role.value if hasattr(user.role, "value") else str(user.role)
        token = generate_token(
            user.id,
            user.username,
            role_value,
            expiration_hours=24,
        )

        logger.info(f"Recovery code auth successful for user: {username}")

        return jsonify(
            {
                "message": "Authentication successful",
                "token": token,
                "user": user.to_dict(),
                "remaining_recovery_codes": (user.get_remaining_recovery_codes_count()),
            }
        )

    except Exception as e:
        db.session.rollback()
        logger.error(f"Error verifying recovery code: {str(e)}")
        return jsonify({"error": str(e)}), 500


@bp.route("/reset-admin-passkey", methods=["POST"])
def reset_admin_passkey():
    """
    Reset the admin passkey and generate new recovery codes.
    This is useful for regaining access if the passkey is lost.

    Returns:
        New recovery codes
    """
    try:
        # Get the admin user
        admin_user = User.query.filter_by(role=UserRole.ADMIN).first()

        if not admin_user:
            return jsonify({"error": "No admin user exists"}), 400

        # Clear existing credentials and codes
        admin_user.webauthn_credentials = None

        # Generate new recovery codes
        recovery_codes = admin_user.generate_recovery_codes(count=4)

        # Save changes
        db.session.commit()

        logger.info("Admin passkey has been reset successfully")

        return jsonify(
            {
                "message": "Admin passkey has been reset. New recovery codes have been generated.",
                "recovery_codes": recovery_codes,
            }
        )

    except Exception as e:
        db.session.rollback()
        logger.error(f"Error resetting admin passkey: {str(e)}")
        return jsonify({"error": str(e)}), 500


@bp.route("/reset-token", methods=["POST"])
def generate_reset_token():
    """
    Generate a reset token file for offline passkey reset.
    This creates a file in the instance directory with a one-time token.

    Returns:
        Path to the token file and instructions
    """
    try:
        # Generate a secure random token
        token = secrets.token_urlsafe(32)

        # Create token file in instance directory
        instance_dir = Path(current_app.config.get("INSTANCE_PATH", "instance"))
        token_dir = instance_dir / "reset_tokens"
        token_dir.mkdir(exist_ok=True)

        token_file = token_dir / f"reset_token_{token}.txt"

        # Write token file with instructions
        with open(token_file, "w") as f:
            f.write("SCHICHTPLAN ADMIN PASSKEY RESET TOKEN\n")
            f.write("=" * 60 + "\n\n")
            f.write(f"Token: {token}\n\n")
            f.write("To reset the admin passkey using this token:\n\n")
            f.write("1. Via CLI:\n")
            reset_cmd = "python src/backend/tools/reset_admin_passkey.py --force\n\n"
            f.write(f"   {reset_cmd}")
            f.write("2. Via API (if accessible):\n")
            f.write("   POST /api/v2/setup/reset-with-token\n")
            f.write(f"   Body: {{'reset_token': '{token}'}}\n\n")
            f.write("Token expires: Never (keep this file secure)\n")
            f.write(f"Generated: {datetime.utcnow().isoformat()}\n")

        logger.info(f"Reset token generated: {token_file}")

        return jsonify(
            {
                "message": "Reset token generated successfully",
                "token_file": str(token_file),
                "instructions": (
                    "A reset token file has been created. "
                    "Keep this file in a secure location. "
                    "It can be used to reset the admin passkey in emergency situations."
                ),
            }
        )

    except Exception as e:
        logger.error(f"Error generating reset token: {str(e)}")
        return jsonify({"error": str(e)}), 500


@bp.route("/reset-with-token", methods=["POST"])
def reset_with_token():
    """
    Reset admin passkey using a previously generated reset token.
    For emergency access recovery.

    Expected JSON:
        {
            "reset_token": "token_string"
        }
    """
    try:
        data = request.json
        if not data or "reset_token" not in data:
            return jsonify({"error": "reset_token required"}), 400

        reset_token = data["reset_token"].strip()

        # Verify token file exists
        instance_dir = Path(current_app.config.get("INSTANCE_PATH", "instance"))
        token_file = instance_dir / "reset_tokens" / f"reset_token_{reset_token}.txt"

        if not token_file.exists():
            logger.warning(f"Invalid reset token attempt: {reset_token[:10]}...")
            return (
                jsonify({"error": "Invalid or expired reset token"}),
                400,
            )

        # Get admin user
        admin_user = User.query.filter_by(role=UserRole.ADMIN).first()

        if not admin_user:
            return jsonify({"error": "No admin user exists"}), 400

        # Clear credentials and generate new codes
        admin_user.webauthn_credentials = None
        recovery_codes = admin_user.generate_recovery_codes(count=4)

        db.session.commit()

        # Consume the token (delete the file)
        token_file.unlink()

        logger.info(f"Admin passkey reset via token for user: {admin_user.username}")

        return jsonify(
            {
                "message": (
                    "Admin passkey has been reset. "
                    "New recovery codes have been generated. "
                    "Use them to log in and re-register a passkey."
                ),
                "recovery_codes": recovery_codes,
            }
        )

    except Exception as e:
        db.session.rollback()
        logger.error(f"Error resetting with token: {str(e)}")
        return jsonify({"error": str(e)}), 500
