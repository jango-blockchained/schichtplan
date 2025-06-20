"""Add independent timing fields to schedule table

Revision ID: schedule_timing_fields
Revises: 0035670ff2b6
Create Date: 2025-06-01 10:35:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'schedule_timing_fields'
down_revision = 'd433bcfaf979'
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    with op.batch_alter_table('schedules', schema=None) as batch_op:
        # Add independent shift timing fields
        batch_op.add_column(sa.Column('shift_start', sa.String(length=5), nullable=True))
        batch_op.add_column(sa.Column('shift_end', sa.String(length=5), nullable=True))
        batch_op.add_column(sa.Column('duration_hours', sa.Float(), nullable=True))
        batch_op.add_column(sa.Column('requires_break', sa.Boolean(), nullable=True, default=False))
        batch_op.add_column(sa.Column('shift_type_id', sa.String(length=50), nullable=True))
        batch_op.add_column(sa.Column('break_duration', sa.Integer(), nullable=True))

    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    with op.batch_alter_table('schedules', schema=None) as batch_op:
        batch_op.drop_column('break_duration')
        batch_op.drop_column('shift_type_id')
        batch_op.drop_column('requires_break')
        batch_op.drop_column('duration_hours')
        batch_op.drop_column('shift_end')
        batch_op.drop_column('shift_start')

    # ### end Alembic commands ### 