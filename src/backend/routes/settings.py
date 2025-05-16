from flask import Blueprint, jsonify, request, send_file
from src.backend.models import db, Settings
from http import HTTPStatus
import logging
import os
import json
import datetime
import glob
from sqlalchemy import inspect, text
from pydantic import ValidationError
from src.backend.schemas.settings import (
    TablesList, 
    SettingValue, 
    CategorySettings, 
    GenerationRequirements,
    CompleteSettings
)
from sqlalchemy.exc import IntegrityError

settings = Blueprint("settings", __name__)


def serialize_db():
    """Serialize all database tables into a JSON structure"""
    data = {}
    inspector = inspect(db.engine)

    for table_name in inspector.get_table_names():
        # Skip Alembic-related tables and temporary tables
        if not table_name.startswith("_alembic") and not table_name.startswith(
            "alembic"
        ):
            try:
                table = db.metadata.tables[table_name]
                query = db.session.query(table)
                records = []
                for record in query.all():
                    if hasattr(record, "to_dict"):
                        records.append(record.to_dict())
                    else:
                        record_dict = {}
                        for column in table.columns:
                            value = getattr(record, column.name)
                            # Handle datetime and date objects
                            if isinstance(value, (datetime.datetime, datetime.date)):
                                value = value.isoformat()
                            record_dict[column.name] = value
                        records.append(record_dict)
                data[table_name] = records
            except Exception as e:
                logging.warning(f"Error serializing table {table_name}: {str(e)}")
                continue
    return data


@settings.route("/settings/backup", methods=["GET"])
@settings.route("/settings/backup/", methods=["GET"])
def backup_database():
    """Export the entire database as JSON"""
    try:
        data = serialize_db()
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"backup_{timestamp}.json"

        # Create backups directory if it doesn't exist
        backup_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "backups")
        os.makedirs(backup_dir, exist_ok=True)

        # Save to a file in the backups directory
        backup_path = os.path.join(backup_dir, filename)
        with open(backup_path, "w") as f:
            json.dump(data, f, indent=2, default=str)  # Use str as fallback serializer

        return send_file(
            backup_path,
            mimetype="application/json",
            as_attachment=True,
            download_name=filename,
        )
    except Exception as e:
        logging.error(f"Error during backup: {str(e)}")
        return jsonify({"error": str(e)}), HTTPStatus.INTERNAL_SERVER_ERROR


@settings.route("/settings/restore", methods=["POST"])
@settings.route("/settings/restore/", methods=["POST"])
def restore_database():
    """Restore the database from a JSON backup"""
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), HTTPStatus.BAD_REQUEST

    file = request.files["file"]
    if not file.filename.endswith(".json"):
        return jsonify({"error": "Invalid file format"}), HTTPStatus.BAD_REQUEST

    try:
        data = json.load(file)

        # Start a transaction
        with db.session.begin():
            # Clear existing data
            inspector = inspect(db.engine)
            for table_name in reversed(inspector.get_table_names()):
                if table_name != "alembic_version":  # Skip migration table
                    db.session.execute(f"TRUNCATE TABLE {table_name} CASCADE")

            # Restore data
            for table_name, records in data.items():
                table = db.metadata.tables.get(table_name)
                if table and records:
                    db.session.execute(table.insert(), records)

        return jsonify({"message": "Database restored successfully"}), HTTPStatus.OK
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), HTTPStatus.INTERNAL_SERVER_ERROR


@settings.route("/settings/tables", methods=["GET"])
@settings.route("/settings/tables/", methods=["GET"])
def get_tables():
    """Get list of available database tables"""
    try:
        inspector = inspect(db.engine)
        tables = [t for t in inspector.get_table_names() if t != "alembic_version"]
        return jsonify({"tables": tables}), HTTPStatus.OK
    except Exception as e:
        return jsonify({"error": str(e)}), HTTPStatus.INTERNAL_SERVER_ERROR


@settings.route("/settings/wipe-tables", methods=["POST"])
@settings.route("/settings/wipe-tables/", methods=["POST"])
def wipe_tables():
    """Wipe specific database tables"""
    if not request.is_json:
        return jsonify(
            {"error": "Content-Type must be application/json"}
        ), HTTPStatus.BAD_REQUEST

    data = request.get_json()
    
    # Validate input using Pydantic schema
    try:
        tables_schema = TablesList(**data)
        tables_to_wipe = tables_schema.tables
    except ValidationError as e:
        return jsonify({"error": "Invalid input data", "details": e.errors()}), HTTPStatus.BAD_REQUEST
    
    inspector = inspect(db.engine)
    available_tables = [
        t for t in inspector.get_table_names() if t != "alembic_version"
    ]

    # Validate table names
    invalid_tables = [t for t in tables_to_wipe if t not in available_tables]
    if invalid_tables:
        return jsonify(
            {"error": f"Invalid table names: {', '.join(invalid_tables)}"}
        ), HTTPStatus.BAD_REQUEST

    try:
        # Start a transaction
        with db.session.begin():
            # First disable foreign key constraints
            db.session.execute(text("PRAGMA foreign_keys=OFF"))

            for table_name in tables_to_wipe:
                # Delete all rows from the table
                sql = text(f"DELETE FROM {table_name}")
                db.session.execute(sql)

                # Try to reset the autoincrement counter if sqlite_sequence exists
                try:
                    sql = text("DELETE FROM sqlite_sequence WHERE name=:table_name")
                    db.session.execute(sql, {"table_name": table_name})
                except Exception as e:
                    # Ignore errors about missing sqlite_sequence table
                    if "no such table: sqlite_sequence" not in str(e):
                        raise

            # Re-enable foreign key constraints
            db.session.execute(text("PRAGMA foreign_keys=ON"))

        return jsonify(
            {"message": "Tables wiped successfully", "wiped_tables": tables_to_wipe}
        ), HTTPStatus.OK
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), HTTPStatus.INTERNAL_SERVER_ERROR


@settings.route("/settings", methods=["GET"])
@settings.route("/settings/", methods=["GET"])
def get_settings():
    """Get all settings or initialize with defaults if none exist"""
    try:
        settings = Settings.query.first()

        # If no settings exist, initialize with defaults
        if not settings:
            settings = Settings.get_default_settings()
            db.session.add(settings)
            try:
                db.session.commit()
            except Exception as e:
                db.session.rollback()
                logging.error(f"Error initializing settings: {str(e)}")
                return jsonify(
                    {"error": f"Error initializing settings: {str(e)}"}
                ), HTTPStatus.INTERNAL_SERVER_ERROR

        return jsonify(settings.to_dict())
    except Exception as e:
        logging.error(f"Unexpected error retrieving settings: {str(e)}")
        # If there's an unexpected error, try to reset and recreate settings
        try:
            Settings.query.delete()
            db.session.commit()

            settings = Settings.get_default_settings()
            db.session.add(settings)
            db.session.commit()

            return jsonify(settings.to_dict())
        except Exception as reset_error:
            logging.error(f"Error resetting settings: {str(reset_error)}")
            return jsonify(
                {"error": f"Critical error retrieving settings: {str(reset_error)}"}
            ), HTTPStatus.INTERNAL_SERVER_ERROR


@settings.route("/settings", methods=["PUT"])
@settings.route("/settings/", methods=["PUT"])
def update_settings():
    """Update settings"""
    data = request.get_json()
    
    # Validate input using Pydantic schema
    try:
        settings_schema = CompleteSettings(**data)
        # Convert Pydantic model to dict
        validated_data = settings_schema.dict(exclude_none=True)
    except ValidationError as e:
        return jsonify({"error": "Invalid input data", "details": e.errors()}), HTTPStatus.BAD_REQUEST
    
    settings = Settings.query.first()

    if not settings:
        settings = Settings.get_default_settings()
        db.session.add(settings)

    try:
        settings.update_from_dict(validated_data)
        db.session.commit()
        return jsonify(settings.to_dict())
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), HTTPStatus.BAD_REQUEST


@settings.route("/settings/reset", methods=["POST"])
@settings.route("/settings/reset/", methods=["POST"])
def reset_settings():
    """Reset settings to defaults"""
    Settings.query.delete()
    db.session.commit()

    settings = Settings.get_default_settings()
    db.session.add(settings)
    db.session.commit()

    return jsonify(settings.to_dict())


@settings.route("/settings/<category>", methods=["GET"])
def get_category_settings(category):
    """Get settings for a specific category"""
    settings = Settings.query.first()
    if not settings:
        settings = Settings.get_default_settings()
        db.session.add(settings)
        db.session.commit()

    settings_dict = settings.to_dict()
    if category not in settings_dict:
        return jsonify(
            {"error": f"Category {category} not found"}
        ), HTTPStatus.NOT_FOUND

    return jsonify(settings_dict[category])


@settings.route("/settings/<category>", methods=["PUT"])
def update_category_settings(category):
    """Update settings for a specific category"""
    data = request.get_json()
    
    # Validate based on category
    try:
        if category == "general":
            from schemas.settings import GeneralSettings
            validated_data = GeneralSettings(**data).dict(exclude_none=True)
        elif category == "store_hours":
            from schemas.settings import StoreHoursSettings
            validated_data = StoreHoursSettings(**data).dict(exclude_none=True)
        elif category == "scheduling_advanced":
            from schemas.settings import AdvancedSettings
            validated_data = AdvancedSettings(**data).dict(exclude_none=True)
        else:
            # For custom categories, use generic validation
            validated_data = CategorySettings(**data).__root__
    except ValidationError as e:
        return jsonify({"error": "Invalid input data", "details": e.errors()}), HTTPStatus.BAD_REQUEST
    
    settings = Settings.query.first()

    if not settings:
        settings = Settings.get_default_settings()
        db.session.add(settings)

    try:
        settings.update_from_dict({category: validated_data})
        db.session.commit()
        return jsonify(settings.to_dict()[category])
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), HTTPStatus.BAD_REQUEST


@settings.route("/settings/<category>/<key>", methods=["PUT"])
def update_setting(category, key):
    """Update a specific setting"""
    data = request.get_json()
    
    # Validate input using Pydantic schema
    try:
        setting_value = SettingValue(**data)
        value = setting_value.value
    except ValidationError as e:
        return jsonify({"error": "Invalid input data", "details": e.errors()}), HTTPStatus.BAD_REQUEST
    
    settings = Settings.query.first()

    if not settings:
        settings = Settings.get_default_settings()
        db.session.add(settings)

    try:
        settings_dict = settings.to_dict()

        if category not in settings_dict:
            return jsonify(
                {"error": f"Category {category} not found"}
            ), HTTPStatus.NOT_FOUND

        category_dict = settings_dict[category]
        if key not in category_dict:
            return jsonify(
                {"error": f"Key {key} not found in category {category}"}
            ), HTTPStatus.NOT_FOUND

        settings.update_from_dict({category: {key: value}})
        db.session.commit()
        return jsonify({key: value})
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), HTTPStatus.BAD_REQUEST


@settings.route("/settings/<category>/<key>", methods=["DELETE"])
def delete_setting(category, key):
    """Delete a specific setting (reset to default)"""
    settings = Settings.query.first()
    if not settings:
        return jsonify({"error": "Settings not found"}), HTTPStatus.NOT_FOUND

    try:
        default_settings = Settings.get_default_settings()
        settings_dict = default_settings.to_dict()

        if category not in settings_dict:
            return jsonify(
                {"error": f"Category {category} not found"}
            ), HTTPStatus.NOT_FOUND

        category_dict = settings_dict[category]
        if key not in category_dict:
            return jsonify(
                {"error": f"Key {key} not found in category {category}"}
            ), HTTPStatus.NOT_FOUND

        # Reset the specific setting to its default value
        settings.update_from_dict({category: {key: category_dict[key]}})
        db.session.commit()
        return jsonify({"message": f"Setting {category}.{key} reset to default"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), HTTPStatus.BAD_REQUEST


def get_log_files():
    """Get all log files from logs directory and sessions subdirectory"""
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    logs_dir = os.path.join(base_dir, "logs")

    # Get all .log files from main logs directory
    main_logs = glob.glob(os.path.join(logs_dir, "*.log"))

    # Get all .log files from sessions subdirectory
    sessions_dir = os.path.join(logs_dir, "sessions")
    session_logs = (
        glob.glob(os.path.join(sessions_dir, "*.log"))
        if os.path.exists(sessions_dir)
        else []
    )

    # Combine and sort by modification time (newest first)
    all_logs = main_logs + session_logs
    all_logs.sort(key=lambda x: os.path.getmtime(x), reverse=True)

    return all_logs


@settings.route("/settings/logs", methods=["GET"])
@settings.route("/settings/logs/", methods=["GET"])
def get_logs():
    """Get list of available log files"""
    try:
        log_files = get_log_files()
        logs_info = []

        for log_path in log_files:
            file_name = os.path.basename(log_path)
            file_size = os.path.getsize(log_path)
            mod_time = datetime.datetime.fromtimestamp(os.path.getmtime(log_path))

            # Read the last few lines for preview
            try:
                with open(log_path, "r") as f:
                    # Read last 5 lines for preview
                    lines = f.readlines()[-5:]
                    preview = "".join(lines).strip()
            except Exception as e:
                preview = f"Error reading log: {str(e)}"

            logs_info.append(
                {
                    "name": file_name,
                    "path": log_path,
                    "size": file_size,
                    "modified": mod_time.isoformat(),
                    "preview": preview,
                }
            )

        return jsonify({"logs": logs_info}), HTTPStatus.OK
    except Exception as e:
        return jsonify({"error": str(e)}), HTTPStatus.INTERNAL_SERVER_ERROR


@settings.route("/settings/logs/<path:filename>", methods=["GET"])
def get_log_content(filename):
    """Get content of a specific log file"""
    try:
        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
        logs_dir = os.path.join(base_dir, "logs")

        # Check both main logs directory and sessions subdirectory
        log_path = os.path.join(logs_dir, filename)
        sessions_path = os.path.join(logs_dir, "sessions", filename)

        if os.path.exists(log_path):
            final_path = log_path
        elif os.path.exists(sessions_path):
            final_path = sessions_path
        else:
            return jsonify({"error": "Log file not found"}), HTTPStatus.NOT_FOUND

        # Validate that the file is within the logs directory
        if not os.path.realpath(final_path).startswith(os.path.realpath(logs_dir)):
            return jsonify({"error": "Invalid log file path"}), HTTPStatus.BAD_REQUEST

        with open(final_path, "r") as f:
            content = f.read()

        return jsonify(
            {
                "name": filename,
                "content": content,
                "size": os.path.getsize(final_path),
                "modified": datetime.datetime.fromtimestamp(
                    os.path.getmtime(final_path)
                ).isoformat(),
            }
        ), HTTPStatus.OK
    except Exception as e:
        return jsonify({"error": str(e)}), HTTPStatus.INTERNAL_SERVER_ERROR


@settings.route("/settings/logs/<path:filename>", methods=["DELETE"])
def delete_log(filename):
    """Delete a specific log file"""
    try:
        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
        logs_dir = os.path.join(base_dir, "logs")

        # Check both main logs directory and sessions subdirectory
        log_path = os.path.join(logs_dir, filename)
        sessions_path = os.path.join(logs_dir, "sessions", filename)

        if os.path.exists(log_path):
            final_path = log_path
        elif os.path.exists(sessions_path):
            final_path = sessions_path
        else:
            return jsonify({"error": "Log file not found"}), HTTPStatus.NOT_FOUND

        # Validate that the file is within the logs directory
        if not os.path.realpath(final_path).startswith(os.path.realpath(logs_dir)):
            return jsonify({"error": "Invalid log file path"}), HTTPStatus.BAD_REQUEST

        os.remove(final_path)
        return jsonify(
            {"message": f"Log file {filename} deleted successfully"}
        ), HTTPStatus.OK
    except Exception as e:
        return jsonify({"error": str(e)}), HTTPStatus.INTERNAL_SERVER_ERROR


@settings.route("/settings/scheduling/generation", methods=["GET"])
def get_generation_settings():
    """Get schedule generation settings"""
    try:
        settings_obj = Settings.query.first()
        if not settings_obj:
            settings_obj = Settings.get_default_settings()
            db.session.add(settings_obj)
            db.session.commit()

        # Default generation settings
        default_requirements = {
            "enforce_minimum_coverage": True,
            "enforce_contracted_hours": True,
            "enforce_keyholder_coverage": True,
            "enforce_rest_periods": True,
            "enforce_early_late_rules": True,
            "enforce_employee_group_rules": True,
            "enforce_break_rules": True,
            "enforce_max_hours": True,
            "enforce_consecutive_days": True,
            "enforce_weekend_distribution": True,
            "enforce_shift_distribution": True,
            "enforce_availability": True,
            "enforce_qualifications": True,
            "enforce_opening_hours": True,
        }

        # Try to get settings from scheduling_advanced
        if (
            hasattr(settings_obj, "scheduling_advanced")
            and settings_obj.scheduling_advanced
        ):
            scheduling_advanced = settings_obj.scheduling_advanced
            if (
                isinstance(scheduling_advanced, dict)
                and "generation_requirements" in scheduling_advanced
            ):
                # Return stored settings with defaults filled in
                generation_requirements = scheduling_advanced["generation_requirements"]
                # Ensure all required keys are present
                for key, value in default_requirements.items():
                    if key not in generation_requirements:
                        generation_requirements[key] = value
                return jsonify(generation_requirements), HTTPStatus.OK

        # If we get here, return default settings
        return jsonify(default_requirements), HTTPStatus.OK
    except Exception as e:
        logging.error(f"Error getting generation settings: {str(e)}")
        return jsonify({"error": str(e)}), HTTPStatus.INTERNAL_SERVER_ERROR


@settings.route("/settings/scheduling/generation", methods=["PUT"])
def update_generation_settings():
    """Update schedule generation settings"""
    try:
        # Get request data
        data = request.json
        if not data:
            return jsonify({"error": "No data provided"}), HTTPStatus.BAD_REQUEST

        # Validate input using Pydantic schema
        try:
            generation_settings = GenerationRequirements(**data)
            validated_data = generation_settings.dict(exclude_none=True)
        except ValidationError as e:
            return jsonify({"error": "Invalid input data", "details": e.errors()}), HTTPStatus.BAD_REQUEST

        # Get settings
        settings_obj = Settings.query.first()
        if not settings_obj:
            settings_obj = Settings.get_default_settings()
            db.session.add(settings_obj)
            db.session.commit()

        # Initialize scheduling_advanced if it doesn't exist
        if settings_obj.scheduling_advanced is None:
            settings_obj.scheduling_advanced = {}

        # Update generation requirements
        if "generation_requirements" not in settings_obj.scheduling_advanced:
            settings_obj.scheduling_advanced["generation_requirements"] = {}

        # Update with validated values
        settings_obj.scheduling_advanced["generation_requirements"].update(validated_data)
        db.session.commit()

        return jsonify(
            settings_obj.scheduling_advanced["generation_requirements"]
        ), HTTPStatus.OK
    except Exception as e:
        logging.error(f"Error updating generation settings: {str(e)}")
        return jsonify({"error": str(e)}), HTTPStatus.INTERNAL_SERVER_ERROR
