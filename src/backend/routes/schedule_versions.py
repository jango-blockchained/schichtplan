from flask import Blueprint, request, jsonify
from http import HTTPStatus
from datetime import datetime, timedelta
from sqlalchemy import desc
import traceback

# Relative imports
from ..models import Schedule, ScheduleVersionMeta, ScheduleStatus, Employee
from ..utils.logger import logger

versions_bp = Blueprint(
    "schedule_versions", __name__, url_prefix="/api/schedules"
)


# === Helper Functions (Copied/Adapted from original schedules.py) ===


def get_or_create_initial_version(start_date, end_date):
    """Helper function to get or create the initial version metadata"""
    from ..models import db  # Import db specifically where needed

    try:
        existing_version = ScheduleVersionMeta.query.first()
        if existing_version:
            return existing_version

        version_meta = ScheduleVersionMeta(
            version=1,
            created_at=datetime.utcnow(),
            status=ScheduleStatus.DRAFT,
            date_range_start=start_date,
            date_range_end=end_date,
            notes="Initial version",
        )
        db.session.add(version_meta)
        db.session.commit()
        return version_meta
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error creating initial version: {e}")
        return None


def get_versions_for_date_range(start_date, end_date):
    """Helper function to get all versions available for a date range."""
    from ..models import db  # Import db specifically where needed

    try:
        # Query metadata first
        versions = (
            ScheduleVersionMeta.query.filter(
                ScheduleVersionMeta.date_range_start <= end_date,
                ScheduleVersionMeta.date_range_end >= start_date,
            )
            .order_by(desc(ScheduleVersionMeta.version))
            .all()
        )
        if versions:
            return versions

        # Fallback to schedule table
        logger.app_logger.info(
            "No versions in metadata, falling back to schedules table"
        )
        version_numbers = (
            db.session.query(Schedule.version)
            .filter(Schedule.date >= start_date, Schedule.date <= end_date)
            .distinct()
            .order_by(desc(Schedule.version))
            .all()
        )
        if not version_numbers:
            return []

        result = []
        for (version,) in version_numbers:
            try:
                meta = ScheduleVersionMeta.query.get(version)
                if not meta:
                    logger.app_logger.info(f"Creating metadata for version {version}")
                    dates = (
                        db.session.query(
                            db.func.min(Schedule.date),
                            db.func.max(Schedule.date),
                        )
                        .filter(Schedule.version == version)
                        .first()
                    )
                    if dates:
                        meta = ScheduleVersionMeta(
                            version=version,
                            created_at=datetime.utcnow(),
                            status=ScheduleStatus.DRAFT,
                            date_range_start=dates[0],
                            date_range_end=dates[1],
                            notes=f"Auto-generated v{version}",
                        )
                        db.session.add(meta)
                        try:
                            db.session.commit()
                            logger.app_logger.info(f"Created metadata for v{version}")
                        except Exception as commit_e:
                            db.session.rollback()
                            logger.error(
                                f"Failed meta v{version}: {commit_e}"
                            )
                if meta:
                    result.append(meta)
            except Exception as proc_e:
                logger.error(f"Error processing version {version}: {proc_e}")
                continue

        if not result:
            logger.app_logger.warning("No version metadata created from fallback")
        return result

    except Exception as e:
        logger.error(f"Error getting versions for range: {e}")
        raise


# === Version Routes ===


@versions_bp.route("/versions", methods=["GET"])
def get_all_schedule_versions():
    """Get all schedule versions with metadata, optionally filtered by date."""
    start_date_str = request.args.get("start_date")
    end_date_str = request.args.get("end_date")

    try:
        query = ScheduleVersionMeta.query
        if start_date_str:
            start_date = datetime.strptime(start_date_str, "%Y-%m-%d").date()
            query = query.filter(
                ScheduleVersionMeta.date_range_end >= start_date
            )
        if end_date_str:
            end_date = datetime.strptime(end_date_str, "%Y-%m-%d").date()
            query = query.filter(
                ScheduleVersionMeta.date_range_start <= end_date
            )

        versions_meta = query.order_by(
            desc(ScheduleVersionMeta.created_at)
        ).all()
        
        # Explicitly wrap the result in a 'versions' key to match frontend expectations
        response = {
            "versions": [v.to_dict() for v in versions_meta]
        }
        
        return jsonify(response), HTTPStatus.OK

    except ValueError:
        return (
            jsonify({"error": "Invalid date format (YYYY-MM-DD)"}),
            HTTPStatus.BAD_REQUEST,
        )
    except Exception as e:
        logger.error_logger.error(f"Error fetching schedule versions: {str(e)}\n{traceback.format_exc()}")
        return (
            jsonify({"error": f"Failed to fetch versions: {e}"}),
            HTTPStatus.INTERNAL_SERVER_ERROR,
        )


@versions_bp.route("/version", methods=["POST"])
def create_new_schedule_version():
    """Create a new schedule version, optionally based on an existing one."""
    from ..models import db, Schedule, Employee, ScheduleVersionMeta

    data = request.get_json()
    if not data:
        return jsonify({"error": "Missing JSON payload"}), HTTPStatus.BAD_REQUEST

    base_version_id = data.get("base_version_id")
    notes = data.get("notes", "New version")
    start_date_str = data.get("start_date")
    end_date_str = data.get("end_date")

    if not start_date_str or not end_date_str:
        return (
            jsonify({"error": "start_date and end_date are required"}),
            HTTPStatus.BAD_REQUEST,
        )

    try:
        start_date = datetime.strptime(start_date_str, "%Y-%m-%d").date()
        end_date = datetime.strptime(end_date_str, "%Y-%m-%d").date()
    except ValueError:
        return (
            jsonify({"error": "Invalid date format (YYYY-MM-DD)"}),
            HTTPStatus.BAD_REQUEST,
        )

    try:
        # Determine the next version number
        last_version = ScheduleVersionMeta.query.order_by(
            desc(ScheduleVersionMeta.version)
        ).first()
        next_version = (last_version.version + 1) if last_version else 1

        # Create new metadata
        new_version_meta = ScheduleVersionMeta(
            version=next_version,
            created_at=datetime.utcnow(),
            status=ScheduleStatus.DRAFT,
            date_range_start=start_date,
            date_range_end=end_date,
            notes=notes,
            base_version=base_version_id,
        )
        db.session.add(new_version_meta)

        # If based on an existing version, copy schedule entries (optional logic)
        # This part needs careful consideration: Should it copy immediately?
        # For now, we just create the metadata. Copying might be a separate step.
        if base_version_id:
            logger.app_logger.info(
                f"New version {next_version} based on {base_version_id}. "
                f"Schedule entries NOT copied automatically."
            )
            # Example copy logic (if desired):
            # base_schedules = Schedule.query.filter_by(version=base_version_id).all()
            # for entry in base_schedules:
            #     new_entry = Schedule(...) # Create new entry based on old
            #     new_entry.version = next_version
            #     db.session.add(new_entry)

        # Commit the new version metadata first
        db.session.commit()
        logger.app_logger.info(f"Created new schedule version: {next_version}")

        # --- Add default schedule entries for employees without shifts ---
        try:
            all_employees = Employee.query.filter_by(is_active=True).all()
            if not all_employees:
                logger.app_logger.warning(f"No active employees found. Skipping default schedule entry creation for version {next_version}.")
            else:
                logger.app_logger.info(f"Creating default schedule entries for version {next_version}...")
                current_date = new_version_meta.date_range_start
                new_entries_count = 0
                while current_date <= new_version_meta.date_range_end:
                    # Find employees already scheduled on this day for this version
                    scheduled_employee_ids = {\
                        s.employee_id\
                        for s in Schedule.query.filter_by(date=current_date, version=next_version).all()\
                    }

                    # Create entries for employees *not* scheduled
                    for employee in all_employees:
                        if employee.id not in scheduled_employee_ids:
                            default_entry = Schedule(
                                date=current_date,
                                employee_id=employee.id,
                                shift_id=None,  # Represents no assigned shift
                                version=next_version,
                                status=ScheduleStatus.DRAFT, # Use the default DRAFT status
                            )
                            db.session.add(default_entry)
                            new_entries_count += 1

                    current_date += timedelta(days=1)

                if new_entries_count > 0:
                    db.session.commit()
                    logger.app_logger.info(f"Successfully created {new_entries_count} default schedule entries for version {next_version}.")
                else:
                     logger.app_logger.info(f"No default entries needed or created for version {next_version} (all employees might already be scheduled).")


        except Exception as e_schedule:
            db.session.rollback() # Rollback only the schedule entries part
            logger.error_logger.error(f"Error creating default schedule entries for version {next_version}: {str(e_schedule)}\\n{traceback.format_exc()}")
            # Log the error but don't fail the whole version creation
            # Optionally, return a specific message or status? For now, just log.

        # --- End of default schedule entries logic ---


        return jsonify(new_version_meta.to_dict()), HTTPStatus.CREATED

    except Exception as e:
        db.session.rollback()
        logger.error_logger.error(f"Error creating new schedule version {next_version}: {str(e)}\\n{traceback.format_exc()}")
        # Provide more specific error back to client
        return (
            jsonify({"error": f"Failed to create new version: {e}"}),
            HTTPStatus.INTERNAL_SERVER_ERROR,
        )


# --- Placeholder implementations for other routes ---
# These need to be filled in based on the original logic, ensuring db.session is used correctly.


@versions_bp.route("/versions/<int:version>/details", methods=["GET"])
def get_schedule_version_details_route(version):
    """Get details for a specific schedule version metadata."""
    from ..models import db

    try:
        version_meta = ScheduleVersionMeta.query.get_or_404(version)
        return jsonify(version_meta.to_dict()), HTTPStatus.OK
    except Exception as e:
        logger.error_logger.error(f"Error getting details for version {version}: {str(e)}\n{traceback.format_exc()}")
        return (
            jsonify({"error": f"Failed to get details: {e}"}),
            HTTPStatus.INTERNAL_SERVER_ERROR,
        )


@versions_bp.route("/versions/<int:version>/status", methods=["PUT"])
def update_schedule_version_status(version):
    """Update the status of a schedule version (DRAFT, PUBLISHED, ARCHIVED)."""
    from ..models import db

    data = request.get_json()
    new_status_str = data.get("status")

    if not new_status_str:
        return (
            jsonify({"error": "Missing 'status' in request body"}),
            HTTPStatus.BAD_REQUEST,
        )

    try:
        # Validate status
        new_status = ScheduleStatus[new_status_str.upper()]
    except KeyError:
        valid_statuses = [s.name for s in ScheduleStatus]
        return (
            jsonify(
                {
                    "error": f"Invalid status. Must be one of {valid_statuses}"
                }
            ),
            HTTPStatus.BAD_REQUEST,
        )

    try:
        version_meta = ScheduleVersionMeta.query.get_or_404(version)
        version_meta.status = new_status
        version_meta.updated_at = datetime.utcnow()  # Track updates
        db.session.commit()
        logger.app_logger.info(
            f"Updated status for version {version} to {new_status.name}"
        )
        return jsonify(version_meta.to_dict()), HTTPStatus.OK
    except Exception as e:
        db.session.rollback()
        logger.error_logger.error(f"Error updating status for version {version}: {str(e)}\n{traceback.format_exc()}")
        return (
            jsonify({"error": f"Failed to update status: {e}"}),
            HTTPStatus.INTERNAL_SERVER_ERROR,
        )


@versions_bp.route("/versions/<int:version>/notes", methods=["PUT"])
def update_schedule_version_notes(version):
    """Update the notes for a specific schedule version metadata."""
    from ..models import db

    data = request.get_json()
    notes = data.get("notes")

    if notes is None:  # Allow empty notes
        return (
            jsonify({"error": "Missing 'notes' in request body"}),
            HTTPStatus.BAD_REQUEST,
        )

    try:
        version_meta = ScheduleVersionMeta.query.get_or_404(version)
        version_meta.notes = notes
        version_meta.updated_at = datetime.utcnow()  # Track updates
        db.session.commit()
        logger.app_logger.info(f"Updated notes for version {version}")
        return jsonify(version_meta.to_dict()), HTTPStatus.OK
    except Exception as e:
        db.session.rollback()
        logger.error_logger.error(f"Error updating notes for version {version}: {str(e)}\n{traceback.format_exc()}")
        return (
            jsonify({"error": f"Failed to update notes: {e}"}),
            HTTPStatus.INTERNAL_SERVER_ERROR,
        )


@versions_bp.route("/version/duplicate", methods=["POST"])
def duplicate_schedule_version():
    """Create a duplicate of an existing schedule version."""
    from ..models import db

    data = request.get_json()
    source_version_id = data.get("source_version_id")

    if not source_version_id:
        return (
            jsonify({"error": "Missing 'source_version_id' in request body"}),
            HTTPStatus.BAD_REQUEST,
        )

    try:
        source_version_meta = ScheduleVersionMeta.query.get_or_404(
            source_version_id
        )

        # Determine the next version number
        last_version = ScheduleVersionMeta.query.order_by(
            desc(ScheduleVersionMeta.version)
        ).first()
        next_version = (last_version.version + 1) if last_version else 1

        # Create new metadata based on the source
        new_version_meta = ScheduleVersionMeta(
            version=next_version,
            created_at=datetime.utcnow(),
            status=ScheduleStatus.DRAFT,  # Start as draft
            date_range_start=source_version_meta.date_range_start,
            date_range_end=source_version_meta.date_range_end,
            notes=f"Duplicate of version {source_version_id}. "
                  f"{source_version_meta.notes or ''}".strip(),
            base_version=source_version_id,
        )
        db.session.add(new_version_meta)

        # Copy actual schedule entries from the source version
        source_schedules = Schedule.query.filter_by(
            version=source_version_id
        ).all()
        if not source_schedules:
            logger.app_logger.warning(
                f"Source version {source_version_id} has no schedule "
                f"entries to duplicate."
            )

        for entry in source_schedules:
            new_entry = Schedule(
                date=entry.date,
                employee_id=entry.employee_id,
                shift_id=entry.shift_id,
                start_time=entry.start_time,
                end_time=entry.end_time,
                hours_scheduled=entry.hours_scheduled,
                is_generated=entry.is_generated,
                is_keyholder_shift=entry.is_keyholder_shift,
                version=next_version,  # Assign to the new version
            )
            db.session.add(new_entry)

        db.session.commit()
        logger.app_logger.info(
            f"Duplicated version {source_version_id} to new version "
            f"{next_version}"
        )
        return jsonify(new_version_meta.to_dict()), HTTPStatus.CREATED

    except Exception as e:
        db.session.rollback()
        logger.error_logger.error(f"Error duplicating version {source_version_id}: {str(e)}\n{traceback.format_exc()}")
        return (
            jsonify({"error": f"Failed to duplicate version: {e}"}),
            HTTPStatus.INTERNAL_SERVER_ERROR,
        )


@versions_bp.route("/versions/compare", methods=["GET"])
def compare_schedule_versions():
    """Compare two schedule versions for differences."""
    # This logic can be complex and depends on the desired comparison output.
    # Placeholder: Return not implemented.
    version1 = request.args.get("version1")
    version2 = request.args.get("version2")
    logger.app_logger.warning(
        f"Compare endpoint called for {version1} vs {version2} - "
        f"Not fully implemented."
    )
    return (
        jsonify({"message": "Version comparison not implemented yet"}),
        HTTPStatus.NOT_IMPLEMENTED,
    )


@versions_bp.route("/versions/<int:version>", methods=["DELETE"])
def delete_schedule_version_route(version):
    """Delete a specific schedule version (metadata and potentially entries)."""
    from ..models import db

    delete_entries = request.args.get("delete_entries", "true").lower() == "true"

    try:
        version_meta = ScheduleVersionMeta.query.get_or_404(version)

        if delete_entries:
            # Delete schedule entries associated with this version
            deleted_count = Schedule.query.filter_by(version=version).delete()
            logger.app_logger.info(
                f"Deleted {deleted_count} schedule entries for version "
                f"{version}."
            )

        # Delete the metadata
        db.session.delete(version_meta)
        db.session.commit()
        logger.app_logger.info(
            f"Deleted schedule version metadata for version {version}"
        )
        return (
            jsonify({"message": f"Version {version} deleted successfully"}),
            HTTPStatus.OK,
        )

    except Exception as e:
        db.session.rollback()
        logger.error_logger.error(f"Error deleting version {version}: {str(e)}\n{traceback.format_exc()}")
        return (
            jsonify({"error": f"Failed to delete version: {e}"}),
            HTTPStatus.INTERNAL_SERVER_ERROR,
        )