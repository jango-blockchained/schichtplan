from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic
revision = "add_shift_types"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
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
    op.drop_column("settings", "shift_types")
