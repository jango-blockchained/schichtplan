"""Configuration settings for the Schichtplan application."""

import os
from typing import List, Set


class Config:
    """Base configuration class."""
    
    # Flask settings
    DEBUG: bool = False
    TESTING: bool = False
    SECRET_KEY: str = os.environ.get(
        'SECRET_KEY',
        'dev-key-change-in-production'
    )
    
    # File upload settings
    UPLOAD_FOLDER: str = 'uploads'
    MAX_CONTENT_LENGTH: int = 16 * 1024 * 1024  # 16MB
    ALLOWED_EXTENSIONS: Set[str] = {'png', 'jpg', 'jpeg', 'gif'}
    
    # Database settings
    SQLALCHEMY_DATABASE_URI: str = os.environ.get(
        'DATABASE_URL',
        'sqlite:///shifts.db'
    )
    SQLALCHEMY_TRACK_MODIFICATIONS: bool = False
    
    # OCR settings
    OCR_LANGUAGE: str = 'deu'  # German language
    TESSERACT_CMD: str = os.environ.get('TESSERACT_CMD', 'tesseract')
    
    # Image processing settings
    MIN_IMAGE_SIZE: tuple = (100, 100)  # Minimum dimensions (width, height)
    MAX_IMAGE_SIZE: tuple = (4000, 4000)  # Maximum dimensions
    IMAGE_THRESHOLD: int = 0  # For binarization
    IMAGE_MAX_VALUE: int = 255  # Maximum pixel value
    KERNEL_SIZE: tuple = (3, 3)  # For dilation
    
    # Schedule parsing settings
    MIN_SHIFT_TYPE_LENGTH: int = 2
    MAX_SHIFT_TYPE_LENGTH: int = 3
    TIME_FORMATS: List[str] = ['%H:%M', '%H%M']  # Accepted time formats


class DevelopmentConfig(Config):
    """Development configuration."""
    DEBUG = True
    TESTING = True


class ProductionConfig(Config):
    """Production configuration."""
    DEBUG = False
    TESTING = False
    
    # Override these in production environment
    SECRET_KEY = os.environ['SECRET_KEY']
    SQLALCHEMY_DATABASE_URI = os.environ['DATABASE_URL']


class TestingConfig(Config):
    """Testing configuration."""
    TESTING = True
    SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'


# Configuration dictionary
config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'testing': TestingConfig,
    'default': DevelopmentConfig
}


def get_config():
    """Get the current configuration based on environment."""
    env = os.environ.get('FLASK_ENV', 'development')
    return config.get(env, config['default']) 