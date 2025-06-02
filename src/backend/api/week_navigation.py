"""
Week navigation API endpoints for the Schichtplan application.

Provides endpoints for week-based navigation, month boundaries, and quick jumps.
"""

from flask import Blueprint, request, jsonify
from datetime import date, datetime
from typing import Optional, Dict, Any, List
from http import HTTPStatus

from ..models.schedule import ScheduleVersionMeta
from ..services.week_version_service import WeekVersionService
from ..utils.week_utils import (
    get_iso_week_info,
    get_week_from_identifier,
    get_next_week,
    get_previous_week,
    get_current_week_identifier,
    create_week_identifier,
    MonthBoundaryMode
)
from ..utils.logger import get_logger

logger = get_logger(__name__)

# Create blueprint
bp = Blueprint('week_navigation', __name__, url_prefix='/api/weeks')


@bp.route('/current', methods=['GET'])
def get_current_week():
    """Get current week information."""
    try:
        current_week_id = get_current_week_identifier()
        week_info = get_week_from_identifier(current_week_id)
        
        return jsonify({
            "week_identifier": current_week_id,
            "year": week_info.year,
            "week_number": week_info.week_number,
            "start_date": week_info.start_date.isoformat(),
            "end_date": week_info.end_date.isoformat(),
            "spans_months": week_info.spans_months,
            "months": week_info.months
        })
        
    except Exception as e:
        logger.error(f"Error getting current week: {str(e)}")
        return jsonify({"error": str(e)}), HTTPStatus.INTERNAL_SERVER_ERROR@bp.route('/<string:week_identifier>/info', methods=['GET'])
def get_week_info(week_identifier: str):
    """Get information about a specific week."""
    try:
        week_info = get_week_from_identifier(week_identifier)
        
        # Check if version exists for this week
        service = WeekVersionService()
        version_meta = service.get_version_by_week(week_identifier)
        
        response_data = {
            "week_identifier": week_identifier,
            "year": week_info.year,
            "week_number": week_info.week_number,
            "start_date": week_info.start_date.isoformat(),
            "end_date": week_info.end_date.isoformat(),
            "spans_months": week_info.spans_months,
            "months": week_info.months,
            "has_version": version_meta is not None
        }
        
        if version_meta:
            response_data["version"] = version_meta.to_dict()
        
        return jsonify(response_data)
        
    except ValueError as e:
        return jsonify({"error": f"Invalid week identifier: {str(e)}"}), HTTPStatus.BAD_REQUEST
    except Exception as e:
        logger.error(f"Error getting week info: {str(e)}")
        return jsonify({"error": str(e)}), HTTPStatus.INTERNAL_SERVER_ERROR


@bp.route('/<string:week_identifier>/next', methods=['GET'])
def get_next_week_endpoint(week_identifier: str):
    """Get the next week identifier."""
    try:
        next_week_id = get_next_week(week_identifier)
        next_week_info = get_week_from_identifier(next_week_id)
        
        return jsonify({
            "week_identifier": next_week_id,
            "year": next_week_info.year,
            "week_number": next_week_info.week_number,
            "start_date": next_week_info.start_date.isoformat(),
            "end_date": next_week_info.end_date.isoformat(),
            "spans_months": next_week_info.spans_months,
            "months": next_week_info.months
        })
        
    except ValueError as e:
        return jsonify({"error": f"Invalid week identifier: {str(e)}"}), HTTPStatus.BAD_REQUEST
    except Exception as e:
        logger.error(f"Error getting next week: {str(e)}")
        return jsonify({"error": str(e)}), HTTPStatus.INTERNAL_SERVER_ERROR@bp.route('/<string:week_identifier>/previous', methods=['GET'])
def get_previous_week_endpoint(week_identifier: str):
    """Get the previous week identifier."""
    try:
        prev_week_id = get_previous_week(week_identifier)
        prev_week_info = get_week_from_identifier(prev_week_id)
        
        return jsonify({
            "week_identifier": prev_week_id,
            "year": prev_week_info.year,
            "week_number": prev_week_info.week_number,
            "start_date": prev_week_info.start_date.isoformat(),
            "end_date": prev_week_info.end_date.isoformat(),
            "spans_months": prev_week_info.spans_months,
            "months": prev_week_info.months
        })
        
    except ValueError as e:
        return jsonify({"error": f"Invalid week identifier: {str(e)}"}), HTTPStatus.BAD_REQUEST
    except Exception as e:
        logger.error(f"Error getting previous week: {str(e)}")
        return jsonify({"error": str(e)}), HTTPStatus.INTERNAL_SERVER_ERROR


@bp.route('/create', methods=['POST'])
def create_week_version():
    """Create a new week-based version."""
    try:
        data = request.get_json()
        week_identifier = data.get('week_identifier')
        base_version = data.get('base_version')
        notes = data.get('notes')
        create_empty = data.get('create_empty_schedules', True)
        
        if not week_identifier:
            return jsonify({"error": "week_identifier is required"}), HTTPStatus.BAD_REQUEST
        
        service = WeekVersionService()
        
        # Check if version already exists
        existing = service.get_version_by_week(week_identifier)
        if existing:
            return jsonify({
                "error": f"Version already exists for week {week_identifier}",
                "existing_version": existing.to_dict()
            }), HTTPStatus.CONFLICT
        
        # Create new version
        version_meta = service.create_week_version(
            week_identifier=week_identifier,
            base_version=base_version,
            notes=notes,
            create_empty_schedules=create_empty
        )
        
        return jsonify(version_meta.to_dict()), HTTPStatus.CREATED
        
    except Exception as e:
        logger.error(f"Error creating week version: {str(e)}")
        return jsonify({"error": str(e)}), HTTPStatus.INTERNAL_SERVER_ERROR