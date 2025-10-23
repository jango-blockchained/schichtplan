from datetime import datetime

from sqlalchemy import JSON, Boolean, Column, DateTime, Integer, String

from . import db


class CoverageProfile(db.Model):
    """Represents a saved coverage profile configuration.

    Allows users to save multiple coverage configurations and
    switch between them for different scheduling scenarios.
    Each profile includes all coverage data for a complete weekly
    schedule.

    Attributes:
        id (int): Primary key.
        name (str): User-friendly name for the profile
                    (e.g., "Summer Schedule", "Holiday Season").
        description (str): Optional description of when/why this
                          profile is used.
        coverage_data (JSON): Complete coverage configuration
                              (array of daily coverage with
                              timeSlots). Matches the
                              DailyCoverage[] structure from
                              frontend.
        is_default (bool): If True, this profile is loaded on
                          Coverage page initialization.
        created_at (DateTime): Timestamp of creation.
        updated_at (DateTime): Timestamp of last update.
    """

    __tablename__ = "coverage_profile"

    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False, unique=True)
    description = Column(String(512), nullable=True)
    coverage_data = Column(JSON, nullable=False)
    is_default = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __init__(
        self,
        name: str,
        coverage_data: dict,
        description: str | None = None,
        is_default: bool = False,
    ):
        self.name = name
        self.coverage_data = coverage_data
        self.description = description
        self.is_default = is_default

    def to_dict(self):
        """Convert profile to dictionary"""
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "coverageData": self.coverage_data,
            "isDefault": self.is_default,
            "createdAt": (
                self.created_at.isoformat()
                if isinstance(self.created_at, datetime)
                else None
            ),
            "updatedAt": (
                self.updated_at.isoformat()
                if isinstance(self.updated_at, datetime)
                else None
            ),
        }

    def __repr__(self):
        return f"<CoverageProfile {self.name} (default={self.is_default})>"
