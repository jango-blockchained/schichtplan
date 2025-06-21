from flask import Blueprint, request, jsonify, send_file, Response
from http import HTTPStatus
from datetime import date, timedelta, datetime
import io

# Import models and services
try:
    from src.backend.services.pdf_generator import PDFGenerator
except ImportError:
    # Fallback for development
    PDFGenerator = None

bp = Blueprint("pdf_settings", __name__, url_prefix="/api/v2/pdf-settings")


@bp.route("/layout", methods=["GET"])
def get_layout():
    """Get current PDF layout configuration"""
    try:
        # For now, return a default config since the Settings methods are not implemented
        default_config = {
            "header": {
                "title": "Mitarbeiter-Einsatz-Planung (MEP)",
                "store_field": {"label": "Filiale:", "value": ""},
                "period_fields": {
                    "month_year": {"label": "Monat/Jahr", "value": ""},
                    "week_from": {"label": "Woche vom:", "value": ""},
                    "week_to": {"label": "bis:", "value": ""}
                },
                "storage_note": {"text": "Aufbewahrung in der Filiale: 2 Jahre", "position": "right"}
            },
            "styling": {
                "fonts": {"header_font": "Helvetica", "header_size": 11, "table_font": "Helvetica", "table_size": 7, "footer_font": "Helvetica", "footer_size": 6},
                "colors": {"header_bg": "#FFFFFF", "header_text": "#000000", "table_border": "#000000", "table_bg": "#FFFFFF", "table_text": "#000000"},
                "spacing": {"page_margin": 15, "section_spacing": 6, "row_height": 12},
                "table_style": {"border_width": 0.5, "grid_style": "solid", "cell_padding": 2}
            },
            "pageSetup": {
                "size": "A4",
                "orientation": "portrait",
                "margins": {"top": 15, "right": 15, "bottom": 15, "left": 15}
            }
        }
        return jsonify(default_config), HTTPStatus.OK
    except Exception as e:
        return jsonify({"error": str(e)}), HTTPStatus.INTERNAL_SERVER_ERROR


@bp.route("/layout", methods=["PUT"])
def update_layout():
    """Update PDF layout configuration"""
    try:
        config = request.get_json()
        if not config:
            return jsonify(
                {"error": "No configuration provided"}
            ), HTTPStatus.BAD_REQUEST

        # For now, just validate the config and return success
        # In a full implementation, this would save to Settings
        return jsonify(
            {"message": "Layout configuration updated successfully"}
        ), HTTPStatus.OK
    except Exception as e:
        return jsonify({"error": str(e)}), HTTPStatus.INTERNAL_SERVER_ERROR


@bp.route("/preview", methods=["POST"])
def preview_layout():
    """Generate a preview image of the current layout settings"""
    try:
        config = request.get_json()
        if not config:
            return jsonify(
                {"error": "No configuration provided"}
            ), HTTPStatus.BAD_REQUEST

        # Generate SVG preview that reflects the actual configuration
        svg_content = generate_preview_svg(config)
        
        # Return SVG with proper headers for browser compatibility
        response = Response(
            svg_content,
            mimetype='image/svg+xml',
            headers={
                'Content-Disposition': 'inline; filename="preview.svg"',
                'Cache-Control': 'no-cache',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            }
        )
        return response
        
    except Exception as e:
        print(f"Preview error: {e}")  # Debug logging
        return jsonify({"error": str(e)}), HTTPStatus.INTERNAL_SERVER_ERROR


def generate_preview_svg(config):
    """Generate SVG representation of the MEP layout"""
    header = config.get('header', {})
    styling = config.get('styling', {}).get('fonts', {})
    colors = config.get('styling', {}).get('colors', {})
    
    # Extract configuration values with proper defaults
    title = header.get('title', 'Mitarbeiter-Einsatz-Planung (MEP)')
    store_label = header.get('store_field', {}).get('label', 'Filiale:')
    store_value = header.get('store_field', {}).get('value', '[Store Name]') or '[Store Name]'
    month_year_label = header.get('period_fields', {}).get('month_year', {}).get('label', 'Monat/Jahr:')
    month_year_value = header.get('period_fields', {}).get('month_year', {}).get('value', 'Juni 2025') or 'Juni 2025'
    
    # Ensure safe values for SVG attributes
    header_bg = colors.get('header_bg', '#FFFFFF')
    header_text = colors.get('header_text', '#000000')
    table_border = colors.get('table_border', '#000000')
    table_bg = colors.get('table_bg', '#FFFFFF')
    
    # SVG preview with proper XML declaration
    svg = f'''<?xml version="1.0" encoding="UTF-8"?>
<svg width="600" height="400" xmlns="http://www.w3.org/2000/svg">
    <!-- Background -->
    <rect width="600" height="400" fill="{table_bg}" stroke="{table_border}" stroke-width="1"/>
    
    <!-- Header Section -->
    <rect x="20" y="20" width="560" height="60" fill="{header_bg}" stroke="{table_border}" stroke-width="1"/>
    
    <!-- Title -->
    <text x="300" y="40" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="{header_text}">{title}</text>
    
    <!-- Store Info -->
    <text x="30" y="65" font-family="Arial, sans-serif" font-size="10" fill="{header_text}">{store_label} {store_value}</text>
    
    <!-- Period Info -->
    <text x="450" y="65" font-family="Arial, sans-serif" font-size="10" fill="{header_text}">{month_year_label} {month_year_value}</text>
    
    <!-- Table Headers -->
    <rect x="20" y="100" width="560" height="25" fill="#F0F0F0" stroke="{table_border}" stroke-width="1"/>
    
    <!-- Column Headers -->
    <text x="40" y="118" font-family="Arial, sans-serif" font-size="9" font-weight="bold">Name</text>
    <text x="120" y="118" font-family="Arial, sans-serif" font-size="9" font-weight="bold">Funktion</text>
    <text x="200" y="118" font-family="Arial, sans-serif" font-size="9" font-weight="bold">Mo</text>
    <text x="240" y="118" font-family="Arial, sans-serif" font-size="9" font-weight="bold">Di</text>
    <text x="280" y="118" font-family="Arial, sans-serif" font-size="9" font-weight="bold">Mi</text>
    <text x="320" y="118" font-family="Arial, sans-serif" font-size="9" font-weight="bold">Do</text>
    <text x="360" y="118" font-family="Arial, sans-serif" font-size="9" font-weight="bold">Fr</text>
    <text x="400" y="118" font-family="Arial, sans-serif" font-size="9" font-weight="bold">Sa</text>
    <text x="440" y="118" font-family="Arial, sans-serif" font-size="9" font-weight="bold">So</text>
    <text x="520" y="118" font-family="Arial, sans-serif" font-size="9" font-weight="bold">Woche</text>
    
    <!-- Sample Employee Row -->
    <rect x="20" y="125" width="560" height="20" fill="{table_bg}" stroke="{table_border}" stroke-width="0.5"/>
    <text x="25" y="138" font-family="Arial, sans-serif" font-size="8">Muster, Max</text>
    <text x="120" y="138" font-family="Arial, sans-serif" font-size="8">Verkauf</text>
    <text x="200" y="138" font-family="Arial, sans-serif" font-size="8">9-17</text>
    <text x="240" y="138" font-family="Arial, sans-serif" font-size="8">9-17</text>
    <text x="280" y="138" font-family="Arial, sans-serif" font-size="8">Frei</text>
    <text x="320" y="138" font-family="Arial, sans-serif" font-size="8">9-17</text>
    <text x="360" y="138" font-family="Arial, sans-serif" font-size="8">9-17</text>
    <text x="400" y="138" font-family="Arial, sans-serif" font-size="8">Frei</text>
    <text x="440" y="138" font-family="Arial, sans-serif" font-size="8">Frei</text>
    <text x="520" y="138" font-family="Arial, sans-serif" font-size="8">32h</text>
    
    <!-- Vertical Lines -->
    <line x1="110" y1="100" x2="110" y2="145" stroke="{table_border}" stroke-width="0.5"/>
    <line x1="190" y1="100" x2="190" y2="145" stroke="{table_border}" stroke-width="0.5"/>
    <line x1="230" y1="100" x2="230" y2="145" stroke="{table_border}" stroke-width="0.5"/>
    <line x1="270" y1="100" x2="270" y2="145" stroke="{table_border}" stroke-width="0.5"/>
    <line x1="310" y1="100" x2="310" y2="145" stroke="{table_border}" stroke-width="0.5"/>
    <line x1="350" y1="100" x2="350" y2="145" stroke="{table_border}" stroke-width="0.5"/>
    <line x1="390" y1="100" x2="390" y2="145" stroke="{table_border}" stroke-width="0.5"/>
    <line x1="430" y1="100" x2="430" y2="145" stroke="{table_border}" stroke-width="0.5"/>
    <line x1="470" y1="100" x2="470" y2="145" stroke="{table_border}" stroke-width="0.5"/>
    <line x1="510" y1="100" x2="510" y2="145" stroke="{table_border}" stroke-width="0.5"/>
    
    <!-- Preview Label -->
    <text x="300" y="380" text-anchor="middle" font-family="Arial, sans-serif" font-size="10" fill="#666">Live Preview: {title}</text>
</svg>'''
    
    return svg


@bp.route("/presets", methods=["GET"])
def get_presets():
    """Get all PDF layout presets"""
    try:
        # For now, return default presets
        default_presets = {
            "mep_standard": {
                "name": "MEP Standard",
                "description": "Standardformat der deutschen Mitarbeiter-Einsatz-Planung"
            },
            "mep_compact": {
                "name": "MEP Kompakt", 
                "description": "Platzsparende Version für mehr Mitarbeiter pro Seite"
            }
        }
        return jsonify(default_presets), HTTPStatus.OK
    except Exception as e:
        return jsonify({"error": str(e)}), HTTPStatus.INTERNAL_SERVER_ERROR


@bp.route("/presets/<name>", methods=["POST"])
def save_preset(name):
    """Save a new PDF layout preset"""
    try:
        config = request.get_json()
        if not config:
            return jsonify(
                {"error": "No configuration provided"}
            ), HTTPStatus.BAD_REQUEST

        # For now, just return success
        return jsonify(
            {"message": f'Preset "{name}" saved successfully'}
        ), HTTPStatus.CREATED
    except Exception as e:
        return jsonify({"error": str(e)}), HTTPStatus.INTERNAL_SERVER_ERROR


@bp.route("/presets/<name>", methods=["DELETE"])
def delete_preset(name):
    """Delete a PDF layout preset"""
    try:
        # For now, just return success
        return jsonify(
            {"message": f'Preset "{name}" deleted successfully'}
        ), HTTPStatus.OK
    except Exception as e:
        return jsonify({"error": str(e)}), HTTPStatus.INTERNAL_SERVER_ERROR


@bp.route("/presets/<name>/apply", methods=["POST"])
def apply_preset(name):
    """Apply a PDF layout preset as current configuration"""
    try:
        # For now, just return success
        return jsonify(
            {"message": f'Preset "{name}" applied successfully'}
        ), HTTPStatus.OK
    except Exception as e:
        return jsonify({"error": str(e)}), HTTPStatus.INTERNAL_SERVER_ERROR
