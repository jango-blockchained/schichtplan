import json
import secrets
import uuid
from datetime import datetime
from enum import Enum

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum as SQLEnum,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import relationship
from werkzeug.security import check_password_hash, generate_password_hash

from . import db


class UserRole(str, Enum):
    ADMIN = "ADMIN"  # Full access to all features
    MANAGER = "MANAGER"  # Access to schedule creation and employee management
    SUPERVISOR = "SUPERVISOR"  # Access to schedule viewing and editing
    EMPLOYEE = "EMPLOYEE"  # Access to own schedule and availability
    READONLY = "READONLY"  # View-only access


class User(db.Model):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    username = Column(String(100), unique=True, nullable=False)
    email = Column(String(120), unique=True, nullable=False)
    password_hash = Column(String(256), nullable=False)
    role = Column(SQLEnum(UserRole), nullable=False, default=UserRole.EMPLOYEE)
    is_active = Column(Boolean, nullable=False, default=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=True)
    api_key = Column(String(64), unique=True, nullable=True)
    last_login = Column(DateTime, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(
        DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # Passkey/WebAuthn fields
    webauthn_credentials = Column(Text, nullable=True)  # JSON array of credentials

    # Recovery codes (hashed)
    recovery_codes = Column(Text, nullable=True)  # JSON array of hashed codes

    # Setup completion flag
    setup_completed = Column(Boolean, nullable=False, default=False)

    # Relationship to Employee model (one-to-one)
    employee = relationship("Employee", backref="user", uselist=False)

    def __init__(
        self,
        username,
        email,
        password,
        role=UserRole.EMPLOYEE,
        employee_id=None,
        is_active=True,
    ):
        self.username = username
        self.email = email.lower()
        self.set_password(password)
        self.role = role
        self.employee_id = employee_id
        self.is_active = is_active
        self.api_key = self._generate_api_key()

    def set_password(self, password):
        """Set password hash from plaintext password"""
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        """Verify password against stored hash"""
        return check_password_hash(self.password_hash, password)

    def _generate_api_key(self):
        """Generate a unique API key for this user"""
        return str(uuid.uuid4())

    def regenerate_api_key(self):
        """Generate a new API key and invalidate the old one"""
        self.api_key = self._generate_api_key()
        self.updated_at = datetime.utcnow()
        return self.api_key

    def add_webauthn_credential(self, credential_data):
        """Add a WebAuthn credential to the user"""
        credentials = self.get_webauthn_credentials()
        credentials.append(credential_data)
        self.webauthn_credentials = json.dumps(credentials)
        self.updated_at = datetime.utcnow()

    def get_webauthn_credentials(self):
        """Get list of WebAuthn credentials"""
        if not self.webauthn_credentials:
            return []
        try:
            return json.loads(self.webauthn_credentials)
        except (json.JSONDecodeError, TypeError):
            return []

    def generate_recovery_codes(self, count=4):
        """Generate recovery codes and return unhashed versions"""
        codes = []
        hashed_codes = []

        for _ in range(count):
            # Generate a 12-character alphanumeric code
            code = secrets.token_urlsafe(9)[:12].upper()
            codes.append(code)
            # Store hashed version
            hashed_codes.append(generate_password_hash(code))

        self.recovery_codes = json.dumps(hashed_codes)
        self.updated_at = datetime.utcnow()

        return codes

    def verify_recovery_code(self, code):
        """Verify a recovery code and invalidate it if valid"""
        if not self.recovery_codes:
            return False

        try:
            hashed_codes = json.loads(self.recovery_codes)
        except (json.JSONDecodeError, TypeError):
            return False

        # Check each hashed code
        for i, hashed_code in enumerate(hashed_codes):
            if check_password_hash(hashed_code, code):
                # Remove the used code
                hashed_codes.pop(i)
                self.recovery_codes = json.dumps(hashed_codes)
                self.updated_at = datetime.utcnow()
                return True

        return False

    def get_remaining_recovery_codes_count(self):
        """Get the count of remaining recovery codes"""
        if not self.recovery_codes:
            return 0
        try:
            hashed_codes = json.loads(self.recovery_codes)
            return len(hashed_codes)
        except (json.JSONDecodeError, TypeError):
            return 0

    def get_permissions(self):
        """Get list of permissions based on role"""
        permissions_map = {
            UserRole.ADMIN: [
                "view_all",
                "create_all",
                "edit_all",
                "delete_all",
                "manage_users",
                "export_data",
                "generate_schedule",
            ],
            UserRole.MANAGER: [
                "view_all",
                "create_schedule",
                "edit_schedule",
                "manage_employees",
                "export_data",
                "generate_schedule",
            ],
            UserRole.SUPERVISOR: ["view_all", "edit_schedule", "export_data"],
            UserRole.EMPLOYEE: ["view_own", "edit_availability"],
            UserRole.READONLY: ["view_all"],
        }

        # Handle both Enum and string roles
        role = self.role
        if isinstance(role, str):
            try:
                role = UserRole(role)
            except ValueError:
                # Invalid role, return empty permissions
                return []

        return permissions_map.get(role, [])

    def has_permission(self, permission):
        """Check if user has specific permission"""
        return permission in self.get_permissions()

    def can_access_employee(self, employee_id):
        """Check if user can access data for a specific employee"""
        # Admin, manager, and supervisor can access all employees
        if self.role in [UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPERVISOR]:
            return True
        # Employees can only access their own data
        return self.employee_id == employee_id

    def to_dict(self, include_api_key=False):
        """Convert user object to dictionary for JSON serialization"""
        role_value = self.role.value if hasattr(self.role, "value") else str(self.role)
        result = {
            "id": self.id,
            "username": self.username,
            "email": self.email,
            "role": role_value,
            "is_active": self.is_active,
            "employee_id": self.employee_id,
            "permissions": self.get_permissions(),
            "last_login": (self.last_login.isoformat() if self.last_login else None),
            "created_at": (self.created_at.isoformat() if self.created_at else None),
            "updated_at": (self.updated_at.isoformat() if self.updated_at else None),
            "setup_completed": self.setup_completed,
            "has_passkey": bool(self.webauthn_credentials),
            "remaining_recovery_codes": (self.get_remaining_recovery_codes_count()),
        }

        if include_api_key:
            result["api_key"] = self.api_key

        return result

    def __repr__(self):
        role_value = self.role.value if hasattr(self.role, "value") else str(self.role)
        return f"<User {self.username}: {role_value}>"
