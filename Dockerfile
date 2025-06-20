# Dockerfile for Cursor Background Agents
# Based on Ubuntu with all development tools needed for the Schichtplan project

FROM ubuntu:22.04

# Set non-interactive mode for apt
ENV DEBIAN_FRONTEND=noninteractive

# Set user and working directory as recommended by Cursor
ENV USER=ubuntu
ENV HOME=/home/ubuntu
WORKDIR /home/ubuntu

# Update package list and install essential packages
RUN apt-get update && apt-get install -y \
    # Basic utilities
    curl \
    wget \
    git \
    vim \
    nano \
    unzip \
    zip \
    build-essential \
    software-properties-common \
    apt-transport-https \
    ca-certificates \
    gnupg \
    lsb-release \
    sudo \
    # For Python development
    python3 \
    python3-pip \
    python3-venv \
    python3-dev \
    # For Node.js/Bun development
    nodejs \
    npm \
    # Database tools (SQLite for development)
    sqlite3 \
    # Network tools
    netcat-openbsd \
    # Process management
    htop \
    && rm -rf /var/lib/apt/lists/*

# Install Python development tools
# First upgrade pip to get newer features, then install tools
RUN pip3 install --upgrade pip setuptools wheel

# Install common Python packages for development
# Use pip install with --user to avoid system package conflicts
RUN pip3 install --user \
    black \
    flake8 \
    mypy \
    pytest \
    ipython \
    jupyter \
    flask \
    flask-sqlalchemy \
    alembic \
    pytest-flask \
    requests

# Install Node.js LTS (for better compatibility)
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs

# Install Bun (JavaScript runtime and package manager) as ubuntu user
USER ubuntu
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/home/ubuntu/.bun/bin:$PATH"
USER root

# Create ubuntu user with sudo privileges
RUN useradd -m -s /bin/bash ubuntu && \
    usermod -aG sudo ubuntu && \
    echo "ubuntu ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers

# Install global development tools
RUN npm install -g \
    typescript \
    @vitejs/plugin-react \
    eslint \
    prettier \
    kill-port

# Set up Python environment
RUN python3 -m pip install --user pipx && \
    python3 -m pipx ensurepath

# Create common development directories
RUN mkdir -p /home/ubuntu/workspace && \
    chown -R ubuntu:ubuntu /home/ubuntu

# Switch to ubuntu user
USER ubuntu

# Set up shell environment and add local bin to PATH
ENV PATH="/home/ubuntu/.local/bin:$PATH"
RUN echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc && \
    echo 'export PATH="$HOME/.bun/bin:$PATH"' >> ~/.bashrc && \
    echo 'alias ll="ls -la"' >> ~/.bashrc && \
    echo 'alias la="ls -la"' >> ~/.bashrc

# Set default shell
SHELL ["/bin/bash", "-c"]

# Set working directory to home
WORKDIR /home/ubuntu

# Verify installations work
RUN python3 --version && \
    node --version && \
    npm --version && \
    bun --version

# Add health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD which python3 && which node && which bun || exit 1

# Default command
CMD ["/bin/bash"]
