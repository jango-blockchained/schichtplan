from alembic import op
import sqlalchemy as sa
from sqlalchemy.engine.reflection import Inspector

# revision identifiers, used by Alembic
revision = "add_shift_types"
down_revision = "initial"
branch_labels = None
depends_on = None


def upgrade():
    # Check if the column already exists
    conn = op.get_bind()
    inspector = Inspector.from_engine(conn)
    columns = [column["name"] for column in inspector.get_columns("settings")]

    if "shift_types" not in columns:
        # Add shift_types column to settings table
        op.add_column("settings", sa.Column("shift_types", sa.JSON(), nullable=True))

        # Set default value for existing rows
        op.execute("""
        UPDATE settings 
        SET shift_types = '[{"id": "EARLY", "name": "Frühschicht", "color": "#4CAF50", "type": "shift"}, 
                          {"id": "MIDDLE", "name": "Mittelschicht", "color": "#2196F3", "type": "shift"}, 
                          {"id": "LATE", "name": "Spätschicht", "color": "#9C27B0", "type": "shift"}]'
        """)


def downgrade():
    # Check if the column exists before dropping it
    conn = op.get_bind()
    inspector = Inspector.from_engine(conn)
    columns = [column["name"] for column in inspector.get_columns("settings")]

    if "shift_types" in columns:
        op.drop_column("settings", "shift_types")
