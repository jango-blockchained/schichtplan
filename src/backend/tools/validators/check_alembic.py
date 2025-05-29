from app import create_app
from models import db
from sqlalchemy import text

app = create_app()
with app.app_context():
    try:
        result = db.session.execute(text("SELECT * FROM alembic_version"))
        print("Current alembic version:")
        for row in result:
            print(row)
    except Exception as e:
        print("Error:", str(e))
