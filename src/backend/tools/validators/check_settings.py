from app import create_app
from models import Settings


def main():
    app = create_app()
    with app.app_context():
        settings = Settings.query.first()
        if settings:
            print("Found settings:")
            print(f"  Store hours: {settings.store_opening}-{settings.store_closing}")
            print(f"  Opening days: {settings.opening_days}")
            print(f"  Keyholder before: {settings.keyholder_before_minutes} minutes")
            print(f"  Keyholder after: {settings.keyholder_after_minutes} minutes")
        else:
            print("No settings found in database")


if __name__ == "__main__":
    main()
