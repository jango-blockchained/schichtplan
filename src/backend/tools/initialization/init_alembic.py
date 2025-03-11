from src.backend.app import create_app


def init_alembic():
    app = create_app()
    with app.app_context():
        from flask_migrate import init, migrate, upgrade

        init()
        migrate()
        upgrade()
        print("Alembic initialized successfully!")


if __name__ == "__main__":
    init_alembic()
