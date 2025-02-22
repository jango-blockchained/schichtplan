from alembic import op
import sqlalchemy as sa

def upgrade():
    # Add min_employees_per_shift and max_employees_per_shift columns
    op.add_column('settings', sa.Column('min_employees_per_shift', sa.Integer(), nullable=False, server_default='1'))
    op.add_column('settings', sa.Column('max_employees_per_shift', sa.Integer(), nullable=False, server_default='3'))

def downgrade():
    # Remove the columns
    op.drop_column('settings', 'min_employees_per_shift')
    op.drop_column('settings', 'max_employees_per_shift') 