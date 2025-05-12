from flask import Blueprint, jsonify

ping_bp = Blueprint('ping', __name__)

@ping_bp.route('', methods=['GET'])
def ping():
    """Simple ping endpoint to verify API is running"""
    return jsonify({"status": "success", "message": "pong"}) 