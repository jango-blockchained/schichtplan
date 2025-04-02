from .shifts import shifts
from .settings import settings
# from .schedules import schedules  # Remove this
from .employees import employees
from .availability import availability
from .absences import bp as absences_bp
from .logs import bp as logs_bp # Assuming logs defines bp

# Import the new schedule blueprints
from .schedule_crud import crud_bp
from .schedule_generation import generation_bp
from .schedule_versions import versions_bp
from .schedule_export import export_bp
from .schedule_validation import validation_bp

# Optional: Define __all__ if needed for wildcard imports
__all__ = [
    "shifts",
    "settings",
    "employees",
    "availability",
    "absences_bp",
    "logs_bp",
    "crud_bp",
    "generation_bp",
    "versions_bp",
    "export_bp",
    "validation_bp",
] 