#!/usr/bin/env python
"""
Script to check all SQLite database files and their schemas.
"""

import os
import sqlite3
from pathlib import Path


def find_db_files(start_dir):
    """Find all .db files recursively"""
    db_files = []
    for root, _, files in os.walk(start_dir):
        for file in files:
            if file.endswith(".db"):
                db_files.append(os.path.join(root, file))
    return db_files


def check_db_schema(db_file):
    """Check the schema of a SQLite database file"""
    print(f"Checking {db_file}...")

    try:
        # Try to connect to the database
        conn = sqlite3.connect(db_file)
        cursor = conn.cursor()

        # Get the list of tables
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = cursor.fetchall()

        if not tables:
            print("  No tables found in the database.")
            conn.close()
            return

        print(f"  Found {len(tables)} tables:")
        for table in tables:
            table_name = table[0]
            print(f"  - {table_name}")

            # Get the schema for this table
            cursor.execute(f"PRAGMA table_info({table_name});")
            columns = cursor.fetchall()

            print("    Columns:")
            for col in columns:
                print(f"      {col[1]} ({col[2]})")

            # Get row count
            cursor.execute(f"SELECT COUNT(*) FROM {table_name};")
            row_count = cursor.fetchone()[0]
            print(f"    Row count: {row_count}")

            # Sample data if available
            if row_count > 0:
                cursor.execute(f"SELECT * FROM {table_name} LIMIT 3;")
                sample_data = cursor.fetchall()
                print("    Sample data:")
                for row in sample_data:
                    print(f"      {row}")

            print("\n")

        conn.close()

    except sqlite3.Error as e:
        print(f"  Error accessing database: {str(e)}")
    except Exception as e:
        print(f"  Unexpected error: {str(e)}")


def main():
    """Main function"""
    current_dir = Path.cwd()

    # Find all .db files
    db_files = find_db_files(current_dir)

    if not db_files:
        print("No SQLite database files found.")
        return

    print(f"Found {len(db_files)} SQLite database files.")

    # Check schema for each file
    for db_file in db_files:
        check_db_schema(db_file)


if __name__ == "__main__":
    main()
