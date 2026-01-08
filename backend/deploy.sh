#!/bin/bash

# Deploy Script for Grammar Correction API
# This script sets up the environment on a Debian/Ubuntu based system (or Mac for local dev mostly, but includes apt-get commands so primarily Linux).

set -e  # Exit strictly on error

echo "Starting deployment..."

# 1. System Updates
echo "Updating system..."
# Check if apt-get exists (Linux)
if command -v apt-get &> /dev/null; then
    sudo apt-get update && sudo apt-get upgrade -y
    sudo apt-get install -y python3 python3-venv python3-pip curl
fi

# 2. Python Setup
echo "Setting up Python environment..."
if [ ! -d "venv" ]; then
    python3 -m venv venv
    echo "Virtual environment created."
fi

source venv/bin/activate

# 3. Dependencies
echo "Installing dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

# 3.5 Download Model (Offline Support)
echo "Downloading model for offline use..."
if [ ! -d "local_model" ]; then
    python download_model.py
else
    echo "local_model directory already exists, skipping download."
fi

# 4. Swap Space (Linux only, skipping if on Mac or if swap exists)
# Check if /swapfile exists
if [ "$(swapon --show --noheadings | wc -l)" -gt 0 ] || [[ "$OSTYPE" == "darwin"* ]]; then
    echo "Swap space is already active (detected via swapon), skipping creation."
else
    echo "Creating 2GB swap file..."
    sudo fallocate -l 2G /swapfile
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    echo "/swapfile none swap sw 0 0" | sudo tee -a /etc/fstab
fi

# 5. Systemd Service Setup (Native Linux Process Management)
echo "Setting up Systemd service..."

# Define service paths
SERVICE_NAME="grammar-api"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
APP_DIR=$(pwd)
USER_NAME=$(whoami)
VENV_PYTHON="${APP_DIR}/venv/bin/python"

# Create systemd service file
echo "Creating service file at ${SERVICE_FILE}..."
sudo bash -c "cat > ${SERVICE_FILE} <<EOF
[Unit]
Description=Grammar Correction API Service
After=network.target

[Service]
User=${USER_NAME}
Group=${USER_NAME}
WorkingDirectory=${APP_DIR}
Environment=\"PATH=${APP_DIR}/venv/bin:/usr/local/bin:/usr/bin:/bin\"
ExecStart=${APP_DIR}/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000
Restart=always

[Install]
WantedBy=multi-user.target
EOF"

# Reload daemon and start service
echo "Reloading systemd and starting service..."
sudo systemctl daemon-reload
sudo systemctl enable ${SERVICE_NAME}
sudo systemctl restart ${SERVICE_NAME}

# Check status
if systemctl is-active --quiet ${SERVICE_NAME}; then
    echo "Service ${SERVICE_NAME} is running successfully!"
else
    echo "Service failed to start. Check logs with: sudo journalctl -u ${SERVICE_NAME} -f"
fi

# 6. Firewall (UFW) - Linux only
if command -v ufw &> /dev/null; then
    echo "Configuring firewall..."
    # Since we are using Nginx, we don't need to expose 8000 directly.
    # We only need standard HTTP/HTTPS ports.
    sudo ufw allow ssh
    sudo ufw allow 80/tcp
    sudo ufw allow 443/tcp
    # sudo ufw enable  # Uncomment strictly if you want to enable firewall automatically
fi

echo "Deployment complete! API is running on port 8000."
