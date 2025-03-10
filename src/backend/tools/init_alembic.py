from app import create_app
from models import db
from sqlalchemy import text

app = create_app()
with app.app_context():
    # Drop alembic_version table if it exists
    db.session.execute(text('DROP TABLE IF EXISTS alembic_version'))
    db.session.commit()
    print("Alembic version table dropped") 