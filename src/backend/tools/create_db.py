from app import create_app
from models import db

def init_db():
    app = create_app()
    with app.app_context():
        db.create_all()
        db.session.commit()

if __name__ == '__main__':
    init_db()
    print("Database created successfully") 