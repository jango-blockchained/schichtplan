import os
from pathlib import Path

class Config:
    BASE_DIR = Path(__file__).resolve().parent
    SQLALCHEMY_DATABASE_URI = f'sqlite:///{BASE_DIR}/instance/app.db'
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'dev-key-please-change-in-production'

    def __init__(self):
        self.SQLALCHEMY_DATABASE_URI = self.SQLALCHEMY_DATABASE_URI
        self.SQLALCHEMY_TRACK_MODIFICATIONS = self.SQLALCHEMY_TRACK_MODIFICATIONS
        self.SECRET_KEY = self.SECRET_KEY

    def update(self, **kwargs):
        for key, value in kwargs.items():
            if hasattr(self, key):
                setattr(self, key, value)

    def get(self, key, default=None):
        return getattr(self, key, default)

    def set(self, key, value):
        setattr(self, key, value)

    def __repr__(self):
        return f"Config(SQLALCHEMY_DATABASE_URI={self.SQLALCHEMY_DATABASE_URI}, SQLALCHEMY_TRACK_MODIFICATIONS={self.SQLALCHEMY_TRACK_MODIFICATIONS}, SECRET_KEY={self.SECRET_KEY})" 