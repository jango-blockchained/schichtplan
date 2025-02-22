"""initial migration

Revision ID: 077f67588060
Revises: 
Create Date: 2025-02-22 11:37:37.829557

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '077f67588060'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    # Create settings table
    op.create_table('settings',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('store_name', sa.String(length=100), nullable=False),
        sa.Column('store_address', sa.String(length=200), nullable=True),
        sa.Column('store_contact', sa.String(length=100), nullable=True),
        sa.Column('timezone', sa.String(length=50), nullable=False),
        sa.Column('language', sa.String(length=10), nullable=False),
        sa.Column('date_format', sa.String(length=20), nullable=False),
        sa.Column('time_format', sa.String(length=10), nullable=False),
        sa.Column('store_opening', sa.String(length=5), nullable=False),
        sa.Column('store_closing', sa.String(length=5), nullable=False),
        sa.Column('keyholder_before_minutes', sa.Integer(), nullable=False),
        sa.Column('keyholder_after_minutes', sa.Integer(), nullable=False),
        sa.Column('opening_days', sa.JSON(), nullable=False),
        sa.Column('special_hours', sa.JSON(), nullable=False),
        sa.Column('scheduling_resource_type', sa.String(length=20), nullable=False, server_default='shifts'),
        sa.Column('default_shift_duration', sa.Float(), nullable=False),
        sa.Column('min_break_duration', sa.Integer(), nullable=False),
        sa.Column('max_daily_hours', sa.Float(), nullable=False),
        sa.Column('max_weekly_hours', sa.Float(), nullable=False),
        sa.Column('min_rest_between_shifts', sa.Float(), nullable=False),
        sa.Column('scheduling_period_weeks', sa.Integer(), nullable=False),
        sa.Column('auto_schedule_preferences', sa.Boolean(), nullable=False),
        sa.Column('min_employees_per_shift', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('max_employees_per_shift', sa.Integer(), nullable=False, server_default='3'),
        sa.Column('theme', sa.String(length=20), nullable=False),
        sa.Column('primary_color', sa.String(length=7), nullable=False),
        sa.Column('secondary_color', sa.String(length=7), nullable=False),
        sa.Column('accent_color', sa.String(length=7), nullable=False),
        sa.Column('background_color', sa.String(length=7), nullable=False),
        sa.Column('surface_color', sa.String(length=7), nullable=False),
        sa.Column('text_color', sa.String(length=7), nullable=False),
        sa.Column('dark_theme_primary_color', sa.String(length=7), nullable=False),
        sa.Column('dark_theme_secondary_color', sa.String(length=7), nullable=False),
        sa.Column('dark_theme_accent_color', sa.String(length=7), nullable=False),
        sa.Column('dark_theme_background_color', sa.String(length=7), nullable=False),
        sa.Column('dark_theme_surface_color', sa.String(length=7), nullable=False),
        sa.Column('dark_theme_text_color', sa.String(length=7), nullable=False),
        sa.Column('show_sunday', sa.Boolean(), nullable=False),
        sa.Column('show_weekdays', sa.Boolean(), nullable=False),
        sa.Column('start_of_week', sa.Integer(), nullable=False),
        sa.Column('email_notifications', sa.Boolean(), nullable=False),
        sa.Column('schedule_published_notify', sa.Boolean(), nullable=False),
        sa.Column('shift_changes_notify', sa.Boolean(), nullable=False),
        sa.Column('time_off_requests_notify', sa.Boolean(), nullable=False),
        sa.Column('page_size', sa.String(length=10), nullable=False),
        sa.Column('orientation', sa.String(length=10), nullable=False),
        sa.Column('margin_top', sa.Float(), nullable=False),
        sa.Column('margin_right', sa.Float(), nullable=False),
        sa.Column('margin_bottom', sa.Float(), nullable=False),
        sa.Column('margin_left', sa.Float(), nullable=False),
        sa.Column('table_header_bg_color', sa.String(length=7), nullable=False),
        sa.Column('table_border_color', sa.String(length=7), nullable=False),
        sa.Column('table_text_color', sa.String(length=7), nullable=False),
        sa.Column('table_header_text_color', sa.String(length=7), nullable=False),
        sa.Column('font_family', sa.String(length=50), nullable=False),
        sa.Column('font_size', sa.Float(), nullable=False),
        sa.Column('header_font_size', sa.Float(), nullable=False),
        sa.Column('show_employee_id', sa.Boolean(), nullable=False),
        sa.Column('show_position', sa.Boolean(), nullable=False),
        sa.Column('show_breaks', sa.Boolean(), nullable=False),
        sa.Column('show_total_hours', sa.Boolean(), nullable=False),
        sa.Column('employee_types', sa.JSON(), nullable=False),
        sa.Column('absence_types', sa.JSON(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )

    # Create employees table
    op.create_table('employees',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('employee_id', sa.String(length=10), nullable=False),
        sa.Column('first_name', sa.String(length=50), nullable=False),
        sa.Column('last_name', sa.String(length=50), nullable=False),
        sa.Column('email', sa.String(length=120), nullable=True),
        sa.Column('phone', sa.String(length=20), nullable=True),
        sa.Column('employee_group', sa.String(length=20), nullable=False),
        sa.Column('contracted_hours', sa.Float(), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('is_keyholder', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('employee_id')
    )

    # Create shifts table
    op.create_table('shifts',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('start_time', sa.String(length=5), nullable=False),
        sa.Column('end_time', sa.String(length=5), nullable=False),
        sa.Column('min_employees', sa.Integer(), nullable=False),
        sa.Column('max_employees', sa.Integer(), nullable=False),
        sa.Column('duration_hours', sa.Float(), nullable=False),
        sa.Column('requires_break', sa.Boolean(), nullable=False),
        sa.Column('active_days', sa.JSON(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )

    # Create schedules table
    op.create_table('schedules',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('employee_id', sa.Integer(), nullable=False),
        sa.Column('shift_id', sa.Integer(), nullable=False),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('break_start', sa.String(length=5), nullable=True),
        sa.Column('break_end', sa.String(length=5), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['employee_id'], ['employees.id'], ),
        sa.ForeignKeyConstraint(['shift_id'], ['shifts.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

    # Update employee groups
    op.execute("""
        UPDATE employees
        SET employee_group = CASE employee_group
            WHEN 'VL' THEN 'full_time'
            WHEN 'TL' THEN 'full_time'
            WHEN 'TZ' THEN 'part_time'
            WHEN 'GFB' THEN 'mini_job'
            ELSE employee_group
        END;
    """)


def downgrade():
    # Update employee groups back
    op.execute("""
        UPDATE employees
        SET employee_group = CASE employee_group
            WHEN 'full_time' THEN 'VL'
            WHEN 'part_time' THEN 'TZ'
            WHEN 'mini_job' THEN 'GFB'
            ELSE employee_group
        END;
    """)

    # Drop all tables
    op.drop_table('schedules')
    op.drop_table('shifts')
    op.drop_table('employees')
    op.drop_table('settings')
