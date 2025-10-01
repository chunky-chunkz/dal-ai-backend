#!/bin/bash
echo "Starting AI Backend with Auto-Restart..."
echo "Press Ctrl+C to stop completely"
echo

while true; do
    echo "[$(date)] Starting backend..."
    node "C:/development/dal-ki-1/backend/simple-ai-server.cjs"
    echo "[$(date)] Backend stopped! Restarting in 3 seconds..."
    sleep 3
done
