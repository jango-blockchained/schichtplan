from flask import Blueprint, request, jsonify
from models import Settings
from http import HTTPStatus

bp = Blueprint('pdf_settings', __name__, url_prefix='/api/pdf-settings')

@bp.route('/layout', methods=['GET'])
def get_layout():
    """Get current PDF layout configuration"""
    try:
        config = Settings.get_pdf_layout_config()
        return jsonify(config), HTTPStatus.OK
    except Exception as e:
        return jsonify({'error': str(e)}), HTTPStatus.INTERNAL_SERVER_ERROR

@bp.route('/layout', methods=['PUT'])
def update_layout():
    """Update PDF layout configuration"""
    try:
        config = request.get_json()
        if not config:
            return jsonify({'error': 'No configuration provided'}), HTTPStatus.BAD_REQUEST
            
        Settings.save_pdf_layout_config(config)
        return jsonify({'message': 'Layout configuration updated successfully'}), HTTPStatus.OK
    except Exception as e:
        return jsonify({'error': str(e)}), HTTPStatus.INTERNAL_SERVER_ERROR

@bp.route('/presets', methods=['GET'])
def get_presets():
    """Get all PDF layout presets"""
    try:
        presets = Settings.get_pdf_layout_presets()
        return jsonify(presets), HTTPStatus.OK
    except Exception as e:
        return jsonify({'error': str(e)}), HTTPStatus.INTERNAL_SERVER_ERROR

@bp.route('/presets/<name>', methods=['POST'])
def save_preset(name):
    """Save a new PDF layout preset"""
    try:
        config = request.get_json()
        if not config:
            return jsonify({'error': 'No configuration provided'}), HTTPStatus.BAD_REQUEST
            
        Settings.save_pdf_layout_preset(name, config)
        return jsonify({'message': f'Preset "{name}" saved successfully'}), HTTPStatus.CREATED
    except Exception as e:
        return jsonify({'error': str(e)}), HTTPStatus.INTERNAL_SERVER_ERROR

@bp.route('/presets/<name>', methods=['DELETE'])
def delete_preset(name):
    """Delete a PDF layout preset"""
    try:
        if Settings.delete_pdf_layout_preset(name):
            return jsonify({'message': f'Preset "{name}" deleted successfully'}), HTTPStatus.OK
        return jsonify({'error': 'Cannot delete default presets or preset not found'}), HTTPStatus.BAD_REQUEST
    except Exception as e:
        return jsonify({'error': str(e)}), HTTPStatus.INTERNAL_SERVER_ERROR

@bp.route('/presets/<name>/apply', methods=['POST'])
def apply_preset(name):
    """Apply a PDF layout preset as current configuration"""
    try:
        presets = Settings.get_pdf_layout_presets()
        if name not in presets:
            return jsonify({'error': 'Preset not found'}), HTTPStatus.NOT_FOUND
            
        Settings.save_pdf_layout_config(presets[name])
        return jsonify({'message': f'Preset "{name}" applied successfully'}), HTTPStatus.OK
    except Exception as e:
        return jsonify({'error': str(e)}), HTTPStatus.INTERNAL_SERVER_ERROR 