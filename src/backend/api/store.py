from flask import Blueprint, request, jsonify
from models import db, Settings
from sqlalchemy.exc import IntegrityError
from http import HTTPStatus
from datetime import datetime

bp = Blueprint("store", __name__, url_prefix="/api/store")


@bp.route("/config", methods=["GET"])
@bp.route("/config/", methods=["GET"])
def get_config():
    """Get store configuration"""
    config = Settings.query.first()

    if not config:
        config = Settings.get_default_config()
        db.session.add(config)
        db.session.commit()

    return jsonify(
        {
            "id": config.id,
            "store_name": config.store_name,
            "opening_time": config.opening_time.strftime("%H:%M"),
            "closing_time": config.closing_time.strftime("%H:%M"),
            "break_duration_minutes": config.break_duration_minutes,
        }
    ), HTTPStatus.OK


@bp.route("/config", methods=["PUT"])
@bp.route("/config/", methods=["PUT"])
def update_config():
    """Update store configuration"""
    config = Settings.query.first()
    if not config:
        config = Settings.get_default_config()
        db.session.add(config)

    data = request.get_json()

    try:
        if "store_name" in data:
            config.store_name = data["store_name"]
        if "opening_time" in data:
            config.opening_time = datetime.strptime(
                data["opening_time"], "%H:%M"
            ).time()
        if "closing_time" in data:
            config.closing_time = datetime.strptime(
                data["closing_time"], "%H:%M"
            ).time()
        if "break_duration_minutes" in data:
            config.break_duration_minutes = int(data["break_duration_minutes"])

        db.session.commit()

        return jsonify(
            {"message": "Store configuration updated successfully"}
        ), HTTPStatus.OK

    except (ValueError, KeyError) as e:
        return jsonify(
            {"error": "Invalid data provided", "details": str(e)}
        ), HTTPStatus.BAD_REQUEST
    except IntegrityError:
        db.session.rollback()
        return jsonify(
            {"error": "Could not update store configuration"}
        ), HTTPStatus.CONFLICT


@bp.route("/config/reset", methods=["POST"])
@bp.route("/config/reset/", methods=["POST"])
def reset_config():
    """Reset store configuration to defaults"""
    try:
        # Delete existing config
        Settings.query.delete()

        # Create new default config
        config = Settings.get_default_config()
        db.session.add(config)
        db.session.commit()

        return jsonify(
            {"message": "Store configuration reset to defaults successfully"}
        ), HTTPStatus.OK

    except Exception as e:
        db.session.rollback()
        return jsonify(
            {"error": "Could not reset store configuration", "details": str(e)}
        ), HTTPStatus.INTERNAL_SERVER_ERROR
