import os
import pytest
from app import process_image, parse_schedule_data


def test_process_image(sample_image):
    """Test that process_image can extract text from an image."""
    # Process the sample image
    extracted_text = process_image(sample_image)
    
    # Check that we got some text back
    assert extracted_text is not None
    assert isinstance(extracted_text, str)
    assert len(extracted_text) > 0
    
    # Check that the text contains expected patterns
    assert any('John' in line or 'Jane' in line for line in extracted_text.split('\n'))
    assert any('TZ' in line or 'FZ' in line for line in extracted_text.split('\n'))
    assert any('08:00' in line or '09:00' in line for line in extracted_text.split('\n'))


def test_parse_schedule_data():
    """Test that parse_schedule_data correctly parses text into schedule data."""
    # Sample text that might come from OCR
    sample_text = """
    John TZ 08:00 16:00
    Jane FZ 09:00 17:00
    """
    
    # Parse the text
    schedules = parse_schedule_data(sample_text)
    
    # Check that we got the expected number of schedules
    assert len(schedules) == 2
    
    # Check the first schedule
    assert schedules[0]['employee'] == 'John'
    assert schedules[0]['shift_type'] == 'TZ'
    assert schedules[0]['start_time'] == '08:00'
    assert schedules[0]['end_time'] == '16:00'
    
    # Check the second schedule
    assert schedules[1]['employee'] == 'Jane'
    assert schedules[1]['shift_type'] == 'FZ'
    assert schedules[1]['start_time'] == '09:00'
    assert schedules[1]['end_time'] == '17:00'


def test_process_image_invalid_path():
    """Test that process_image handles invalid file paths gracefully."""
    with pytest.raises(Exception):
        process_image('nonexistent_file.jpg')


def test_parse_schedule_data_empty():
    """Test that parse_schedule_data handles empty input gracefully."""
    schedules = parse_schedule_data('')
    assert len(schedules) == 0
    
    schedules = parse_schedule_data('\n\n\n')
    assert len(schedules) == 0


def test_parse_schedule_data_invalid():
    """Test that parse_schedule_data handles invalid input gracefully."""
    # Text with insufficient data
    sample_text = """
    John
    Jane TZ
    Bob FZ 09:00
    """
    
    schedules = parse_schedule_data(sample_text)
    assert len(schedules) == 0  # Should not create schedules with insufficient data 