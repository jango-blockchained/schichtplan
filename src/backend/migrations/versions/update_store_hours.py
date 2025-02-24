"""Update store hours

Revision ID: update_store_hours
Create Date: 2025-02-23 19:45:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'update_store_hours'
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    # Update store hours to match fixture
    op.execute("""
        UPDATE settings 
        SET store_opening = '07:00', 
            store_closing = '22:00'
        WHERE store_opening = '09:00'
    """)

def downgrade():
    # Revert to default hours
    op.execute("""
        UPDATE settings 
        SET store_opening = '09:00', 
            store_closing = '20:00'
        WHERE store_opening = '07:00'
    """) 