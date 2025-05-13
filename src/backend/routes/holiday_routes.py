from flask import Blueprint, jsonify, request
from http import HTTPStatus
import requests
import logging
from datetime import datetime

holidays = Blueprint("holidays", __name__)

@holidays.route("/holidays/<country>/<int:year>", methods=["GET"])
@holidays.route("/holidays/<country>/<int:year>/", methods=["GET"])
def get_holidays(country, year):
    """
    Fetch holidays for a specific country and year from an external API.
    
    Args:
        country: Country code (e.g., 'DE' for Germany)
        year: Year for which to fetch holidays
        
    Returns:
        JSON response with list of holidays
    """
    try:
        # Use Nager.Date API to fetch holidays
        # Documentation: https://date.nager.at/swagger/index.html
        url = f"https://date.nager.at/api/v3/PublicHolidays/{year}/{country}"
        response = requests.get(url, timeout=5)
        
        if response.status_code != 200:
            return jsonify({
                "error": f"Error fetching holidays: {response.status_code}",
                "message": response.text
            }), HTTPStatus.BAD_REQUEST
        
        holidays_data = response.json()
        
        # Transform data to match our frontend expectations
        formatted_holidays = []
        for holiday in holidays_data:
            formatted_holidays.append({
                "date": holiday.get("date"),
                "name": holiday.get("name", holiday.get("localName", "Unknown")),
                "type": "National" if holiday.get("global", True) else "Regional",
                "description": holiday.get("localName", "")
            })
        
        return jsonify({"holidays": formatted_holidays})
    
    except requests.RequestException as e:
        logging.error(f"Error fetching holidays from external API: {str(e)}")
        return jsonify({
            "error": "Failed to fetch holidays", 
            "message": str(e)
        }), HTTPStatus.SERVICE_UNAVAILABLE
    
    except Exception as e:
        logging.error(f"Unexpected error fetching holidays: {str(e)}")
        return jsonify({
            "error": "Unexpected error", 
            "message": str(e)
        }), HTTPStatus.INTERNAL_SERVER_ERROR

@holidays.route("/holidays/supported-countries", methods=["GET"])
@holidays.route("/holidays/supported-countries/", methods=["GET"])
def get_supported_countries():
    """
    Return a list of supported countries for holiday fetching.
    
    Returns:
        JSON response with list of supported countries
    """
    # This is a static list of commonly used countries with their codes
    countries = [
        {"code": "AT", "name": "Austria"},
        {"code": "BE", "name": "Belgium"},
        {"code": "DE", "name": "Germany"},
        {"code": "FR", "name": "France"},
        {"code": "IT", "name": "Italy"},
        {"code": "NL", "name": "Netherlands"},
        {"code": "ES", "name": "Spain"},
        {"code": "CH", "name": "Switzerland"},
        {"code": "GB", "name": "United Kingdom"},
        {"code": "US", "name": "United States"}
    ]
    
    return jsonify({"countries": countries})