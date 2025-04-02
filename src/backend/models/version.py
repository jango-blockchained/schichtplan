"""
Version metadata model for tracking schedule versions.
"""

from datetime import datetime
from sqlalchemy import Column, Integer, String, JSON, DateTime
from . import db

class VersionMeta(db.Model):
    """
    Model for storing metadata about schedule versions
    """
    __tablename__ = 'version_meta'
    
    id = Column(Integer, primary_key=True)
    version = Column(String(50), nullable=False, unique=True)
    status = Column(String(20), nullable=False, default="draft")  # draft, published, archived
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    date_range = Column(JSON, nullable=True)  # {start_date: "YYYY-MM-DD", end_date: "YYYY-MM-DD"}
    version_metadata = Column(JSON, nullable=True)  # Additional metadata
    
    def __init__(self, version, status="draft", date_range=None, version_metadata=None):
        self.version = version
        self.status = status
        self.date_range = date_range
        self.version_metadata = version_metadata
    
    def __repr__(self):
        return f"<VersionMeta {self.version} ({self.status})>"
    
    def to_dict(self):
        """Convert version metadata to dictionary"""
        return {
            "id": self.id,
            "version": self.version,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "date_range": self.date_range,
            "version_metadata": self.version_metadata,
        } 