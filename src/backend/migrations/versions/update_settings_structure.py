"""Update settings table structure

Revision ID: update_settings_structure
Revises: c7d93ab77f3d
Create Date: 2025-02-20 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'update_settings_structure'
down_revision = 'c7d93ab77f3d'
branch_labels = None
depends_on = None


def upgrade():
    # Drop the old settings table
    op.drop_table('settings')
    
    # Create the new settings table with all categories
    op.create_table('settings',
        sa.Column('id', sa.Integer(), nullable=False),
        
        # General Settings
        sa.Column('store_name', sa.String(100), nullable=False, server_default='ShiftWise Store'),
        sa.Column('store_address', sa.String(200)),
        sa.Column('store_contact', sa.String(100)),
        sa.Column('timezone', sa.String(50), nullable=False, server_default='Europe/Berlin'),
        sa.Column('language', sa.String(10), nullable=False, server_default='de'),
        sa.Column('date_format', sa.String(20), nullable=False, server_default='DD.MM.YYYY'),
        sa.Column('time_format', sa.String(10), nullable=False, server_default='24h'),
        
        # Scheduling Settings
        sa.Column('default_shift_duration', sa.Float(), nullable=False, server_default='8.0'),
        sa.Column('min_break_duration', sa.Integer(), nullable=False, server_default='30'),
        sa.Column('max_daily_hours', sa.Float(), nullable=False, server_default='10.0'),
        sa.Column('max_weekly_hours', sa.Float(), nullable=False, server_default='40.0'),
        sa.Column('min_rest_between_shifts', sa.Float(), nullable=False, server_default='11.0'),
        sa.Column('scheduling_period_weeks', sa.Integer(), nullable=False, server_default='4'),
        sa.Column('auto_schedule_preferences', sa.Boolean(), nullable=False, server_default='true'),
        
        # Display Settings
        sa.Column('theme', sa.String(20), nullable=False, server_default='light'),
        sa.Column('primary_color', sa.String(7), nullable=False, server_default='#1976D2'),
        sa.Column('secondary_color', sa.String(7), nullable=False, server_default='#424242'),
        sa.Column('show_weekends', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('start_of_week', sa.Integer(), nullable=False, server_default='1'),
        
        # Notification Settings
        sa.Column('email_notifications', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('schedule_published_notify', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('shift_changes_notify', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('time_off_requests_notify', sa.Boolean(), nullable=False, server_default='true'),
        
        # PDF Layout Settings
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
        
        # Employee Group Settings
        sa.Column('shift_types', sa.JSON(), nullable=False),
        sa.Column('employee_types', sa.JSON(), nullable=False),
        sa.Column('absence_types', sa.JSON(), nullable=False),
        
        # Timestamps
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        
        sa.PrimaryKeyConstraint('id')
    )


def downgrade():
    # Drop the new settings table
    op.drop_table('settings')
    
    # Recreate the previous settings table
    op.create_table('settings',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('category', sa.String(length=50), nullable=False),
        sa.Column('key', sa.String(length=100), nullable=False),
        sa.Column('value', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
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
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('category', 'key', name='uix_category_key')
    ) 