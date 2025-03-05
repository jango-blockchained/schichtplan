"""Remove shift_ids from Coverage model

Revision ID: ed2783bafef8
Revises: ed2783bafef7
Create Date: 2025-03-01 02:27:48.688873

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "ed2783bafef8"
down_revision = "ed2783bafef7"
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    with op.batch_alter_table("coverage", schema=None) as batch_op:
        batch_op.drop_column("shift_ids")

    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    with op.batch_alter_table("coverage", schema=None) as batch_op:
        batch_op.add_column(sa.Column("shift_ids", sa.JSON(), nullable=True))

    # ### end Alembic commands ###
