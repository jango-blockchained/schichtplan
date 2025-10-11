#!/usr/bin/env python3
"""
MCP Integration Setup Script for Schichtplan

This script helps configure popular AI tools to connect to the Schichtplan MCP server.
It generates configuration files and provides setup instructions.

Usage:
    python3 scripts/setup_mcp_integration.py --tool claude
    python3 scripts/setup_mcp_integration.py --tool cursor
    python3 scripts/setup_mcp_integration.py --show-all
"""

import argparse
import json
import os
import sys
from pathlib import Path


def get_project_root():
    """Get the absolute path to the project root."""
    return Path(__file__).parent.parent.absolute()


def generate_claude_config():
    """Generate Claude Desktop configuration."""
    project_root = get_project_root()
    
    config = {
        "mcpServers": {
            "schichtplan": {
                "command": "python3",
                "args": ["src/backend/mcp_server.py"],
                "cwd": str(project_root),
                "env": {
                    "PYTHONPATH": str(project_root)
                }
            }
        }
    }
    
    return json.dumps(config, indent=2)


def generate_cursor_config():
    """Generate Cursor IDE configuration."""
    project_root = get_project_root()
    
    config = {
        "mcp": {
            "servers": {
                "schichtplan": {
                    "command": ["python3", "src/backend/mcp_server.py"],
                    "cwd": str(project_root),
                    "transport": "stdio"
                }
            }
        }
    }
    
    return json.dumps(config, indent=2)


def generate_generic_config():
    """Generate generic MCP configuration."""
    project_root = get_project_root()
    
    config = {
        "name": "Schichtplan MCP Server",
        "command": "python3",
        "args": ["src/backend/mcp_server.py"],
        "cwd": str(project_root),
        "transports": {
            "stdio": {
                "command": ["python3", "src/backend/mcp_server.py"]
            },
            "sse": {
                "url": "http://localhost:8001/sse",
                "command": ["python3", "src/backend/mcp_server.py", "--transport", "sse", "--port", "8001"]
            },
            "http": {
                "url": "http://localhost:8002/mcp",
                "command": ["python3", "src/backend/mcp_server.py", "--transport", "http", "--port", "8002"]
            }
        }
    }
    
    return json.dumps(config, indent=2)


def get_claude_config_path():
    """Get the Claude Desktop configuration file path."""
    home = Path.home()
    
    # Different paths for different operating systems
    if sys.platform == "darwin":  # macOS
        return home / "Library" / "Application Support" / "Claude" / "claude_desktop_config.json"
    elif sys.platform == "win32":  # Windows
        return home / "AppData" / "Roaming" / "Claude" / "claude_desktop_config.json"
    else:  # Linux
        return home / ".config" / "claude" / "claude_desktop_config.json"


def setup_claude():
    """Set up Claude Desktop integration."""
    print("=== Claude Desktop Integration Setup ===")
    print()
    
    config_path = get_claude_config_path()
    config_content = generate_claude_config()
    
    print(f"Configuration path: {config_path}")
    print()
    print("Configuration to add:")
    print(config_content)
    print()
    
    # Check if config file exists
    if config_path.exists():
        print(f"⚠️  Configuration file already exists at: {config_path}")
        print("Please manually merge the Schichtplan MCP server configuration with your existing config.")
        print()
        response = input("Do you want to see the merge instructions? (y/N): ")
        if response.lower() == 'y':
            print("\nMerge Instructions:")
            print("1. Open your existing claude_desktop_config.json")
            print("2. Add the 'schichtplan' entry to the 'mcpServers' section")
            print("3. If 'mcpServers' doesn't exist, add the entire section")
    else:
        print("Creating new configuration file...")
        response = input(f"Create configuration file at {config_path}? (y/N): ")
        if response.lower() == 'y':
            # Create directory if it doesn't exist
            config_path.parent.mkdir(parents=True, exist_ok=True)
            
            # Write configuration
            with open(config_path, 'w') as f:
                f.write(config_content)
            
            print(f"✅ Configuration file created at: {config_path}")
        else:
            print("Configuration not created. You can manually create it later.")
    
    print()
    print("Next steps:")
    print("1. Restart Claude Desktop")
    print("2. Start the Schichtplan application: ./start.sh --with-mcp")
    print("3. In Claude, you should see Schichtplan tools available")


def setup_cursor():
    """Set up Cursor IDE integration."""
    print("=== Cursor IDE Integration Setup ===")
    print()
    
    config_content = generate_cursor_config()
    
    print("Add this configuration to your Cursor settings:")
    print(config_content)
    print()
    print("Setup Instructions:")
    print("1. Open Cursor IDE")
    print("2. Go to Settings > Extensions > MCP")
    print("3. Add the above configuration")
    print("4. Restart Cursor")
    print("5. Start Schichtplan: ./start.sh --with-mcp")


def show_all_integrations():
    """Show configuration for all supported tools."""
    print("=== All MCP Integration Configurations ===")
    print()
    
    print("--- Claude Desktop ---")
    print(generate_claude_config())
    print()
    
    print("--- Cursor IDE ---")
    print(generate_cursor_config())
    print()
    
    print("--- Generic MCP Configuration ---")
    print(generate_generic_config())
    print()
    
    print("--- Manual Integration ---")
    print("For other MCP-compatible tools:")
    print("- stdio: python3 src/backend/mcp_server.py")
    print("- SSE: http://localhost:8001/sse")
    print("- HTTP: http://localhost:8002/mcp")


def test_mcp_server():
    """Test if the MCP server can be started."""
    print("=== Testing MCP Server ===")
    print()
    
    project_root = get_project_root()
    mcp_server_path = project_root / "src" / "backend" / "mcp_server.py"
    
    if not mcp_server_path.exists():
        print(f"❌ MCP server not found at: {mcp_server_path}")
        return False
    
    print(f"✅ MCP server found at: {mcp_server_path}")
    
    # Test if Python dependencies are available
    try:
        import sys
        sys.path.insert(0, str(project_root))
        from src.backend.services.mcp_service import SchichtplanMCPService
        print("✅ MCP service imports successfully")
    except ImportError as e:
        print(f"❌ Import error: {e}")
        print("Please install the required dependencies:")
        print("pip install -r src/backend/requirements.txt")
        return False
    
    print("✅ MCP server is ready to use")
    return True


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Setup MCP integration for Schichtplan",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )
    
    parser.add_argument(
        "--tool",
        choices=["claude", "cursor"],
        help="Specific tool to set up"
    )
    
    parser.add_argument(
        "--show-all",
        action="store_true",
        help="Show configuration for all supported tools"
    )
    
    parser.add_argument(
        "--test",
        action="store_true",
        help="Test if MCP server can be started"
    )
    
    args = parser.parse_args()
    
    if args.test:
        test_mcp_server()
    elif args.tool == "claude":
        setup_claude()
    elif args.tool == "cursor":
        setup_cursor()
    elif args.show_all:
        show_all_integrations()
    else:
        print("Schichtplan MCP Integration Setup")
        print("=================================")
        print()
        print("Available options:")
        print("  --tool claude     Set up Claude Desktop integration")
        print("  --tool cursor     Set up Cursor IDE integration")
        print("  --show-all        Show all configuration examples")
        print("  --test            Test MCP server setup")
        print("  --help            Show this help message")
        print()
        print("For detailed documentation, see: docs/mcp_api.md")


if __name__ == "__main__":
    main()
