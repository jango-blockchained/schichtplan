import jwt
from datetime import datetime, timedelta, UTC
from flask import current_app, request
from functools import wraps
from typing import Dict, Optional, Callable, Any, List, Union
from models import User, UserRole
import logging
from src.backend.models import db

logger = logging.getLogger(__name__)


def generate_token(
    user_id: int, username: str, role: str, expiration_hours: int = 24
) -> str:
    """
    Generate a JWT token for the user

    Args:
        user_id: User ID
        username: Username
        role: User role (from UserRole enum)
        expiration_hours: Token expiration time in hours

    Returns:
        JWT token string
    """
    expiration = datetime.now(UTC) + timedelta(hours=expiration_hours)

    payload = {
        "exp": expiration,
        "iat": datetime.now(UTC),
        "sub": user_id,
        "username": username,
        "role": role,
    }

    return jwt.encode(
        payload, current_app.config.get("SECRET_KEY", "dev-key"), algorithm="HS256"
    )


def decode_token(token: str) -> Dict:
    """
    Decode and verify a JWT token

    Args:
        token: JWT token string

    Returns:
        Decoded token payload

    Raises:
        jwt.InvalidTokenError: If token is invalid
        jwt.ExpiredSignatureError: If token has expired
    """
    return jwt.decode(
        token, current_app.config.get("SECRET_KEY", "dev-key"), algorithms=["HS256"]
    )


def extract_token_from_request() -> Optional[str]:
    """
    Extract JWT token from request headers or query parameters

    Returns:
        Token string if found, None otherwise
    """
    # Check Authorization header
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        return auth_header.split(" ")[1]

    # Check for token in query parameters
    token = request.args.get("token")
    if token:
        return token

    # Check for token in cookies
    token = request.cookies.get("auth_token")
    if token:
        return token

    return None


def get_current_user() -> Optional[User]:
    """
    Get current user based on JWT token in the request

    Returns:
        User object if valid token exists, None otherwise
    """
    token = extract_token_from_request()
    if not token:
        return None

    try:
        payload = decode_token(token)
        user_id = payload.get("sub")
        if not user_id:
            return None

        # Get user from database
        user = db.session.get(User, user_id)
        if not user or not user.is_active:
            return None

        return user
    except jwt.PyJWTError as e:
        logger.error(f"Token validation error: {str(e)}")
        return None


def login_required(f: Callable) -> Callable:
    """
    Decorator to require valid JWT token for route
    """

    @wraps(f)
    def decorated(*args: Any, **kwargs: Any) -> Any:
        user = get_current_user()
        if not user:
            return {"error": "Authentication required"}, 401

        # Add user to request context
        request.current_user = user
        return f(*args, **kwargs)

    return decorated


def role_required(allowed_roles: List[Union[str, UserRole]]) -> Callable:
    """
    Decorator to require specific role(s) for route

    Args:
        allowed_roles: List of allowed roles
    """

    def decorator(f: Callable) -> Callable:
        @wraps(f)
        def decorated(*args: Any, **kwargs: Any) -> Any:
            user = get_current_user()
            if not user:
                return {"error": "Authentication required"}, 401

            # Convert roles to strings for comparison if needed
            role_values = [
                r.value if isinstance(r, UserRole) else r for r in allowed_roles
            ]

            if user.role.value not in role_values:
                return {
                    "error": "Permission denied",
                    "required_roles": role_values,
                    "your_role": user.role.value,
                }, 403

            # Add user to request context
            request.current_user = user
            return f(*args, **kwargs)

        return decorated

    return decorator


def permission_required(required_permission: str) -> Callable:
    """
    Decorator to require specific permission for route

    Args:
        required_permission: Permission string
    """

    def decorator(f: Callable) -> Callable:
        @wraps(f)
        def decorated(*args: Any, **kwargs: Any) -> Any:
            user = get_current_user()
            if not user:
                return {"error": "Authentication required"}, 401

            if not user.has_permission(required_permission):
                return {
                    "error": "Permission denied",
                    "required_permission": required_permission,
                    "your_permissions": user.get_permissions(),
                }, 403

            # Add user to request context
            request.current_user = user
            return f(*args, **kwargs)

        return decorated

    return decorator


def verify_api_key(f: Callable) -> Callable:
    """
    Decorator to verify API key for route
    """

    @wraps(f)
    def decorated(*args: Any, **kwargs: Any) -> Any:
        api_key = request.headers.get("X-API-Key")
        if not api_key:
            return {"error": "API key required"}, 401

        # Get user from database
        user = User.query.filter_by(api_key=api_key, is_active=True).first()
        if not user:
            return {"error": "Invalid API key"}, 401

        # Add user to request context
        request.current_user = user
        return f(*args, **kwargs)

    return decorated
