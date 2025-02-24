"""Make shift_id nullable

Revision ID: make_shift_id_nullable
Create Date: 2025-02-23 18:45:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'make_shift_id_nullable'
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    # Drop the existing foreign key constraint
    op.drop_constraint('schedules_shift_id_fkey', 'schedules', type_='foreignkey')
    
    # Modify the column to be nullable
    op.alter_column('schedules', 'shift_id',
                    existing_type=sa.Integer(),
                    nullable=True)
    
    # Re-add the foreign key constraint with ON DELETE SET NULL
    op.create_foreign_key(
        'schedules_shift_id_fkey',
        'schedules', 'shifts',
        ['shift_id'], ['id'],
        ondelete='SET NULL'
    )

def downgrade():
    # First, remove any NULL values
    op.execute("DELETE FROM schedules WHERE shift_id IS NULL")
    
    # Drop the foreign key constraint
    op.drop_constraint('schedules_shift_id_fkey', 'schedules', type_='foreignkey')
    
    # Make the column not nullable again
    op.alter_column('schedules', 'shift_id',
                    existing_type=sa.Integer(),
                    nullable=False)
    
    # Re-add the original foreign key constraint
    op.create_foreign_key(
        'schedules_shift_id_fkey',
        'schedules', 'shifts',
        ['shift_id'], ['id']
    ) 