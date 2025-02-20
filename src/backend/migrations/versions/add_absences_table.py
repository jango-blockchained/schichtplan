"""Add absences table

Revision ID: add_absences_table
Revises: add_email_phone_columns
Create Date: 2024-02-19 23:59:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_absences_table'
down_revision = 'add_email_phone_columns'
branch_labels = None
depends_on = None


def upgrade():
    # Create temporary table
    op.execute('''
        CREATE TABLE absences_new (
            id INTEGER NOT NULL PRIMARY KEY,
            employee_id INTEGER NOT NULL,
            absence_type_id VARCHAR(50) NOT NULL,
            start_date DATE NOT NULL,
            end_date DATE NOT NULL,
            note VARCHAR(200),
            created_at DATETIME,
            updated_at DATETIME,
            FOREIGN KEY(employee_id) REFERENCES employees(id) ON DELETE CASCADE
        )
    ''')
    
    # Copy data from old table to new table
    op.execute('''
        INSERT INTO absences_new (id, employee_id, absence_type_id, start_date, end_date, note, created_at, updated_at)
        SELECT id, employee_id, absence_type_id, start_date, end_date, note, created_at, updated_at
        FROM absences
    ''')
    
    # Drop old table
    op.execute('DROP TABLE absences')
    
    # Rename new table to original name
    op.execute('ALTER TABLE absences_new RENAME TO absences')


def downgrade():
    # Create temporary table without CASCADE
    op.execute('''
        CREATE TABLE absences_new (
            id INTEGER NOT NULL PRIMARY KEY,
            employee_id INTEGER NOT NULL,
            absence_type_id VARCHAR(50) NOT NULL,
            start_date DATE NOT NULL,
            end_date DATE NOT NULL,
            note VARCHAR(200),
            created_at DATETIME,
            updated_at DATETIME,
            FOREIGN KEY(employee_id) REFERENCES employees(id)
        )
    ''')
    
    # Copy data from old table to new table
    op.execute('''
        INSERT INTO absences_new (id, employee_id, absence_type_id, start_date, end_date, note, created_at, updated_at)
        SELECT id, employee_id, absence_type_id, start_date, end_date, note, created_at, updated_at
        FROM absences
    ''')
    
    # Drop old table
    op.execute('DROP TABLE absences')
    
    # Rename new table to original name
    op.execute('ALTER TABLE absences_new RENAME TO absences') 