"""empty message

Revision ID: 25cf2b5a118c
Revises: make_shift_id_nullable, update_store_hours
Create Date: 2025-02-26 21:42:20.140295

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '25cf2b5a118c'
down_revision = ('make_shift_id_nullable', 'update_store_hours')
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
