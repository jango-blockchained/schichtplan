import os
import json
import datetime
from flask import Blueprint, jsonify, request, send_file
from ..models import Settings
from http import HTTPStatus
from sqlalchemy import inspect, text

bp = Blueprint("api_settings", __name__, url_prefix="/api/settings")


@bp.route("/", methods=["GET"])
def get_settings():
    """Get all settings or initialize with defaults if none exist"""
    from ..models import db
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
        # Import db inside function (needed for rollback/commit)
        from ..models import db
        # If there's an unexpected error, try to reset and recreate settings
        try:
            Settings.query.delete()
            db.session.commit()

            settings = Settings.get_default_settings()
            db.session.add(settings)
            db.session.commit()

            return jsonify(settings.to_dict())
        except Exception as reset_error:
            # Ensure db is imported for rollback if needed
            # from ..models import db # Already imported in outer except
            # db.session.rollback() # Rollback might be handled by context exit
            return jsonify(
                {"error": f"Critical error retrieving settings: {str(reset_error)}"}
            ), HTTPStatus.INTERNAL_SERVER_ERROR


@bp.route("/", methods=["PUT"])
def update_settings():
    """Update settings"""
    from ..models import db
    try:
        data = request.get_json()
        settings = Settings.query.first()

        if not settings:
            settings = Settings.get_default_settings()
            db.session.add(settings)

        settings.update_from_dict(data)
        db.session.commit()

        return jsonify(settings.to_dict())
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), HTTPStatus.INTERNAL_SERVER_ERROR


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
    from ..models import db
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
                    # Using DELETE is safer
                    db.session.execute(text(f'DELETE FROM "{table_name}";'))

            # Restore data
            for table_name, records in data.items():
                table = db.metadata.tables.get(table_name)
                if table is not None and records:
                    # Insert records individually for better type handling
                    for record_data in records:
                        for key, value in record_data.items():
                            col_type = table.c[key].type
                            if isinstance(col_type, db.DateTime) and value:
                                record_data[key] = datetime.datetime.fromisoformat(
                                    value
                                )
                            elif isinstance(col_type, db.Date) and value:
                                record_data[key] = datetime.date.fromisoformat(
                                    value
                                )
                        db.session.execute(
                            table.insert().values(**record_data)
                        )

        return jsonify({"message": "Database restored successfully"}), HTTPStatus.OK
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), HTTPStatus.INTERNAL_SERVER_ERROR


@bp.route("/wipe-tables", methods=["POST"])
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
        return jsonify(
            {"error": f"Invalid table names: {', '.join(invalid_tables)}"}
        ), HTTPStatus.BAD_REQUEST

    try:
        # Start a transaction
        with db.session.begin():
            # Disable FK checks for SQLite
            if db.engine.name == 'sqlite':
                db.session.execute(text("PRAGMA foreign_keys=OFF"))

            for table_name in tables_to_wipe:
                 # Using DELETE is safer than TRUNCATE
                 # db.session.execute(f"TRUNCATE TABLE {table_name} CASCADE")
                 db.session.execute(text(f'DELETE FROM "{table_name}";'))
                 # Try reset sequence for SQLite
                 if db.engine.name == 'sqlite':
                     try:
                         db.session.execute(text("DELETE FROM sqlite_sequence WHERE name=:table_name"), {"table_name": table_name})
                     except Exception as seq_e:
                         if "no such table: sqlite_sequence" not in str(seq_e):
                             raise

            # Re-enable FK checks for SQLite
            if db.engine.name == 'sqlite':
                db.session.execute(text("PRAGMA foreign_keys=ON"))

        return jsonify(
            {"message": "Tables wiped successfully", "wiped_tables": tables_to_wipe}
        ), HTTPStatus.OK
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), HTTPStatus.INTERNAL_SERVER_ERROR


@bp.route("/tables", methods=["GET"])
def get_tables():
    """Get list of available database tables"""
    from ..models import db
    try:
        inspector = inspect(db.engine)
        tables = [t for t in inspector.get_table_names() if t != "alembic_version"]
        return jsonify({"tables": tables}), HTTPStatus.OK
    except Exception as e:
        return jsonify({"error": str(e)}), HTTPStatus.INTERNAL_SERVER_ERROR


# ... rest of the existing code ...
