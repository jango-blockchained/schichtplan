#!/usr/bin/env python3
"""
Simple test server to verify if local connections work
"""

from flask import Flask

app = Flask(__name__)


@app.route("/")
def hello():
    return "Hello from test server!"


@app.route("/json")
def json():
    return {"message": "This is a JSON response", "status": "ok"}


if __name__ == "__main__":
    print("Starting test server on http://127.0.0.1:5000")
    app.run(debug=True, host="127.0.0.1", port=5000)
