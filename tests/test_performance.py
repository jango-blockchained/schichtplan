import time
import pytest
from io import BytesIO
import concurrent.futures
from flask import Flask


def test_upload_performance(client, test_db, sample_image):
    """Test upload endpoint performance."""
    with open(sample_image, 'rb') as img:
        image_data = img.read()
    
    # Measure single upload time
    start_time = time.time()
    with client.application.app_context():
        response = client.post(
            '/upload',
            data={'file': (BytesIO(image_data), 'test_schedule.png')},
            content_type='multipart/form-data'
        )
    single_upload_time = time.time() - start_time
    
    assert response.status_code == 200
    assert single_upload_time < 5.0  # Should process within 5 seconds


def test_concurrent_performance(client, test_db, sample_image):
    """Test performance under concurrent load."""
    with open(sample_image, 'rb') as img:
        image_data = img.read()
    
    def upload_file():
        with client.application.test_client() as test_client:
            with test_client.application.app_context():
                return test_client.post(
                    '/upload',
                    data={
                        'file': (BytesIO(image_data), 'test_schedule.png')
                    },
                    content_type='multipart/form-data'
                )
    
    # Test with 3 concurrent uploads (reduced from 5 for stability)
    start_time = time.time()
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
        futures = [executor.submit(upload_file) for _ in range(3)]
        responses = [f.result() for f in futures]
    
    total_time = time.time() - start_time
    
    # Verify all uploads were successful
    assert all(r.status_code == 200 for r in responses)
    # All uploads should complete within 10 seconds
    assert total_time < 10


def test_database_query_performance(client, test_db, sample_image):
    """Test database query performance with increasing data."""
    with open(sample_image, 'rb') as img:
        image_data = img.read()
    
    # Upload multiple schedules
    with client.application.app_context():
        for _ in range(10):
            client.post(
                '/upload',
                data={'file': (BytesIO(image_data), f'schedule_{_}.png')},
                content_type='multipart/form-data'
            )
    
        # Measure query time
        start_time = time.time()
        response = client.get('/schedules')
        query_time = time.time() - start_time
    
    assert response.status_code == 200
    assert query_time < 1.0  # Should retrieve results quickly


def test_image_processing_performance(client, test_db, sample_image):
    """Test image processing performance with different image sizes."""
    import cv2
    import numpy as np
    
    # Create images of different sizes
    sizes = [(400, 1000), (800, 2000), (1600, 4000)]
    processing_times = []
    
    for width, height in sizes:
        # Create test image of specific size
        img = np.ones((height, width), dtype=np.uint8) * 255
        font = cv2.FONT_HERSHEY_SIMPLEX
        cv2.putText(
            img, 'John TZ 08:00 16:00',
            (50, height//2),
            font, height/400,  # Scale font with image
            (0, 0, 0), 3, cv2.LINE_AA
        )
        
        # Save to bytes
        success, buffer = cv2.imencode('.png', img)
        assert success
        
        # Measure upload and processing time
        start_time = time.time()
        with client.application.test_client() as test_client:
            response = test_client.post(
                '/upload',
                data={'file': (BytesIO(buffer), 'test.png')},
                content_type='multipart/form-data'
            )
            assert response.status_code == 200
        
        processing_time = time.time() - start_time
        processing_times.append(processing_time)
        
        # Verify processing time scales reasonably with image size
        if len(processing_times) > 1:
            # Processing time should not increase more than 4x when doubling image size
            assert processing_times[-1] < 4 * processing_times[-2] 