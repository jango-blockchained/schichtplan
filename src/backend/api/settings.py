import os
import json
import datetime
from flask import Blueprint, jsonify, request, send_file
from models import db
from http import HTTPStatus
from sqlalchemy import inspect

bp = Blueprint("settings", __name__, url_prefix="/api/settings")


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


# ... rest of the existing code ...
