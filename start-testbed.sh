#!/bin/bash

# Kollator Testbed Startup Script
# This script starts all components as separate processes for performance

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Starting Kollator Testbed${NC}"

# Check if kollator.local is in hosts file
if ! grep -q "kollator.local" /etc/hosts; then
    echo -e "${YELLOW}⚠️  Adding kollator.local to /etc/hosts (requires sudo)${NC}"
    echo "127.0.0.1 kollator.local" | sudo tee -a /etc/hosts
fi

# Start MinIO S3-compatible storage
echo -e "${GREEN}🗄️  Starting MinIO S3 Storage...${NC}"
docker-compose up -d > logs/minio.log 2>&1 &
sleep 5

# Function to kill background processes on exit
cleanup() {
    echo -e "\n${YELLOW}🛑 Shutting down testbed...${NC}"
    jobs -p | xargs -r kill
    exit 0
}
trap cleanup SIGINT SIGTERM

# Create log directory
mkdir -p logs

echo -e "${GREEN}📡 Starting Signaling Server...${NC}"
cd server/signaling
bun install > ../../logs/signaling-install.log 2>&1
bun run index.ts > ../../logs/signaling.log 2>&1 &
SIGNALING_PID=$!
cd ../..

# Wait a moment for signaling server to start
sleep 2

echo -e "${GREEN}⚙️  Starting Worker 1...${NC}"
cd server/worker
bun install > ../../logs/worker-install.log 2>&1
bun run index.ts > ../../logs/worker1.log 2>&1 &
WORKER1_PID=$!
cd ../..

# Wait a moment for worker to start
sleep 2

echo -e "${GREEN}🌐 Starting Client Dev Server...${NC}"
cd client
npm install > ../logs/client-install.log 2>&1
npm run dev > ../logs/client.log 2>&1 &
CLIENT_PID=$!
cd ..

echo -e "${GREEN}✅ Testbed started successfully!${NC}"
echo -e "${BLUE}📊 Services:${NC}"
echo -e "  • Signaling Server: https://kollator.local:8000"
echo -e "  • Client App: https://kollator.local:5173"
echo -e "  • Worker 1: Running (connects to signaling)"
echo -e "  • MinIO S3 Storage: http://localhost:9000 (admin: http://localhost:9001)"
echo -e "    - Access Key: kollator"
echo -e "    - Secret Key: kollator123"
echo ""
echo -e "${BLUE}📝 Logs:${NC}"
echo -e "  • Signaling: logs/signaling.log"
echo -e "  • Worker 1: logs/worker1.log"
echo -e "  • Client: logs/client.log"
echo -e "  • MinIO: logs/minio.log"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop all services${NC}"

# Wait for all background processes
wait
