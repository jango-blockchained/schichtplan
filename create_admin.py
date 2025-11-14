#!/usr/bin/env python3
"""
Create an admin user for development/testing
Usage: python create_admin.py [username] [password] [email]
"""

import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

from src.backend.app import create_app
from src.backend.models import Settings, User, UserRole, db


def create_admin_user(username="admin", password="admin123", email="admin@example.com"):
    """Create an admin user"""
    app = create_app()

    with app.app_context():
        # Check if user already exists
        existing_user = User.query.filter_by(username=username).first()
        if existing_user:
            print(f"❌ User '{username}' already exists")
            print(f"   ID: {existing_user.id}")
            print(f"   Email: {existing_user.email}")
            print(f"   Role: {existing_user.role.value}")
            print(f"   Active: {existing_user.is_active}")
            return False

        # Create new admin user
        user = User(
            username=username,
            email=email,
            password=password,
            role=UserRole.ADMIN,
            is_active=True,
        )
        user.setup_completed = True  # Mark as set up

        db.session.add(user)
        db.session.commit()

        # Update settings to mark setup as completed
        settings = Settings.query.first()
        if settings:
            settings.initial_setup_completed = True
            db.session.commit()

        print("✅ Admin user created successfully!")
        print(f"   Username: {username}")
        print(f"   Password: {password}")
        print(f"   Email: {email}")
        print("   Role: ADMIN")
        print(f"   ID: {user.id}")
        print(f"   API Key: {user.api_key}")
        print()
        print("🔐 You can now log in with these credentials at /login")

        return True


if __name__ == "__main__":
    # Get arguments from command line or use defaults
    username = sys.argv[1] if len(sys.argv) > 1 else "admin"
    password = sys.argv[2] if len(sys.argv) > 2 else "admin123"
    email = sys.argv[3] if len(sys.argv) > 3 else "admin@example.com"

    create_admin_user(username, password, email)
