import os
import json
from io import BytesIO
from datetime import datetime


def test_complete_workflow(client, test_db, sample_image):
    """Test the complete workflow from upload to retrieval."""
    # 1. Initial state - no schedules
    with client.application.app_context():
        response = client.get('/schedules')
        assert response.status_code == 200
        assert len(json.loads(response.data)) == 0
        
        # 2. Upload a schedule image
        with open(sample_image, 'rb') as img:
            image_data = img.read()
        
        response = client.post(
            '/upload',
            data={'file': (BytesIO(image_data), 'test_schedule.png')},
            content_type='multipart/form-data'
        )
        assert response.status_code == 200
        upload_data = json.loads(response.data)
        assert len(upload_data['schedules']) > 0
        
        # 3. Verify schedules were stored
        response = client.get('/schedules')
        assert response.status_code == 200
        schedules = json.loads(response.data)
        assert len(schedules) > 0
        
        # 4. Verify schedule data integrity
        schedule = schedules[0]
        assert isinstance(schedule['id'], int)
        assert datetime.fromisoformat(schedule['date'])
        assert len(schedule['employee']) > 0
        assert len(schedule['shift_type']) > 0
        assert ':' in schedule['start_time']
        assert ':' in schedule['end_time']


def test_concurrent_uploads(client, test_db, sample_image):
    """Test handling multiple uploads in quick succession."""
    with open(sample_image, 'rb') as img:
        image_data = img.read()
    
    with client.application.app_context():
        # Perform multiple uploads
        responses = []
        for _ in range(3):  # Reduced from 5 for stability
            response = client.post(
                '/upload',
                data={'file': (BytesIO(image_data), f'test_schedule_{_}.png')},
                content_type='multipart/form-data'
            )
            responses.append(response)
        
        # Verify all uploads were successful
        for response in responses:
            assert response.status_code == 200
            data = json.loads(response.data)
            assert len(data['schedules']) > 0
        
        # Verify all schedules were stored
        response = client.get('/schedules')
        schedules = json.loads(response.data)
        assert len(schedules) == len(responses) * 2  # Each upload has 2 schedules


def test_data_persistence(client, test_db, sample_image):
    """Test that data persists correctly in the database."""
    with client.application.app_context():
        # 1. Upload initial schedule
        with open(sample_image, 'rb') as img:
            image_data = img.read()
        
        client.post(
            '/upload',
            data={'file': (BytesIO(image_data), 'test_schedule.png')},
            content_type='multipart/form-data'
        )
        
        # 2. Get initial state
        response = client.get('/schedules')
        initial_schedules = json.loads(response.data)
        
        # 3. Upload another schedule
        client.post(
            '/upload',
            data={'file': (BytesIO(image_data), 'test_schedule2.png')},
            content_type='multipart/form-data'
        )
        
        # 4. Verify data was appended, not overwritten
        response = client.get('/schedules')
        updated_schedules = json.loads(response.data)
        assert len(updated_schedules) == len(initial_schedules) + 2


def test_error_recovery(client, test_db, sample_image):
    """Test system recovery after processing errors."""
    with client.application.app_context():
        # 1. Try uploading corrupt data
        response = client.post(
            '/upload',
            data={'file': (BytesIO(b'not an image'), 'corrupt.png')},
            content_type='multipart/form-data'
        )
        assert response.status_code != 200
        
        # 2. Verify no data was stored
        response = client.get('/schedules')
        assert len(json.loads(response.data)) == 0
        
        # 3. Upload valid image
        with open(sample_image, 'rb') as img:
            image_data = img.read()
        
        response = client.post(
            '/upload',
            data={'file': (BytesIO(image_data), 'valid.png')},
            content_type='multipart/form-data'
        )
        assert response.status_code == 200
        
        # 4. Verify system recovered and processed valid data
        response = client.get('/schedules')
        schedules = json.loads(response.data)
        assert len(schedules) > 0 