import os
import pytest
import tempfile
from io import BytesIO
import cv2
import numpy as np
from app import app, Base, Session, engine


@pytest.fixture
def client():
    """Create a test client for the Flask application."""
    app.config['TESTING'] = True
    app.config['UPLOAD_FOLDER'] = tempfile.mkdtemp()
    
    with app.test_client() as client:
        yield client
    
    # Clean up upload folder after test
    if os.path.exists(app.config['UPLOAD_FOLDER']):
        for file in os.listdir(app.config['UPLOAD_FOLDER']):
            os.remove(os.path.join(app.config['UPLOAD_FOLDER'], file))
        os.rmdir(app.config['UPLOAD_FOLDER'])


@pytest.fixture
def test_db():
    """Create a test database session."""
    # Create all tables in the test database
    Base.metadata.create_all(engine)
    
    # Create a new session factory
    test_session = Session()
    
    # Clear all tables before each test
    for table in reversed(Base.metadata.sorted_tables):
        test_session.execute(table.delete())
    test_session.commit()
    
    yield test_session
    
    # Clean up after test
    test_session.close()
    Base.metadata.drop_all(engine)


@pytest.fixture
def sample_image():
    """Create a sample image for testing."""
    # Create a temporary directory
    temp_dir = tempfile.mkdtemp()
    image_path = os.path.join(temp_dir, 'test_schedule.png')
    
    # Create a white image
    img = np.ones((400, 1000), dtype=np.uint8) * 255
    
    # Add some test text
    font = cv2.FONT_HERSHEY_SIMPLEX
    cv2.putText(img, 'John TZ 08:00 16:00', (50, 100), font, 1.5, (0, 0, 0), 3)
    cv2.putText(img, 'Jane FZ 09:00 17:00', (50, 200), font, 1.5, (0, 0, 0), 3)
    
    # Save the image
    cv2.imwrite(image_path, img)
    
    yield image_path
    
    # Clean up
    if os.path.exists(image_path):
        os.remove(image_path)
    if os.path.exists(temp_dir):
        os.rmdir(temp_dir) 