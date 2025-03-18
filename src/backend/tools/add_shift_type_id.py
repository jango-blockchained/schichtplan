import sqlite3
import os


def add_shift_type_id_column():
    """Add shift_type_id column to shifts table"""
    # Path to the database file
    db_path = os.path.join("src", "instance", "app.db")

    if not os.path.exists(db_path):
        print(f"Database file not found at {db_path}")
        return

    try:
        # Connect to the database
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        # Check if column exists
        cursor.execute("PRAGMA table_info(shifts)")
        columns = [row[1] for row in cursor.fetchall()]

        if "shift_type_id" not in columns:
            # Add the column
            cursor.execute("ALTER TABLE shifts ADD COLUMN shift_type_id VARCHAR(50)")

            # Update existing records based on shift_type
            cursor.execute("""
                UPDATE shifts 
                SET shift_type_id = 
                    CASE 
                        WHEN shift_type = 'early' THEN 'EARLY'
                        WHEN shift_type = 'middle' THEN 'MIDDLE'
                        WHEN shift_type = 'late' THEN 'LATE'
                        ELSE NULL
                    END
            """)

            conn.commit()
            print("Migration completed successfully!")
        else:
            print("Column shift_type_id already exists.")

        conn.close()
    except Exception as e:
        print(f"Error during migration: {str(e)}")


if __name__ == "__main__":
    add_shift_type_id_column()
