import os
from pathlib import Path

# Define project root as the main project directory (parent of src)
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent


class Config:
    # Unified paths
    INSTANCE_DIR = PROJECT_ROOT / "instance"
    LOGS_DIR = PROJECT_ROOT / "logs"

    SQLALCHEMY_DATABASE_URI = f"sqlite:///{INSTANCE_DIR}/app.db"
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        "pool_size": 10,
        "pool_recycle": 3600,  # Recycle connections every hour
        "pool_pre_ping": True,  # Test connections before using them
        "connect_args": {"timeout": 15, "check_same_thread": False},
    }
    SECRET_KEY = os.environ.get("SECRET_KEY") or "dev-key-please-change-in-production"

    # Ensure directories exist
    INSTANCE_DIR.mkdir(exist_ok=True)
    LOGS_DIR.mkdir(exist_ok=True)

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
