import datetime
import json
import os
from http import HTTPStatus

from flask import Blueprint, jsonify, request, send_file
from sqlalchemy import inspect

from src.backend.models import Settings, db

bp = Blueprint("settings", __name__, url_prefix="/api/v2/settings")


@bp.route("/", methods=["GET"])
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
                return jsonify(
                    {"error": f"Error initializing settings: {str(e)}"}
                ), HTTPStatus.INTERNAL_SERVER_ERROR

        return jsonify(settings.to_dict())
    except Exception:
        # If there's an unexpected error, try to reset and recreate settings
        try:
            Settings.query.delete()
            db.session.commit()

            settings = Settings.get_default_settings()
            db.session.add(settings)
            db.session.commit()

            return jsonify(settings.to_dict())
        except Exception as reset_error:
            return jsonify(
                {"error": f"Critical error retrieving settings: {str(reset_error)}"}
            ), HTTPStatus.INTERNAL_SERVER_ERROR


def _validate_settings_input(
    data: dict,
) -> tuple[str | None, HTTPStatus | None]:
    """Validate settings input data.

    Returns (error_message, status_code) or (None, None) if valid.
    """
    # Validation rules: path -> (expected_type, error_message)
    validation_rules = {
        "general": (dict, "Invalid input: 'general' must be an object"),
        "ai_scheduling": (
            dict,
            "Invalid input: 'ai_scheduling' must be an object",
        ),
        "ai_scheduling.enabled": (
            bool,
            "Invalid input: 'ai_scheduling.enabled' must be a boolean",
        ),
        "ai_scheduling.api_keys": (
            dict,
            "Invalid input: 'ai_scheduling.api_keys' must be an object",
        ),
    }

    for field_path, (expected_type, error_msg) in validation_rules.items():
        if "." in field_path:
            parts = field_path.split(".")
            if len(parts) == 2:  # noqa: PLR2004
                parent, child = parts
                if (
                    parent in data
                    and isinstance(data[parent], dict)
                    and child in data[parent]
                ):
                    value = data[parent][child]
                    if not isinstance(value, expected_type):
                        return error_msg, HTTPStatus.BAD_REQUEST
        elif field_path in data and not isinstance(data[field_path], expected_type):
            return error_msg, HTTPStatus.BAD_REQUEST

    return None, None


@bp.route("/", methods=["PUT"])
def update_settings():
    """Update settings"""
    try:
        data = request.get_json()
        if not data:
            return jsonify(
                {"error": "Invalid input: No data provided"}
            ), HTTPStatus.BAD_REQUEST

        # Validate input
        error_msg, status = _validate_settings_input(data)
        if error_msg:
            return jsonify({"error": error_msg}), status

        settings = Settings.query.first()

        if not settings:
            settings = Settings.get_default_settings()
            db.session.add(settings)

        settings.update_from_dict(data)
        db.session.commit()

        result = settings.to_dict()
        return jsonify(result)
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), HTTPStatus.INTERNAL_SERVER_ERROR


def serialize_db():
    """Serialize all database tables into a JSON structure"""
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
                        if isinstance(value, datetime.datetime):
                            value = value.isoformat()
                        record_dict[column.name] = value
                    records.append(record_dict)
            data[table_name] = records
    return data


@bp.route("/backup", methods=["GET"])
def backup_database():
    """Export the entire database as JSON"""
    try:
        data = serialize_db()
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"backup_{timestamp}.json"

        # Save to a temporary file
        backup_path = os.path.join("/tmp", filename)
        with open(backup_path, "w") as f:
            json.dump(data, f, indent=2)

        return send_file(
            backup_path,
            mimetype="application/json",
            as_attachment=True,
            download_name=filename,
        )
    except Exception as e:
        return jsonify({"error": str(e)}), HTTPStatus.INTERNAL_SERVER_ERROR


@bp.route("/restore", methods=["POST"])
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


@bp.route("/wipe-tables", methods=["POST"])
def wipe_tables():
    """Wipe specific database tables"""
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
        return jsonify(
            {"error": f"Invalid table names: {', '.join(invalid_tables)}"}
        ), HTTPStatus.BAD_REQUEST

    try:
        # Start a transaction
        with db.session.begin():
            for table_name in tables_to_wipe:
                db.session.execute(f"TRUNCATE TABLE {table_name} CASCADE")

        return jsonify(
            {"message": "Tables wiped successfully", "wiped_tables": tables_to_wipe}
        ), HTTPStatus.OK
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), HTTPStatus.INTERNAL_SERVER_ERROR


@bp.route("/tables", methods=["GET"])
def get_tables():
    """Get list of available database tables"""
    try:
        inspector = inspect(db.engine)
        tables = [t for t in inspector.get_table_names() if t != "alembic_version"]
        return jsonify({"tables": tables}), HTTPStatus.OK
    except Exception as e:
        return jsonify({"error": str(e)}), HTTPStatus.INTERNAL_SERVER_ERROR


# ... rest of the existing code ...
