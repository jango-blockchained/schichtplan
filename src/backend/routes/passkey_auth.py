"""
Passkey authentication routes for WebAuthn login.
"""

import json
from datetime import datetime

from flask import Blueprint, current_app, jsonify, request
from webauthn import (
    generate_authentication_options,
    options_to_json,
    verify_authentication_response,
)
from webauthn.helpers import base64url_to_bytes, bytes_to_base64url
from webauthn.helpers.structs import (
    AuthenticationCredential,
    AuthenticatorAssertionResponse,
    AuthenticatorTransport,
    PublicKeyCredentialDescriptor,
)

from src.backend.models import User, db
from src.backend.services.auth_service import generate_token
from src.backend.utils.logger import logger

bp = Blueprint("passkey_auth", __name__, url_prefix="/api/v2/auth/passkey")


@bp.route("/init-login", methods=["POST"])
def init_passkey_login():
    """
    Initialize passkey authentication.

    Expected JSON:
        {
            "username": "admin"
        }

    Returns:
        Authentication options for WebAuthn client
    """
    try:
        data = request.json

        if not data or "username" not in data:
            return jsonify({"error": "Username required"}), 400

        username = data["username"]

        # Find user
        user = User.query.filter_by(username=username).first()
        if not user or not user.is_active:
            # Don't reveal if user exists
            return jsonify({"error": "Invalid username"}), 401

        # Get user's credentials
        credentials = user.get_webauthn_credentials()
        if not credentials:
            return jsonify({"error": "No passkey registered for this user"}), 400

        # Build list of allowed credentials
        allow_credentials = []
        for cred in credentials:
            # Convert transport strings to AuthenticatorTransport enums
            transports = []
            for transport in cred.get("transports", []):
                if isinstance(transport, str):
                    try:
                        transports.append(AuthenticatorTransport(transport))
                    except ValueError:
                        # Skip invalid transports
                        pass
                else:
                    transports.append(transport)

            allow_credentials.append(
                PublicKeyCredentialDescriptor(
                    id=base64url_to_bytes(cred["credential_id"]),
                    transports=transports,
                )
            )

        # Generate authentication options
        rp_id = current_app.config.get("WEBAUTHN_RP_ID", "localhost")

        authentication_options = generate_authentication_options(
            rp_id=rp_id,
            allow_credentials=allow_credentials,
        )

        # Store challenge for verification
        challenge = authentication_options.challenge

        auth_state = {
            "challenge": bytes_to_base64url(challenge),
            "username": username,
            "timestamp": datetime.utcnow().isoformat(),
        }

        # Store in app (NOT production-ready, use Redis/cache in production)
        if not hasattr(current_app, "passkey_auth_challenges"):
            current_app.passkey_auth_challenges = {}

        current_app.passkey_auth_challenges[username] = auth_state

        # Convert to JSON
        options_json = options_to_json(authentication_options)

        return jsonify(json.loads(options_json))

    except Exception as e:
        logger.error(f"Error initializing passkey login: {str(e)}")
        return jsonify({"error": str(e)}), 500


@bp.route("/complete-login", methods=["POST"])
def complete_passkey_login():
    """
    Complete passkey authentication.

    Expected JSON:
        {
            "username": "admin",
            "credential": <WebAuthn credential response>
        }

    Returns:
        JWT token and user data
    """
    try:
        data = request.json

        if not data or "username" not in data or "credential" not in data:
            return jsonify({"error": "Username and credential required"}), 400

        username = data["username"]
        credential_data = data["credential"]

        # Retrieve stored challenge
        if (
            not hasattr(current_app, "passkey_auth_challenges")
            or username not in current_app.passkey_auth_challenges
        ):
            return jsonify({"error": "Authentication not initialized"}), 400

        auth_state = current_app.passkey_auth_challenges[username]
        expected_challenge = base64url_to_bytes(auth_state["challenge"])

        # Find user
        user = User.query.filter_by(username=username).first()
        if not user or not user.is_active:
            return jsonify({"error": "Authentication failed"}), 401

        # Get stored credentials
        credentials = user.get_webauthn_credentials()
        if not credentials:
            return jsonify({"error": "No passkey registered"}), 401

        # Find the credential being used
        credential_id = credential_data.get("id")
        if not credential_id:
            return jsonify({"error": "Invalid credential"}), 400

        # Find matching credential
        stored_credential = None
        for cred in credentials:
            if cred["credential_id"] == credential_id:
                stored_credential = cred
                break

        if not stored_credential:
            return jsonify({"error": "Credential not found"}), 401

        # Verify the authentication response
        rp_id = current_app.config.get("WEBAUTHN_RP_ID", "localhost")
        expected_origin = current_app.config.get(
            "WEBAUTHN_ORIGIN", "http://localhost:5173"
        )

        # Parse credential - convert dict to AuthenticationCredential
        try:
            # Extract response data and convert from base64url to bytes
            response_data = credential_data.get("response", {})
            client_data_json = base64url_to_bytes(
                response_data.get("clientDataJSON", "")
            )
            authenticator_data = base64url_to_bytes(
                response_data.get("authenticatorData", "")
            )
            signature = base64url_to_bytes(response_data.get("signature", ""))

            # Create AuthenticatorAssertionResponse
            assertion_response = AuthenticatorAssertionResponse(
                client_data_json=client_data_json,
                authenticator_data=authenticator_data,
                signature=signature,
                user_handle=response_data.get("userHandle"),
            )

            # Create AuthenticationCredential
            authentication_credential = AuthenticationCredential(
                id=credential_data.get("id"),
                raw_id=base64url_to_bytes(credential_data.get("rawId", "")),
                response=assertion_response,
                type=credential_data.get("type", "public-key"),
            )
        except Exception as e:
            logger.error(f"Error parsing credential: {str(e)}")
            return jsonify({"error": f"Invalid credential format: {str(e)}"}), 400

        verification = verify_authentication_response(
            credential=authentication_credential,
            expected_challenge=expected_challenge,
            expected_origin=expected_origin,
            expected_rp_id=rp_id,
            credential_public_key=base64url_to_bytes(
                stored_credential["credential_public_key"]
            ),
            credential_current_sign_count=stored_credential.get("sign_count", 0),
        )

        # Update sign count
        stored_credential["sign_count"] = verification.new_sign_count
        stored_credential["last_used"] = datetime.utcnow().isoformat()

        # Update user's credentials
        user.webauthn_credentials = json.dumps(credentials)

        # Update last login
        user.last_login = datetime.utcnow()
        db.session.commit()

        # Clean up challenge
        del current_app.passkey_auth_challenges[username]

        # Generate JWT token
        role_value = user.role.value if hasattr(user.role, "value") else str(user.role)
        token = generate_token(
            user.id,
            user.username,
            role_value,
            expiration_hours=24,
        )

        logger.info(f"Passkey authentication successful for user: {username}")

        return jsonify(
            {
                "message": "Authentication successful",
                "token": token,
                "user": user.to_dict(),
            }
        )

    except Exception as e:
        db.session.rollback()
        logger.error(f"Error completing passkey login: {str(e)}")
        return jsonify({"error": str(e)}), 500


@bp.route("/check-daily-login", methods=["GET"])
def check_daily_login():
    """
    Check if user needs to log in today.
    Requires existing JWT token.

    Returns:
        - needs_login: True if user needs to authenticate today
        - last_login: Timestamp of last login
    """
    try:
        from src.backend.services.auth_service import get_current_user

        user = get_current_user()
        if not user:
            return jsonify({"error": "Authentication required"}), 401

        # Check if user has logged in today
        needs_login = False
        if user.last_login:
            today = datetime.utcnow().date()
            last_login_date = user.last_login.date()
            needs_login = last_login_date < today
        else:
            needs_login = True

        return jsonify(
            {
                "needs_login": needs_login,
                "last_login": user.last_login.isoformat() if user.last_login else None,
            }
        )

    except Exception as e:
        logger.error(f"Error checking daily login: {str(e)}")
        return jsonify({"error": str(e)}), 500
