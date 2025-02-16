import os
import logging
from typing import Dict, List, Optional, Union
from flask import Flask, request, render_template, jsonify
from werkzeug.utils import secure_filename
from werkzeug.datastructures import FileStorage
import cv2
import pytesseract
from PIL import Image
from datetime import datetime
from sqlalchemy import (
    create_engine, Column, Integer, String, DateTime
)
from sqlalchemy.orm import declarative_base, sessionmaker
import tempfile
from config import get_config


# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# Initialize Flask app with configuration
app = Flask(__name__)
config = get_config()
app.config.from_object(config)


# Ensure upload directory exists
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)


# Database setup
engine = create_engine(app.config['SQLALCHEMY_DATABASE_URI'])
Base = declarative_base()


class ShiftSchedule(Base):
    __tablename__ = 'shift_schedules'
    
    id = Column(Integer, primary_key=True)
    date = Column(DateTime, nullable=False)
    employee = Column(String, nullable=False)
    shift_type = Column(String, nullable=False)
    start_time = Column(String, nullable=False)
    end_time = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


Base.metadata.create_all(engine)
Session = sessionmaker(bind=engine)


def process_image(image_path: str) -> str:
    """Process the uploaded image and extract text using OCR.
    
    Args:
        image_path: Path to the image file to process
        
    Returns:
        Extracted text from the image
        
    Raises:
        ValueError: If the image cannot be loaded
        Exception: If any other error occurs during processing
    """
    try:
        logger.info(f"Processing image: {image_path}")
        
        # Read image using opencv
        img = cv2.imread(image_path)
        if img is None:
            raise ValueError("Failed to load image")
        
        # Convert to grayscale
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        logger.info("Converted image to grayscale")
        
        # Apply thresholding to preprocess the image
        gray = cv2.threshold(
            gray, 
            app.config['IMAGE_THRESHOLD'], 
            app.config['IMAGE_MAX_VALUE'], 
            cv2.THRESH_BINARY + cv2.THRESH_OTSU
        )[1]
        logger.info("Applied thresholding")
        
        # Apply dilation to connect text components
        kernel = cv2.getStructuringElement(
            cv2.MORPH_RECT, 
            app.config['KERNEL_SIZE']
        )
        gray = cv2.dilate(gray, kernel, iterations=1)
        logger.info("Applied dilation")
        
        # Create a unique temporary file
        with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as temp:
            temp_file = temp.name
            cv2.imwrite(temp_file, gray)
            logger.info("Saved preprocessed image")
        
        try:
            # Perform OCR on the processed image
            text = pytesseract.image_to_string(
                Image.open(temp_file),
                lang=app.config['OCR_LANGUAGE']
            )
            logger.info("OCR completed successfully")
            return text
            
        finally:
            # Clean up the temporary file
            if os.path.exists(temp_file):
                os.remove(temp_file)
                logger.info("Cleaned up temporary file")
    
    except Exception as e:
        logger.error(f"Error processing image: {str(e)}")
        raise


def parse_schedule_data(text: str) -> List[Dict[str, Union[datetime, str]]]:
    """Parse the extracted text into structured schedule data.
    
    Args:
        text: The text to parse, containing schedule information
        
    Returns:
        List of dictionaries containing schedule information
        
    Raises:
        Exception: If any error occurs during parsing
    """
    try:
        logger.info("Starting to parse schedule data")
        logger.debug(f"Raw text:\n{text}")
        
        lines = text.split('\n')
        schedules: List[Dict[str, Union[datetime, str]]] = []
        
        def validate_time(time_str: str) -> Optional[str]:
            """Validate and format time string.
            
            Args:
                time_str: Time string to validate (HH:MM or HHMM format)
                
            Returns:
                Formatted time string (HH:MM) if valid, None otherwise
            """
            try:
                # Remove any whitespace
                time_str = time_str.strip()
                
                # Check if time contains colon
                if ':' not in time_str:
                    # Try to convert from HHMM format
                    if len(time_str) == 4 and time_str.isdigit():
                        time_str = f"{time_str[:2]}:{time_str[2:]}"
                    else:
                        return None
                
                # Split hours and minutes
                hours, minutes = map(int, time_str.split(':'))
                
                # Validate hours and minutes
                if not (0 <= hours <= 23 and 0 <= minutes <= 59):
                    return None
                
                # Return standardized format
                return f"{hours:02d}:{minutes:02d}"
            except (ValueError, IndexError):
                return None
        
        def clean_employee_name(name: str) -> str:
            """Clean and validate employee name.
            
            Args:
                name: Employee name to clean
                
            Returns:
                Cleaned employee name
            """
            # Remove special chars but keep umlauts and basic punctuation
            allowed_chars = 'äöüÄÖÜß- '
            cleaned = ''.join(
                c for c in name if c.isalnum() or c in allowed_chars
            )
            return cleaned.strip()
        
        # Basic parsing logic - needs to be adapted to your specific format
        for line in lines:
            if line.strip():
                parts = line.split()
                # Assuming we need at least name, type, start, end
                if len(parts) >= 4:
                    # Clean and validate employee name
                    employee = clean_employee_name(parts[0])
                    if not employee:  # Skip if name is empty after cleaning
                        continue
                    
                    # Validate shift type using config values
                    shift_type = parts[1].strip()
                    min_len = app.config['MIN_SHIFT_TYPE_LENGTH']
                    max_len = app.config['MAX_SHIFT_TYPE_LENGTH']
                    is_valid_shift = (
                        min_len <= len(shift_type) <= max_len and 
                        shift_type.isalnum()
                    )
                    if not is_valid_shift:
                        continue
                    
                    # Validate and format times
                    start_time = validate_time(parts[2])
                    end_time = validate_time(parts[3])
                    
                    # Only create schedule if times are valid
                    if start_time and end_time:
                        schedule = {
                            'date': datetime.now(),
                            'employee': employee,
                            'shift_type': shift_type,
                            'start_time': start_time,
                            'end_time': end_time
                        }
                        schedules.append(schedule)
                        logger.debug(f"Parsed schedule: {schedule}")
        
        logger.info(f"Successfully parsed {len(schedules)} schedules")
        return schedules
    
    except Exception as e:
        logger.error(f"Error parsing schedule data: {str(e)}")
        raise


@app.route('/')
def index() -> str:
    """Render the main page.
    
    Returns:
        Rendered HTML template
    """
    return render_template('index.html')


def allowed_file(filename: str) -> bool:
    """Check if the file extension is allowed.
    
    Args:
        filename: Name of the file to check
        
    Returns:
        True if the file extension is allowed, False otherwise
    """
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in app.config['ALLOWED_EXTENSIONS']


@app.route('/upload', methods=['POST'])
def upload_file() -> tuple[
    Dict[str, Union[str, List[Dict[str, Union[datetime, str]]]]], 
    int
]:
    """Handle file upload and schedule extraction.
    
    Returns:
        Tuple of (response_data, status_code)
        
    Raises:
        Exception: If any error occurs during processing
    """
    session = Session()
    try:
        if 'file' not in request.files:
            logger.warning("No file part in request")
            return jsonify({'error': 'No file part'}), 400
        
        file: FileStorage = request.files['file']
        if file.filename == '':
            logger.warning("No selected file")
            return jsonify({'error': 'No selected file'}), 400
        
        if file and allowed_file(file.filename):
            # Create a unique temporary directory for this upload
            temp_dir = tempfile.mkdtemp()
            try:
                filename = secure_filename(file.filename)
                filepath = os.path.join(temp_dir, filename)
                logger.info(f"Saving uploaded file to {filepath}")
                file.save(filepath)
                
                try:
                    # Process the image
                    extracted_text = process_image(filepath)
                    logger.info("Successfully extracted text from image")
                    
                    # Parse the extracted text
                    schedules = parse_schedule_data(extracted_text)
                    logger.info("Successfully parsed schedules")
                    
                    # Store in database
                    for schedule in schedules:
                        db_schedule = ShiftSchedule(**schedule)
                        session.add(db_schedule)
                    session.commit()
                    logger.info("Successfully stored schedules in database")
                    
                    return jsonify({
                        'message': 'File successfully processed',
                        'schedules': schedules
                    }), 200
                    
                finally:
                    # Clean up the uploaded file
                    if os.path.exists(filepath):
                        os.remove(filepath)
                    os.rmdir(temp_dir)
                    logger.info("Cleaned up temporary files")
            
            except Exception as e:
                logger.error(f"Error processing file: {str(e)}")
                return jsonify({'error': str(e)}), 500
                
        else:
            logger.warning("File type not allowed")
            allowed_types = ', '.join(app.config['ALLOWED_EXTENSIONS'])
            return jsonify({
                'error': f'File type not allowed. Allowed types: {allowed_types}'
            }), 400
            
    finally:
        session.close()


@app.route('/schedules', methods=['GET'])
def get_schedules() -> List[Dict[str, Union[int, str]]]:
    """Get all schedules from the database.
    
    Returns:
        List of schedule dictionaries
    """
    session = Session()
    try:
        schedules = session.query(ShiftSchedule).all()
        return jsonify([{
            'id': s.id,
            'date': s.date.isoformat(),
            'employee': s.employee,
            'shift_type': s.shift_type,
            'start_time': s.start_time,
            'end_time': s.end_time
        } for s in schedules])
    finally:
        session.close()


if __name__ == '__main__':
    app.run(debug=True) 