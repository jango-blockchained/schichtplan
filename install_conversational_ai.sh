#!/bin/bash
# Installation script for Conversational AI MCP Service

set -e

echo "🚀 Installing Conversational AI MCP Service Dependencies"
echo "=================================================="

# Check Python version
python_version=$(python3 --version 2>&1 | grep -oP '\d+\.\d+')
version_check=$(python3 -c "import sys; print(1 if sys.version_info >= (3, 8) else 0)")
if [[ $version_check -eq 0 ]]; then
    echo "❌ Python 3.8+ required. Found: $python_version"
    exit 1
fi
echo "✅ Python version: $python_version"

# Check if in virtual environment (recommended)
if [[ -z "$VIRTUAL_ENV" ]]; then
    echo "⚠️  Warning: Not in a virtual environment. Consider using venv."
    read -p "Continue anyway? [y/N] " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Install Python dependencies
echo "📦 Installing Python dependencies..."

pip install --upgrade pip

# Core dependencies
pip install redis>=4.0.0
pip install fastmcp>=0.1.0  
pip install openai>=1.0.0
pip install anthropic>=0.20.0
pip install google-generativeai>=0.3.0
pip install pydantic>=2.0.0
pip install asyncio-redis>=1.13.0

# Additional dependencies for enhanced features
pip install httpx>=0.24.0
pip install aiohttp>=3.8.0
pip install websockets>=11.0.0
pip install pyyaml>=6.0.0

echo "✅ Python dependencies installed"

# Check Redis installation
echo "🔍 Checking Redis installation..."
if command -v redis-server &> /dev/null; then
    echo "✅ Redis server found"
    
    # Test Redis connection
    if redis-cli ping 2>/dev/null | grep -q "PONG"; then
        echo "✅ Redis server is running"
    else
        echo "⚠️  Redis server is not running"
        echo "To start Redis: redis-server"
    fi
else
    echo "❌ Redis not found. Installing Redis..."
    
    # Detect OS and install Redis
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux
        if command -v apt-get &> /dev/null; then
            sudo apt-get update
            sudo apt-get install -y redis-server
        elif command -v yum &> /dev/null; then
            sudo yum install -y redis
        elif command -v pacman &> /dev/null; then
            sudo pacman -S redis
        else
            echo "❌ Cannot auto-install Redis. Please install manually."
            exit 1
        fi
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        if command -v brew &> /dev/null; then
            brew install redis
        else
            echo "❌ Homebrew not found. Please install Redis manually."
            exit 1
        fi
    else
        echo "❌ Unsupported OS for auto-installation. Please install Redis manually."
        exit 1
    fi
    
    echo "✅ Redis installed"
fi

# Create configuration directories
echo "📁 Creating configuration directories..."
mkdir -p logs
mkdir -p config
mkdir -p data

# Generate example configuration
echo "⚙️  Generating example configuration..."
python3 -c "
import sys
sys.path.append('src')
from backend.services.config import save_example_config
save_example_config('config/conversational_ai_config.json')
"

echo "✅ Configuration file created: config/conversational_ai_config.json"

# Create environment file template
echo "📝 Creating environment file template..."
cat > .env.example << EOF
# AI Provider Configuration
OPENAI_API_KEY=your-openai-api-key-here
ANTHROPIC_API_KEY=your-anthropic-api-key-here
AI_PREFERRED_PROVIDER=openai

# Redis Configuration
REDIS_URL=redis://localhost:6379

# Conversation Settings
CONVERSATION_TTL=86400
MAX_CONTEXT_ITEMS=100
MAX_CONCURRENT_CONVERSATIONS=100

# Logging
LOG_LEVEL=INFO
LOG_CONVERSATIONS=true

# Performance
ENABLE_CACHING=true
PARALLEL_TOOL_EXECUTION=true

# Security
RATE_LIMIT_PER_MINUTE=60
ENABLE_USER_AUTH=false

# Environment
ENVIRONMENT=development
EOF

echo "✅ Environment template created: .env.example"

# Make scripts executable
echo "🔧 Making scripts executable..."
chmod +x start_conversational_ai.py
chmod +x test_conversational_ai.py

# Run basic health check
echo "🏥 Running basic health check..."
python3 start_conversational_ai.py --health-check 2>/dev/null || echo "⚠️  Health check failed - configure API keys first"

echo ""
echo "🎉 Installation Complete!"
echo "=================================================="
echo ""
echo "Next steps:"
echo "1. Copy .env.example to .env and add your API keys:"
echo "   cp .env.example .env"
echo "   # Edit .env and add your OPENAI_API_KEY or ANTHROPIC_API_KEY"
echo ""
echo "2. Start Redis server (if not already running):"
echo "   redis-server"
echo ""
echo "3. Test the installation:"
echo "   python3 start_conversational_ai.py --test"
echo ""
echo "4. Start the conversational AI server:"
echo "   python3 start_conversational_ai.py --transport stdio"
echo ""
echo "5. Read the documentation:"
echo "   cat CONVERSATIONAL_AI_README.md"
echo ""
echo "For help: python3 start_conversational_ai.py --help"
