import sqlite3
import os


def remove_max_employees_column():
    """Remove max_employees column from shifts table"""
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

        if "max_employees" in columns:
            # In SQLite, removing a column requires recreating the table
            # 1. Get current table schema
            cursor.execute("PRAGMA table_info(shifts)")
            columns_info = cursor.fetchall()

            # Filter out the max_employees column
            columns_to_keep = [col for col in columns_info if col[1] != "max_employees"]

            # 2. Create a new table without the max_employees column
            create_stmt = "CREATE TABLE shifts_new ("
            for i, col in enumerate(columns_to_keep):
                create_stmt += f"{col[1]} {col[2]}"
                if col[3]:  # NOT NULL constraint
                    create_stmt += " NOT NULL"
                if col[4] is not None:  # Default value
                    create_stmt += f" DEFAULT {col[4]}"
                if col[5]:  # Primary key
                    create_stmt += " PRIMARY KEY"
                if i < len(columns_to_keep) - 1:
                    create_stmt += ", "
            create_stmt += ")"

            cursor.execute(create_stmt)

            # 3. Copy data from old table to new table
            column_names = [col[1] for col in columns_to_keep]
            column_list = ", ".join(column_names)
            cursor.execute(f"INSERT INTO shifts_new SELECT {column_list} FROM shifts")

            # 4. Drop old table and rename new table
            cursor.execute("DROP TABLE shifts")
            cursor.execute("ALTER TABLE shifts_new RENAME TO shifts")

            conn.commit()
            print("Successfully removed max_employees column from shifts table")
        else:
            print("Column max_employees does not exist in shifts table")

        conn.close()
    except Exception as e:
        print(f"Error during migration: {str(e)}")


if __name__ == "__main__":
    remove_max_employees_column()
