from app import create_app
from models import db
from sqlalchemy import text

app = create_app()
with app.app_context():
    result = db.session.execute(text("PRAGMA table_info(settings)"))
    print("Settings table schema:")
    for row in result:
        print(row)
