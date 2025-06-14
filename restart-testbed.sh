#!/bin/bash

echo "🔄 Restarting testbed..."

# Kill all testbed processes
pkill -f "start-testbed" 2>/dev/null
pkill -f "bun.*dev" 2>/dev/null
pkill -f "server/signaling" 2>/dev/null
pkill -f "server/worker" 2>/dev/null
pkill -f "vite" 2>/dev/null

# Wait for processes to die
sleep 3

# Start fresh testbed
./start-testbed.sh &

# Wait for services to start
sleep 10

# Check if client is ready
for i in {1..30}; do
    if curl -k https://kollator.local:5173/ > /dev/null 2>&1; then
        echo "✅ Testbed ready"
        exit 0
    fi
    sleep 1
done

echo "❌ Testbed failed to start"
exit 1
