"""Update settings table

Revision ID: update_settings_table
Revises: 25ff7c9714ea
Create Date: 2025-02-17 23:35:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'update_settings_table'
down_revision = '25ff7c9714ea'
branch_labels = None
depends_on = None


def upgrade():
    # Drop the old settings table
    op.drop_table('settings')
    
    # Create the new settings table with PDF layout configuration
    op.create_table('settings',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('page_size', sa.String(10), nullable=False, server_default='A4'),
        sa.Column('orientation', sa.String(10), nullable=False, server_default='portrait'),
        sa.Column('margin_top', sa.Float(), nullable=False, server_default='20.0'),
        sa.Column('margin_right', sa.Float(), nullable=False, server_default='20.0'),
        sa.Column('margin_bottom', sa.Float(), nullable=False, server_default='20.0'),
        sa.Column('margin_left', sa.Float(), nullable=False, server_default='20.0'),
        sa.Column('table_header_bg_color', sa.String(7), nullable=False, server_default='#f3f4f6'),
        sa.Column('table_border_color', sa.String(7), nullable=False, server_default='#e5e7eb'),
        sa.Column('table_text_color', sa.String(7), nullable=False, server_default='#111827'),
        sa.Column('table_header_text_color', sa.String(7), nullable=False, server_default='#111827'),
        sa.Column('font_family', sa.String(50), nullable=False, server_default='Helvetica'),
        sa.Column('font_size', sa.Float(), nullable=False, server_default='10.0'),
        sa.Column('header_font_size', sa.Float(), nullable=False, server_default='12.0'),
        sa.Column('show_employee_id', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('show_position', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('show_breaks', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('show_total_hours', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('store_name', sa.String(100)),
        sa.Column('store_address', sa.String(200)),
        sa.Column('store_contact', sa.String(100)),
        sa.PrimaryKeyConstraint('id')
    )


def downgrade():
    # Drop the new settings table
    op.drop_table('settings')
    
    # Recreate the original settings table
    op.create_table('settings',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('category', sa.String(length=50), nullable=False),
        sa.Column('key', sa.String(length=100), nullable=False),
        sa.Column('value', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('category', 'key', name='uix_category_key')
    ) 