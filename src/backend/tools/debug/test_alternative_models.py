#!/usr/bin/env python
# test_alternative_models.py - Test alternative Gemini models for quota availability

import os
import sys
import json
import requests
from pathlib import Path

# Alternative Gemini models to try
MODELS = [
    "gemini-1.0-pro",
    "gemini-1.5-flash",
    "gemini-1.0-pro-latest",
    "gemini-1.0-pro-vision-latest"
]

def test_model(api_key, model_name):
    """Test a specific Gemini model"""
    print(f"\nTesting model: {model_name}")
    
    # Simple prompt for testing
    prompt = "Write a very short hello world message"
    
    # API endpoint
    api_url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
    headers = {"Content-Type": "application/json"}
    
    # Simple payload
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.2,
            "maxOutputTokens": 100,
        }
    }
    
    try:
        print(f"Sending request to {model_name}...")
        response = requests.post(api_url, headers=headers, json=payload, timeout=10)
        
        print(f"Status code: {response.status_code}")
        
        if response.status_code == 200:
            response_json = response.json()
            if (candidates := response_json.get("candidates")) and \
                (content := candidates[0].get("content")) and \
                (parts := content.get("parts")) and \
                (text := parts[0].get("text")):
                
                print(f"Response: {text.strip()[:100]}")
                print("✅ Model available and working")
                return True
            else:
                print("Response structure unexpected")
                return False
        else:
            error_msg = "Unknown error"
            try:
                error_details = response.json()
                if "error" in error_details and "message" in error_details["error"]:
                    error_msg = error_details["error"]["message"]
            except:
                error_msg = response.text
                
            print(f"❌ Error: {error_msg[:100]}")
            return False
            
    except Exception as e:
        print(f"❌ Exception: {str(e)}")
        return False

def test_all_models():
    """Test all alternative models"""
    api_key = "AIzaSyBHkmdaJzg4R249RunbNlbWo8HUjy425vM"
    
    print("Testing alternative Gemini models for quota availability\n")
    
    working_models = []
    
    for model in MODELS:
        if test_model(api_key, model):
            working_models.append(model)
    
    print("\n=== Summary ===")
    if working_models:
        print(f"Working models: {', '.join(working_models)}")
        print(f"\nRecommended model to use: {working_models[0]}")
    else:
        print("No models are currently available with this API key")
        print("Consider upgrading your API key quota or waiting for quota to reset")

if __name__ == "__main__":
    test_all_models() 