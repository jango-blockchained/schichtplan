# Schichtplan - Shift Schedule Manager

A web application for processing and managing handwritten shift schedules using OCR technology.

## Features

- Upload and process handwritten shift schedule images
- OCR text extraction from images
- Structured storage of shift data
- Web interface for viewing and managing schedules

## Setup

1. Install required system dependencies:
```bash
sudo apt-get update
sudo apt-get install tesseract-ocr
sudo apt-get install tesseract-ocr-deu  # For German language support
```

2. Install Python dependencies:
```bash
pip install -r requirements.txt
```

3. Run the application:
```bash
python app.py
```

## Usage

1. Access the web interface at `http://localhost:5000`
2. Upload an image of a handwritten shift schedule
3. The system will process the image and extract the schedule data
4. View and manage the processed schedules through the web interface

## Requirements

- Python 3.8+
- Tesseract OCR
- Web browser
- Required Python packages (see requirements.txt) 