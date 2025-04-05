from flask import Blueprint, jsonify, request, send_file
from ..models import Settings
from http import HTTPStatus
import logging
import os
import json
import datetime
import glob
from sqlalchemy import inspect, text

settings = Blueprint("settings", __name__)


def serialize_db():
    """Serialize all database tables into a JSON structure"""
    from ..models import db
    data = {}
    inspector = inspect(db.engine)

    for table_name in inspector.get_table_names():
        if table_name != "alembic_version":  # Skip migration table
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
                        # Ensure proper serialization for various types
                        if isinstance(value, datetime.datetime):
                            value = value.isoformat()
                        elif isinstance(value, datetime.date):
                            value = value.isoformat()
                        elif isinstance(value, datetime.timedelta):
                            value = value.total_seconds() # Or str(value)
                        # Add more types if needed (e.g., Decimal)
                        record_dict[column.name] = value
                    records.append(record_dict)
            data[table_name] = records
    return data


@settings.route("/settings/backup", methods=["GET"])
def backup_database():
    """Export the entire database as JSON"""
    try:
        data = serialize_db()
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"backup_{timestamp}.json"

        # Save to a temporary file (use app.instance_path if possible)
        backup_dir = os.path.join(os.getcwd(), "instance", "backups")
        os.makedirs(backup_dir, exist_ok=True)
        backup_path = os.path.join(backup_dir, filename)

        with open(backup_path, "w", encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

        return send_file(
            backup_path,
            mimetype="application/json",
            as_attachment=True,
            download_name=filename,
        )
    except Exception as e:
        logging.exception("Error during database backup") # Log error
        return jsonify({"error": str(e)}), HTTPStatus.INTERNAL_SERVER_ERROR


@settings.route("/settings/restore", methods=["POST"])
def restore_database():
    """Restore the database from a JSON backup"""
    from ..models import db
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), HTTPStatus.BAD_REQUEST

    file = request.files["file"]
    if not file or not file.filename.endswith(".json"):
        return jsonify({"error": "Invalid file format"}), HTTPStatus.BAD_REQUEST

    try:
        data = json.load(file)

        # Start a transaction
        with db.session.begin():
            inspector = inspect(db.engine)
            table_names = inspector.get_table_names()

            # Disable foreign key checks (specific to DB, e.g., SQLite)
            if db.engine.name == 'sqlite':
                db.session.execute(text('PRAGMA foreign_keys=OFF;'))

            # Clear existing data carefully, respecting dependencies if possible
            # This simple truncate might fail with FKs without CASCADE
            for table_name in reversed(table_names):
                if table_name != "alembic_version":
                    # Use DELETE for better compatibility
                    db.session.execute(text(f'DELETE FROM "{table_name}";'))

            # Restore data
            # Consider order if there are FK dependencies
            for table_name, records in data.items():
                table = db.metadata.tables.get(table_name)
                if table is not None and records:
                     # Process records individually for better type handling
                    for record_data in records:
                        # Convert dates back if needed
                        for key, value in record_data.items():
                             if isinstance(table.c[key].type, db.DateTime) and value:
                                 record_data[key] = datetime.datetime.fromisoformat(value)
                             elif isinstance(table.c[key].type, db.Date) and value:
                                 record_data[key] = datetime.date.fromisoformat(value)
                        # Insert record
                        db.session.execute(table.insert().values(**record_data))

            # Re-enable foreign key checks
            if db.engine.name == 'sqlite':
                db.session.execute(text('PRAGMA foreign_keys=ON;'))

        return jsonify({"message": "Database restored successfully"}), HTTPStatus.OK

    except Exception as e:
        db.session.rollback()
        logging.exception("Error during database restore")
        return jsonify({"error": str(e)}), HTTPStatus.INTERNAL_SERVER_ERROR


@settings.route("/settings/tables", methods=["GET"])
def get_tables():
    """Get list of available database tables"""
    from ..models import db
    try:
        inspector = inspect(db.engine)
        tables = [t for t in inspector.get_table_names() if t != "alembic_version"]
        return jsonify({"tables": tables}), HTTPStatus.OK
    except Exception as e:
        return jsonify({"error": str(e)}), HTTPStatus.INTERNAL_SERVER_ERROR


@settings.route("/settings/wipe-tables", methods=["POST"])
def wipe_tables():
    """Wipe specific database tables"""
    from ..models import db
    if not request.is_json:
        return jsonify(
            {"error": "Content-Type must be application/json"}
        ), HTTPStatus.BAD_REQUEST

    data = request.get_json()
    if not data or not isinstance(data.get("tables"), list):
        return jsonify({"error": "tables list is required"}), HTTPStatus.BAD_REQUEST

    tables_to_wipe = data["tables"]
    inspector = inspect(db.engine)
    available_tables = [
        t for t in inspector.get_table_names() if t != "alembic_version"
    ]

    # Validate table names
    invalid_tables = [t for t in tables_to_wipe if t not in available_tables]
    if invalid_tables:
        error_msg = f"Invalid table names: {', '.join(invalid_tables)}"
        return (
            jsonify({"error": error_msg}),
            HTTPStatus.BAD_REQUEST,
        )

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


@settings.route("/settings/", methods=["GET"])
def get_settings():
    """Get all settings or initialize with defaults if none exist"""
    from ..models import db
    try:
        settings_obj = Settings.query.first()

        # If no settings exist, initialize with defaults
        if not settings_obj:
            settings_obj = Settings.get_default_settings()
            db.session.add(settings_obj)
            try:
                db.session.commit()
            except Exception as e:
                db.session.rollback()
                logging.exception("Error initializing settings")
                return (
                    jsonify({"error": f"Error initializing settings: {str(e)}"}),
                    HTTPStatus.INTERNAL_SERVER_ERROR,
                )

        return jsonify(settings_obj.to_dict())
    except Exception:
        logging.exception("Critical error retrieving settings, attempting reset")
        # If there's an unexpected error, try to reset and recreate settings
        try:
            Settings.query.delete()
            db.session.commit()

            settings_obj = Settings.get_default_settings()
            db.session.add(settings_obj)
            db.session.commit()

            return jsonify(settings_obj.to_dict())
        except Exception as reset_error:
            logging.exception("Failed to reset settings after critical error")
            return (
                jsonify(
                    {"error": f"Critical error retrieving settings: {str(reset_error)}"}
                ),
                HTTPStatus.INTERNAL_SERVER_ERROR,
            )


@settings.route("/settings/", methods=["PUT"])
def update_settings():
    """Update settings"""
    from ..models import db
    data = request.get_json()
    settings_obj = Settings.query.first()

    if not settings_obj:
        settings_obj = Settings.get_default_settings()
        db.session.add(settings_obj)

    try:
        settings_obj.update_from_dict(data)
        db.session.commit()
        return jsonify(settings_obj.to_dict())
    except Exception as e:
        db.session.rollback()
        logging.exception("Error updating settings")
        return jsonify({"error": str(e)}), HTTPStatus.INTERNAL_SERVER_ERROR


@settings.route("/settings/reset", methods=["POST"])
def reset_settings():
    """Reset settings to default"""
    from ..models import db
    try:
        Settings.query.delete()
        db.session.commit()
        settings_obj = Settings.get_default_settings()
        db.session.add(settings_obj)
        db.session.commit()
        return jsonify(settings_obj.to_dict())
    except Exception as e:
        db.session.rollback()
        logging.exception("Error resetting settings")
        return jsonify({"error": str(e)}), HTTPStatus.INTERNAL_SERVER_ERROR


@settings.route("/settings/<category>", methods=["GET"])
def get_category_settings(category):
    """Get settings for a specific category."""
    settings_obj = Settings.query.first()
    if not settings_obj:
        return jsonify({"error": "Settings not initialized"}), HTTPStatus.NOT_FOUND

    if category not in settings_obj.settings:
        return jsonify({"error": f"Category '{category}' not found"}), HTTPStatus.NOT_FOUND

    return jsonify(settings_obj.settings[category])


@settings.route("/settings/<category>", methods=["PUT"])
def update_category_settings(category):
    """Update settings for a specific category."""
    from ..models import db
    data = request.get_json()
    settings_obj = Settings.query.first()

    if not settings_obj:
        settings_obj = Settings.get_default_settings()
        db.session.add(settings_obj)

    if category not in settings_obj.settings:
         settings_obj.settings[category] = {}

    settings_obj.settings[category].update(data)
    # Mark the settings field as modified for JSON type mutation tracking
    db.flag_modified(settings_obj, "settings")

    try:
        db.session.commit()
        return jsonify(settings_obj.settings[category])
    except Exception as e:
        db.session.rollback()
        logging.exception(f"Error updating category settings for {category}")
        return jsonify({"error": str(e)}), HTTPStatus.INTERNAL_SERVER_ERROR


@settings.route("/settings/<category>/<key>", methods=["PUT"])
def update_setting(category, key):
    """Update a specific setting."""
    from ..models import db
    data = request.get_json()
    if 'value' not in data:
        return jsonify({"error": "Missing 'value' in request body"}), HTTPStatus.BAD_REQUEST

    value = data['value']
    settings_obj = Settings.query.first()

    if not settings_obj:
        settings_obj = Settings.get_default_settings()
        db.session.add(settings_obj)

    if category not in settings_obj.settings:
        settings_obj.settings[category] = {}

    settings_obj.settings[category][key] = value
    # Mark the settings field as modified for JSON type mutation tracking
    db.flag_modified(settings_obj, "settings")

    try:
        db.session.commit()
        return jsonify({"message": f"Setting {category}.{key} updated"})
    except Exception as e:
        db.session.rollback()
        logging.exception(f"Error updating setting {category}.{key}")
        return jsonify({"error": str(e)}), HTTPStatus.INTERNAL_SERVER_ERROR


@settings.route("/settings/<category>/<key>", methods=["DELETE"])
def delete_setting(category, key):
    """Delete a specific setting."""
    from ..models import db
    settings_obj = Settings.query.first()

    if not settings_obj or category not in settings_obj.settings or key not in settings_obj.settings[category]:
        return jsonify({"error": f"Setting {category}.{key} not found"}), HTTPStatus.NOT_FOUND

    del settings_obj.settings[category][key]
    if not settings_obj.settings[category]: # Remove category if empty
        del settings_obj.settings[category]

    # Mark the settings field as modified for JSON type mutation tracking
    db.flag_modified(settings_obj, "settings")

    try:
        db.session.commit()
        return jsonify({"message": f"Setting {category}.{key} deleted"}), HTTPStatus.OK
    except Exception as e:
        db.session.rollback()
        logging.exception(f"Error deleting setting {category}.{key}")
        return jsonify({"error": str(e)}), HTTPStatus.INTERNAL_SERVER_ERROR


def get_log_files(log_dir="src/logs"):
    """Get list of log files"""
    if not os.path.exists(log_dir):
        return []
    # Use glob to find log files, handle potential path issues
    pattern = os.path.join(log_dir, "*.log")
    log_files_with_path = glob.glob(pattern)
    log_files = [
        {
            "name": os.path.basename(f),
            "path": os.path.relpath(f, os.getcwd()), # Path relative to cwd
            "size": os.path.getsize(f),
            "modified": datetime.datetime.fromtimestamp(
                os.path.getmtime(f)
            ).isoformat(),
        }
        for f in log_files_with_path
    ]
    return sorted(log_files, key=lambda x: x["modified"], reverse=True)


@settings.route("/settings/logs", methods=["GET"])
def get_logs():
    """Get list of available log files"""
    try:
        # Find the log directory relative to the current file
        # This assumes routes/settings.py is the structure
        current_dir = os.path.dirname(os.path.abspath(__file__))
        # Go up two levels (routes -> backend) then into logs
        log_dir = os.path.join(current_dir, "..", "..", "logs")

        if not os.path.exists(log_dir) or not os.path.isdir(log_dir):
             # Fallback if structure is different
             log_dir_fallback = "src/logs"
             if os.path.exists(log_dir_fallback) and os.path.isdir(log_dir_fallback):
                 log_dir = log_dir_fallback
             else:
                 return jsonify({"logs": [], "message": "Log directory not found"}), HTTPStatus.OK

        log_files = get_log_files(log_dir)
        return jsonify({"logs": log_files})

    except Exception as e:
        logging.exception("Error getting log files list")
        return jsonify({"error": str(e)}), HTTPStatus.INTERNAL_SERVER_ERROR


@settings.route("/logs/<path:filename>", methods=["GET"])
def get_log_content(filename):
    """Get the content of a specific log file"""
    try:
        # Prevent path traversal
        if ".." in filename or filename.startswith("/"):
            return jsonify({"error": "Invalid filename"}), HTTPStatus.BAD_REQUEST

        # Find the log directory relative to the current file
        current_dir = os.path.dirname(os.path.abspath(__file__))
        log_dir = os.path.join(current_dir, "..", "..", "logs")

        # Construct the full path safely
        full_path = os.path.abspath(os.path.join(log_dir, filename))

        # Double check it's still within the intended log directory
        if not full_path.startswith(os.path.abspath(log_dir)):
             return jsonify({"error": "Access denied"}), HTTPStatus.FORBIDDEN

        if not os.path.exists(full_path) or not os.path.isfile(full_path):
            # Try fallback path if initial guess failed
            log_dir_fallback = "src/logs"
            full_path_fallback = os.path.abspath(os.path.join(log_dir_fallback, filename))
            if not full_path_fallback.startswith(os.path.abspath(log_dir_fallback)):
                 return jsonify({"error": "Access denied"}), HTTPStatus.FORBIDDEN
            if not os.path.exists(full_path_fallback) or not os.path.isfile(full_path_fallback):
                 return jsonify({"error": "Log file not found"}), HTTPStatus.NOT_FOUND
            full_path = full_path_fallback


        # Limit read size for safety
        max_size = 10 * 1024 * 1024  # 10 MB limit
        file_size = os.path.getsize(full_path)

        if file_size > max_size:
            # Read only the last part of the file
            with open(full_path, "rb") as f:
                f.seek(-max_size, os.SEEK_END)
                content = f.read().decode("utf-8", errors="ignore")
            message = f"Log file truncated to last {max_size // 1024 // 1024} MB"
        else:
            with open(full_path, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()
            message = "Complete log content"

        return jsonify({"filename": filename, "content": content, "message": message})

    except Exception as e:
        logging.exception(f"Error getting log content for {filename}")
        return jsonify({"error": str(e)}), HTTPStatus.INTERNAL_SERVER_ERROR


@settings.route("/logs/<path:filename>", methods=["DELETE"])
def delete_log(filename):
    """Delete a specific log file"""
    try:
        # Prevent path traversal
        if ".." in filename or filename.startswith("/"):
            return jsonify({"error": "Invalid filename"}), HTTPStatus.BAD_REQUEST

        # Construct the full path safely (similar logic to GET)
        current_dir = os.path.dirname(os.path.abspath(__file__))
        log_dir = os.path.join(current_dir, "..", "..", "logs")
        full_path = os.path.abspath(os.path.join(log_dir, filename))

        if not full_path.startswith(os.path.abspath(log_dir)):
             return jsonify({"error": "Access denied"}), HTTPStatus.FORBIDDEN

        if not os.path.exists(full_path) or not os.path.isfile(full_path):
             # Check fallback
             log_dir_fallback = "src/logs"
             full_path_fallback = os.path.abspath(os.path.join(log_dir_fallback, filename))
             if not full_path_fallback.startswith(os.path.abspath(log_dir_fallback)):
                  return jsonify({"error": "Access denied"}), HTTPStatus.FORBIDDEN
             if not os.path.exists(full_path_fallback) or not os.path.isfile(full_path_fallback):
                  return jsonify({"error": "Log file not found"}), HTTPStatus.NOT_FOUND
             full_path = full_path_fallback

        os.remove(full_path)
        return jsonify({"message": f"Log file '{filename}' deleted"}), HTTPStatus.OK

    except OSError as e:
        logging.exception(f"OS error deleting log file {filename}")
        return jsonify({"error": f"Could not delete file: {str(e)}"}), HTTPStatus.INTERNAL_SERVER_ERROR
    except Exception as e:
        logging.exception(f"Error deleting log file {filename}")
        return jsonify({"error": str(e)}), HTTPStatus.INTERNAL_SERVER_ERROR


@settings.route("/scheduling/generation", methods=["GET"])
def get_generation_settings():
    """Get scheduling generation specific settings."""
    settings_obj = Settings.query.first()
    if not settings_obj:
        return jsonify({"error": "Settings not initialized"}), HTTPStatus.NOT_FOUND

    # Define the keys relevant to generation
    generation_keys = [
        "min_rest_hours", "max_shifts_per_week", "allow_late_early", 
        "keyholder_on_open_close", "min_shift_duration", 
        "max_shift_duration", "break_rules", "coverage_requirements",
        "employee_group_priorities", "store_id", # Assuming store_id is relevant
        # Add any other relevant keys here
    ]

    generation_settings = {}
    # Extract relevant settings from the main settings JSON
    # Look in root level first, then nested if applicable (e.g., in a 'scheduling' category)
    for key in generation_keys:
        if key in settings_obj.settings:
            generation_settings[key] = settings_obj.settings[key]
        elif 'scheduling' in settings_obj.settings and key in settings_obj.settings['scheduling']:
            generation_settings[key] = settings_obj.settings['scheduling'][key]
        else:
            # Provide default or indicate missing if necessary
            generation_settings[key] = None # Or fetch default from Settings model

    return jsonify(generation_settings)


@settings.route("/scheduling/generation", methods=["PUT"])
def update_generation_settings():
    """Update multiple scheduling generation settings."""
    from ..models import db
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), HTTPStatus.BAD_REQUEST

    settings_obj = Settings.query.first()
    if not settings_obj:
        settings_obj = Settings.get_default_settings()
        db.session.add(settings_obj)

    # Update the settings, potentially nested under 'scheduling'
    # Decide on structure: flat or nested?
    # Option 1: Store under a 'scheduling' key
    if 'scheduling' not in settings_obj.settings:
        settings_obj.settings['scheduling'] = {}
    settings_obj.settings['scheduling'].update(data)
    
    # Option 2: Store directly in root (if keys are unique)
    # settings_obj.settings.update(data)

    # Mark as modified
    db.flag_modified(settings_obj, "settings")

    try:
        db.session.commit()
        # Return the updated subset of settings
        updated_data = settings_obj.settings.get('scheduling', {})
        return jsonify(updated_data), HTTPStatus.OK
    except Exception as e:
        db.session.rollback()
        logging.exception("Error updating generation settings")
        return jsonify({"error": str(e)}), HTTPStatus.INTERNAL_SERVER_ERROR
