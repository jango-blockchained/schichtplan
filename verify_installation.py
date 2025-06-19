#!/usr/bin/env python3
"""
Installation verification script for Schichtplan MCP Server
"""

import sys
import subprocess
import importlib

def check_python_version():
    """Check if Python version is suitable."""
    version = sys.version_info
    if version.major < 3 or (version.major == 3 and version.minor < 8):
        print(f"❌ Python {version.major}.{version.minor} is too old. Python 3.8+ required.")
        return False
    print(f"✅ Python {version.major}.{version.minor}.{version.micro} is suitable.")
    return True

def check_module(module_name, import_path=None):
    """Check if a module can be imported."""
    try:
        if import_path:
            module = importlib.import_module(import_path)
        else:
            module = importlib.import_module(module_name)
        version = getattr(module, '__version__', 'unknown')
        print(f"✅ {module_name}: {version}")
        return True
    except ImportError as e:
        print(f"❌ {module_name}: Not found ({e})")
        return False

def main():
    """Main verification function."""
    print("🔍 Verifying Schichtplan MCP Server installation...\n")
    
    success = True
    
    # Check Python version
    print("📋 Python Version:")
    success &= check_python_version()
    
    # Check core dependencies
    print("\n📦 Core Dependencies:")
    required_modules = [
        ("flask", "flask"),
        ("flask-cors", "flask_cors"),
        ("flask-sse", "flask_sse"),
        ("fastmcp", "fastmcp"),
        ("pydantic", "pydantic"),
        ("uvicorn", "uvicorn"),
        ("sqlalchemy", "sqlalchemy"),
    ]
    
    for display_name, import_name in required_modules:
        success &= check_module(display_name, import_name)
    
    # Test MCP server import
    print("\n🔧 MCP Server:")
    try:
        sys.path.insert(0, '.')
        from src.backend.mcp_server import main_cli
        print("✅ MCP Server: Import successful")
    except Exception as e:
        print(f"❌ MCP Server: Import failed ({e})")
        success = False
    
    print(f"\n{'🎉 All checks passed!' if success else '⚠️  Some checks failed.'}")
    return success

if __name__ == "__main__":
    sys.exit(0 if main() else 1)
