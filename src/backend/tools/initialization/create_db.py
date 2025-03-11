from src.backend.app import create_app, db


def create_database():
    app = create_app()
    with app.app_context():
        db.create_all()
        print("Database created successfully!")


if __name__ == "__main__":
    create_database()
