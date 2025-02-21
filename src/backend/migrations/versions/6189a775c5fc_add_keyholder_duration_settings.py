"""Add keyholder duration settings

Revision ID: 6189a775c5fc
Revises: update_employee_and_absence_types
Create Date: 2025-02-21 04:39:38.366286

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '6189a775c5fc'
down_revision = 'update_employee_and_absence_types'
branch_labels = None
depends_on = None


def upgrade():
    # Create store_config table
    op.create_table('store_config',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('store_name', sa.String(length=100), nullable=False),
        sa.Column('keyholder_before_minutes', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('keyholder_after_minutes', sa.Integer(), nullable=False, server_default='0'),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Update employee_group type
    with op.batch_alter_table('employees', schema=None) as batch_op:
        batch_op.alter_column('employee_group',
               existing_type=sa.VARCHAR(length=50),
               type_=sa.Enum('VL', 'TZ', 'GFB', 'TL', name='employeegroup'),
               nullable=False)
    
    # Update shifts table
    with op.batch_alter_table('shifts', schema=None) as batch_op:
        batch_op.alter_column('active_days',
               existing_type=sa.TEXT(),
               type_=sa.JSON(),
               existing_nullable=False)


def downgrade():
    # Revert employee_group type
    with op.batch_alter_table('employees', schema=None) as batch_op:
        batch_op.alter_column('employee_group',
               existing_type=sa.Enum('VL', 'TZ', 'GFB', 'TL', name='employeegroup'),
               type_=sa.VARCHAR(length=50),
               nullable=True)
    
    # Drop store_config table
    op.drop_table('store_config')
    
    # Revert shifts table
    with op.batch_alter_table('shifts', schema=None) as batch_op:
        batch_op.alter_column('active_days',
               existing_type=sa.JSON(),
               type_=sa.TEXT(),
               existing_nullable=False)
