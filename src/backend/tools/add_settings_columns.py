from app import create_app
from models import db
import sqlalchemy as sa


def add_columns():
    app = create_app()
    with app.app_context():
        try:
            # Check if columns exist
            inspector = sa.inspect(db.engine)
            existing_columns = [
                col["name"] for col in inspector.get_columns("settings")
            ]

            conn = db.engine.connect()

            # Add enable_diagnostics column if it doesn't exist
            if "enable_diagnostics" not in existing_columns:
                conn.execute(
                    sa.text(
                        "ALTER TABLE settings ADD COLUMN enable_diagnostics BOOLEAN NOT NULL DEFAULT 0"
                    )
                )
                conn.commit()
                print("Added enable_diagnostics column")
            else:
                print("enable_diagnostics column already exists")

            # Add generation_requirements column if it doesn't exist
            if "generation_requirements" not in existing_columns:
                conn.execute(
                    sa.text(
                        "ALTER TABLE settings ADD COLUMN generation_requirements JSON"
                    )
                )
                conn.commit()
                print("Added generation_requirements column")
            else:
                print("generation_requirements column already exists")

            print("Settings table update completed!")
        except Exception as e:
            print(f"Error: {e}")


if __name__ == "__main__":
    add_columns()
