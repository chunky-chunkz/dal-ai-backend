#!/bin/bash

# Variables
NAME="DAL-AI"
SERVICE_FILE="/etc/systemd/system/$NAME.service"
APP_DIR="/var/www/$NAME"
SERVICE_CONTENT="[Unit]
Description=$NAME Application
After=network.target

[Service]
Type=simple
User=root
Group=root
WorkingDirectory=$APP_DIR
ExecStart=/bin/bash -c '$APP_DIR/start.sh >> $APP_DIR/$NAME.log 2>&1'
Restart=on-failure
StartLimitInterval=1m
StartLimitBurst=5
Environment='PATH=/root/.nvm/versions/node/v20.19.0/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/snap/bin'

[Install]
WantedBy=multi-user.target
"

# Function to display an error message and exit
function error_exit {
    echo "Error: $1"
    exit 1
}

# Check if the systemd service file exists; create it if not
if [ ! -f "$SERVICE_FILE" ]; then
    echo "Systemd service file not found. Creating $SERVICE_FILE..."

    echo "$SERVICE_CONTENT" | sudo tee "$SERVICE_FILE" > /dev/null || error_exit "Failed to create systemd service file."

    # Reload systemd and enable the service
    sudo chmod +x $APP_DIR/start.sh || error_exit "Failed to make start.sh executable."
    sudo systemctl daemon-reload || error_exit "Failed to reload systemd."
    sudo systemctl enable $NAME.service || error_exit "Failed to enable $NAME service."
    echo "Systemd service file created and enabled."

else
    echo "Systemd service file already exists."
    sudo chmod +x $APP_DIR/start.sh || error_exit "Failed to make start.sh executable."
fi

# Check if the service is active
if sudo systemctl is-active --quiet $NAME.service; then
    echo "Service $NAME.service is already running. Restarting it..."
    sudo systemctl restart $NAME.service || error_exit "Failed to restart $NAME service."
    echo "Service restarted."
else
    echo "Service $NAME.service is not active. Starting it..."
    sudo systemctl start $NAME.service || error_exit "Failed to start $NAME service."
    echo "Service started."
fi

# Ensure the service is enabled
if ! sudo systemctl is-enabled --quiet $NAME.service; then
    echo "Service $NAME.service is not enabled. Enabling it..."
    sudo systemctl enable $NAME.service || error_exit "Failed to enable $NAME service."
    echo "Service enabled."
else
    echo "Service $NAME.service is already enabled."
fi

echo "Setup complete"
