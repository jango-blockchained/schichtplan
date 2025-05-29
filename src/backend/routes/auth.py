from flask import Blueprint, request, jsonify, current_app
from datetime import datetime
from models import User, UserRole
from sqlalchemy.exc import SQLAlchemyError
from services.auth_service import generate_token, login_required, role_required
from utils.db_utils import session_manager

bp = Blueprint("auth", __name__, url_prefix="/api/v2/auth")


@bp.route("/register", methods=["POST"])
@role_required([UserRole.ADMIN])  # Only admins can create new users
def register():
    """
    Register a new user (admin only)
    """
    data = request.json

    # Validate required fields
    required_fields = ["username", "email", "password", "role"]
    for field in required_fields:
        if field not in data:
            return jsonify({"error": f"Missing required field: {field}"}), 400

    # Validate role
    try:
        role = UserRole(data["role"])
    except ValueError:
        return jsonify(
            {
                "error": f"Invalid role: {data['role']}",
                "valid_roles": [r.value for r in UserRole],
            }
        ), 400

    # Check if username or email already exists
    existing_user = User.query.filter(
        (User.username == data["username"]) | (User.email == data["email"])
    ).first()

    if existing_user:
        if existing_user.username == data["username"]:
            return jsonify({"error": "Username already exists"}), 400
        else:
            return jsonify({"error": "Email already exists"}), 400

    try:
        # Create new user
        with session_manager() as session:
            user = User(
                username=data["username"],
                email=data["email"],
                password=data["password"],
                role=role,
                employee_id=data.get("employee_id"),
                is_active=data.get("is_active", True),
            )
            session.add(user)

        return jsonify(
            {"message": "User created successfully", "user": user.to_dict()}
        ), 201

    except SQLAlchemyError as e:
        current_app.logger.error(f"Database error creating user: {str(e)}")
        return jsonify({"error": f"Database error: {str(e)}"}), 500

    except Exception as e:
        current_app.logger.error(f"Error creating user: {str(e)}")
        return jsonify({"error": str(e)}), 500


@bp.route("/login", methods=["POST"])
def login():
    """
    Authenticate user and return JWT token
    """
    data = request.json

    # Validate required fields
    if not data or "username" not in data or "password" not in data:
        return jsonify({"error": "Username and password required"}), 400

    # Find user by username
    user = User.query.filter_by(username=data["username"]).first()

    # Check if user exists and password is correct
    if not user or not user.check_password(data["password"]):
        return jsonify({"error": "Invalid username or password"}), 401

    # Check if user is active
    if not user.is_active:
        return jsonify({"error": "Account is disabled"}), 403

    # Generate JWT token
    token = generate_token(
        user.id,
        user.username,
        user.role.value,
        expiration_hours=data.get("expiration_hours", 24),
    )

    # Update last login timestamp
    try:
        with session_manager() as session:
            user.last_login = datetime.utcnow()
            session.add(user)

    except Exception as e:
        current_app.logger.error(f"Error updating last login: {str(e)}")
        # Continue with login even if updating timestamp fails

    return jsonify(
        {
            "message": "Login successful",
            "token": token,
            "user": user.to_dict(),
            "permissions": user.get_permissions(),
        }
    )


@bp.route("/profile", methods=["GET"])
@login_required
def get_profile():
    """
    Get current user profile
    """
    # request.current_user is set by the login_required decorator
    user = request.current_user

    return jsonify({"user": user.to_dict(), "permissions": user.get_permissions()})


@bp.route("/change-password", methods=["POST"])
@login_required
def change_password():
    """
    Change user password
    """
    data = request.json
    user = request.current_user

    # Validate required fields
    if not data or "current_password" not in data or "new_password" not in data:
        return jsonify({"error": "Current password and new password required"}), 400

    # Check current password
    if not user.check_password(data["current_password"]):
        return jsonify({"error": "Current password is incorrect"}), 401

    # Update password
    try:
        with session_manager() as session:
            user.set_password(data["new_password"])
            user.updated_at = datetime.utcnow()
            session.add(user)

        return jsonify({"message": "Password changed successfully"})

    except Exception as e:
        current_app.logger.error(f"Error changing password: {str(e)}")
        return jsonify({"error": str(e)}), 500


@bp.route("/users", methods=["GET"])
@role_required([UserRole.ADMIN, UserRole.MANAGER])
def get_users():
    """
    Get all users (admin/manager only)
    """
    users = User.query.all()

    return jsonify({"users": [user.to_dict() for user in users]})


@bp.route("/users/<int:user_id>", methods=["GET"])
@role_required([UserRole.ADMIN, UserRole.MANAGER])
def get_user(user_id):
    """
    Get user by ID (admin/manager only)
    """
    user = User.query.get_or_404(user_id)

    return jsonify({"user": user.to_dict()})


@bp.route("/users/<int:user_id>", methods=["PUT"])
@role_required([UserRole.ADMIN])
def update_user(user_id):
    """
    Update user (admin only)
    """
    data = request.json
    user = User.query.get_or_404(user_id)

    try:
        with session_manager() as session:
            # Update fields if provided
            if "username" in data:
                user.username = data["username"]

            if "email" in data:
                user.email = data["email"]

            if "role" in data:
                user.role = UserRole(data["role"])

            if "is_active" in data:
                user.is_active = data["is_active"]

            if "employee_id" in data:
                user.employee_id = data["employee_id"]

            # Optional password update
            if "password" in data and data["password"]:
                user.set_password(data["password"])

            user.updated_at = datetime.utcnow()
            session.add(user)

        return jsonify({"message": "User updated successfully", "user": user.to_dict()})

    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    except Exception as e:
        current_app.logger.error(f"Error updating user: {str(e)}")
        return jsonify({"error": str(e)}), 500


@bp.route("/users/<int:user_id>/regenerate-api-key", methods=["POST"])
@role_required([UserRole.ADMIN])
def regenerate_api_key(user_id):
    """
    Regenerate API key for user (admin only)
    """
    user = User.query.get_or_404(user_id)

    try:
        with session_manager() as session:
            new_api_key = user.regenerate_api_key()
            session.add(user)

        return jsonify(
            {
                "message": "API key regenerated successfully",
                "user": user.to_dict(include_api_key=True),
            }
        )

    except Exception as e:
        current_app.logger.error(f"Error regenerating API key: {str(e)}")
        return jsonify({"error": str(e)}), 500
