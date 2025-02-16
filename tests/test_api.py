import os
import json
import pytest
from io import BytesIO


def test_index_page(client):
    """Test that the index page loads correctly."""
    response = client.get('/')
    assert response.status_code == 200
    assert b'Schichtplan Manager' in response.data


def test_upload_no_file(client):
    """Test upload endpoint with no file."""
    response = client.post('/upload')
    assert response.status_code == 400
    data = json.loads(response.data)
    assert 'error' in data
    assert data['error'] == 'No file part'


def test_upload_empty_file(client):
    """Test upload endpoint with empty file selection."""
    response = client.post('/upload', data={'file': (BytesIO(), '')})
    assert response.status_code == 400
    data = json.loads(response.data)
    assert 'error' in data
    assert data['error'] == 'No selected file'


def test_upload_valid_image(client, sample_image):
    """Test upload endpoint with a valid image."""
    with open(sample_image, 'rb') as img:
        image_data = img.read()
    
    response = client.post(
        '/upload',
        data={'file': (BytesIO(image_data), 'test_schedule.png')},
        content_type='multipart/form-data'
    )
    
    assert response.status_code == 200
    data = json.loads(response.data)
    assert 'message' in data
    assert 'schedules' in data
    assert len(data['schedules']) > 0


def test_get_schedules_empty(client, test_db):
    """Test getting schedules when database is empty."""
    response = client.get('/schedules')
    assert response.status_code == 200
    data = json.loads(response.data)
    assert isinstance(data, list)
    assert len(data) == 0


def test_get_schedules_with_data(client, test_db, sample_image):
    """Test getting schedules when database has entries."""
    # First upload a schedule
    with open(sample_image, 'rb') as img:
        image_data = img.read()
    
    # Upload the image
    client.post(
        '/upload',
        data={'file': (BytesIO(image_data), 'test_schedule.png')},
        content_type='multipart/form-data'
    )
    
    # Now get the schedules
    response = client.get('/schedules')
    assert response.status_code == 200
    data = json.loads(response.data)
    assert isinstance(data, list)
    assert len(data) > 0
    
    # Check schedule structure
    schedule = data[0]
    assert 'id' in schedule
    assert 'date' in schedule
    assert 'employee' in schedule
    assert 'shift_type' in schedule
    assert 'start_time' in schedule
    assert 'end_time' in schedule 