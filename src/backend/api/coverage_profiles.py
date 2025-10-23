import logging
from http import HTTPStatus

from flask import Blueprint, jsonify, request
from sqlalchemy.exc import IntegrityError

from src.backend.models import CoverageProfile, db

bp = Blueprint(
    "coverage_profiles",
    __name__,
    url_prefix="/api/v2/coverage-profiles",
)
logger = logging.getLogger(__name__)


@bp.route("/", methods=["GET"])
def get_all_profiles():
    """Get all coverage profiles"""
    try:
        profiles = (
            db.session.query(CoverageProfile)
            .order_by(
                CoverageProfile.is_default.desc(),
                CoverageProfile.updated_at.desc(),
            )
            .all()
        )
        return (
            jsonify([profile.to_dict() for profile in profiles]),
            HTTPStatus.OK,
        )
    except Exception as e:
        logger.error("Error getting profiles: %s", str(e))
        return (
            jsonify(
                {
                    "error": "Could not fetch coverage profiles",
                    "details": str(e),
                }
            ),
            HTTPStatus.INTERNAL_SERVER_ERROR,
        )


@bp.route("/<int:profile_id>", methods=["GET"])
def get_profile(profile_id):
    """Get a specific coverage profile"""
    try:
        profile = db.session.get(CoverageProfile, profile_id)
        if profile is None:
            return (
                jsonify({"error": "Profile not found"}),
                HTTPStatus.NOT_FOUND,
            )
        return jsonify(profile.to_dict()), HTTPStatus.OK
    except Exception as e:
        logger.error("Error getting profile: %s", str(e))
        return (
            jsonify({"error": "Could not fetch profile", "details": str(e)}),
            HTTPStatus.INTERNAL_SERVER_ERROR,
        )


@bp.route("/default", methods=["GET"])
def get_default_profile():
    """Get the default coverage profile"""
    try:
        profile = db.session.query(CoverageProfile).filter_by(is_default=True).first()
        if profile is None:
            return (
                jsonify({"error": "No default profile set"}),
                HTTPStatus.NOT_FOUND,
            )
        return jsonify(profile.to_dict()), HTTPStatus.OK
    except Exception as e:
        logger.error("Error getting default profile: %s", str(e))
        return (
            jsonify(
                {
                    "error": "Could not fetch default profile",
                    "details": str(e),
                }
            ),
            HTTPStatus.INTERNAL_SERVER_ERROR,
        )


@bp.route("/", methods=["POST"])
def create_profile():
    """Create a new coverage profile"""
    data = request.get_json()

    try:
        # Validate required fields
        if not data.get("name"):
            return (
                jsonify({"error": "Profile name is required"}),
                HTTPStatus.BAD_REQUEST,
            )
        if not data.get("coverageData"):
            return (
                jsonify({"error": "coverageData is required"}),
                HTTPStatus.BAD_REQUEST,
            )

        # Check if a default is being set and unset any existing default
        is_default = data.get("isDefault", False)
        if is_default:
            existing_default = (
                db.session.query(CoverageProfile).filter_by(is_default=True).first()
            )
            if existing_default:
                existing_default.is_default = False

        profile = CoverageProfile(
            name=data["name"],
            description=data.get("description"),
            coverage_data=data["coverageData"],
            is_default=is_default,
        )

        db.session.add(profile)
        db.session.commit()

        logger.info(f"Created coverage profile: {profile.name}")
        return jsonify(profile.to_dict()), HTTPStatus.CREATED

    except IntegrityError:
        db.session.rollback()
        return (
            jsonify(
                {"error": f"Profile with name '{data.get('name')}' already exists"}
            ),
            HTTPStatus.CONFLICT,
        )
    except (KeyError, ValueError) as e:
        return (
            jsonify({"error": "Invalid data provided", "details": str(e)}),
            HTTPStatus.BAD_REQUEST,
        )
    except Exception as e:
        db.session.rollback()
        logger.error("Error creating profile: %s", str(e))
        return (
            jsonify(
                {
                    "error": "Could not create profile",
                    "details": str(e),
                }
            ),
            HTTPStatus.INTERNAL_SERVER_ERROR,
        )


@bp.route("/<int:profile_id>", methods=["PUT"])
def update_profile(profile_id):
    """Update a coverage profile"""
    data = request.get_json()
    profile = db.session.get(CoverageProfile, profile_id)

    if profile is None:
        return (
            jsonify({"error": "Profile not found"}),
            HTTPStatus.NOT_FOUND,
        )

    try:
        # Update fields if provided
        if "name" in data:
            profile.name = data["name"]
        if "description" in data:
            profile.description = data["description"]
        if "coverageData" in data:
            profile.coverage_data = data["coverageData"]

        # Handle is_default flag
        if "isDefault" in data:
            is_default = data["isDefault"]
            if is_default and not profile.is_default:
                # Unset any other default
                existing_default = (
                    db.session.query(CoverageProfile)
                    .filter_by(is_default=True)
                    .filter(CoverageProfile.id != profile_id)
                    .first()
                )
                if existing_default:
                    existing_default.is_default = False
            profile.is_default = is_default

        db.session.commit()
        logger.info(f"Updated coverage profile: {profile.name}")
        return jsonify(profile.to_dict()), HTTPStatus.OK

    except IntegrityError:
        db.session.rollback()
        return (
            jsonify(
                {"error": f"Profile with name '{data.get('name')}' already exists"}
            ),
            HTTPStatus.CONFLICT,
        )
    except (ValueError, KeyError) as e:
        db.session.rollback()
        return (
            jsonify({"error": "Invalid data provided", "details": str(e)}),
            HTTPStatus.BAD_REQUEST,
        )
    except Exception as e:
        db.session.rollback()
        logger.error("Error updating profile: %s", str(e))
        return (
            jsonify(
                {
                    "error": "Could not update profile",
                    "details": str(e),
                }
            ),
            HTTPStatus.INTERNAL_SERVER_ERROR,
        )


@bp.route("/<int:profile_id>/set-default", methods=["POST"])
def set_default_profile(profile_id):
    """Set a profile as the default"""
    try:
        profile = db.session.get(CoverageProfile, profile_id)
        if profile is None:
            return (
                jsonify({"error": "Profile not found"}),
                HTTPStatus.NOT_FOUND,
            )

        # Unset any existing default
        existing_default = (
            db.session.query(CoverageProfile)
            .filter_by(is_default=True)
            .filter(CoverageProfile.id != profile_id)
            .first()
        )
        if existing_default:
            existing_default.is_default = False

        profile.is_default = True
        db.session.commit()

        logger.info(f"Set default profile: {profile.name}")
        return jsonify(profile.to_dict()), HTTPStatus.OK

    except Exception as e:
        db.session.rollback()
        logger.error("Error setting default profile: %s", str(e))
        return (
            jsonify(
                {
                    "error": "Could not set default profile",
                    "details": str(e),
                }
            ),
            HTTPStatus.INTERNAL_SERVER_ERROR,
        )


@bp.route("/<int:profile_id>", methods=["DELETE"])
def delete_profile(profile_id):
    """Delete a coverage profile"""
    try:
        profile = db.session.get(CoverageProfile, profile_id)
        if profile is None:
            return (
                jsonify({"error": "Profile not found"}),
                HTTPStatus.NOT_FOUND,
            )

        # Prevent deletion of the default profile
        if profile.is_default:
            return (
                jsonify(
                    {
                        "error": "Cannot delete the default profile. "
                        "Set another profile as default first."
                    }
                ),
                HTTPStatus.CONFLICT,
            )

        profile_name = profile.name
        db.session.delete(profile)
        db.session.commit()

        logger.info(f"Deleted coverage profile: {profile_name}")
        return "", HTTPStatus.NO_CONTENT

    except Exception as e:
        db.session.rollback()
        logger.error("Error deleting profile: %s", str(e))
        return (
            jsonify(
                {
                    "error": "Could not delete profile",
                    "details": str(e),
                }
            ),
            HTTPStatus.INTERNAL_SERVER_ERROR,
        )


@bp.route("/<int:profile_id>/copy", methods=["POST"])
def copy_profile(profile_id):
    """Create a copy of an existing profile"""
    data = request.get_json()
    original = db.session.get(CoverageProfile, profile_id)

    if original is None:
        return (
            jsonify({"error": "Profile not found"}),
            HTTPStatus.NOT_FOUND,
        )

    try:
        new_name = data.get("name")
        if not new_name:
            return (
                jsonify({"error": "New profile name is required"}),
                HTTPStatus.BAD_REQUEST,
            )

        copy = CoverageProfile(
            name=new_name,
            description=data.get("description", f"Copy of {original.name}"),
            coverage_data=original.coverage_data,
            is_default=False,  # New copies are never default
        )

        db.session.add(copy)
        db.session.commit()

        logger.info(f"Created copy of profile {original.name}: {copy.name}")
        return jsonify(copy.to_dict()), HTTPStatus.CREATED

    except IntegrityError:
        db.session.rollback()
        return (
            jsonify({"error": f"Profile with name '{new_name}' already exists"}),
            HTTPStatus.CONFLICT,
        )
    except (KeyError, ValueError) as e:
        return (
            jsonify({"error": "Invalid data provided", "details": str(e)}),
            HTTPStatus.BAD_REQUEST,
        )
    except Exception as e:
        db.session.rollback()
        logger.error("Error copying profile: %s", str(e))
        return (
            jsonify(
                {
                    "error": "Could not copy profile",
                    "details": str(e),
                }
            ),
            HTTPStatus.INTERNAL_SERVER_ERROR,
        )
