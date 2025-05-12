"""add_user_model

Revision ID: add_user_model
Revises: 
Create Date: 2023-11-01 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import sqlite

# revision identifiers, used by Alembic.
revision = 'add_user_model'
down_revision = None  # Update this to your previous migration ID if necessary
branch_labels = None
depends_on = None


def upgrade():
    # Create UserRole enum type
    # For SQLite, we use strings directly as it doesn't support enum types
    op.create_table(
        'users',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('username', sa.String(length=100), nullable=False),
        sa.Column('email', sa.String(length=120), nullable=False),
        sa.Column('password_hash', sa.String(length=256), nullable=False),
        sa.Column('role', sa.String(length=20), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, default=True),
        sa.Column('employee_id', sa.Integer(), nullable=True),
        sa.Column('api_key', sa.String(length=64), nullable=True),
        sa.Column('last_login', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['employee_id'], ['employees.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('username'),
        sa.UniqueConstraint('email'),
        sa.UniqueConstraint('api_key')
    )
    
    # Create an admin user
    op.execute(
        """
        INSERT INTO users (username, email, password_hash, role, is_active, created_at, updated_at)
        VALUES (
            'admin',
            'admin@example.com',
            'pbkdf2:sha256:600000$qMEWnzSqK9vS3FdN$51839ed0fe7b09a4ce7c9bb62c2d78dd99a3b0e9cef7fc8acc39a1b8a3cd0e9a',
            'ADMIN',
            1,
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
        )
        """
    )


def downgrade():
    op.drop_table('users')