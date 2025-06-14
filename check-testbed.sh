#!/bin/bash

# Kollator Testbed Status Check Script

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔍 Kollator Testbed Status Check${NC}"
echo ""

# Check if kollator.local is in hosts file
echo -e "${BLUE}📋 DNS Configuration:${NC}"
if grep -q "kollator.local" /etc/hosts; then
    echo -e "  ✅ kollator.local found in /etc/hosts"
else
    echo -e "  ❌ kollator.local NOT found in /etc/hosts"
    echo -e "     Run: echo '127.0.0.1 kollator.local' | sudo tee -a /etc/hosts"
fi
echo ""

# Check certificates
echo -e "${BLUE}🔐 Certificate Status:${NC}"
if [ -f "certs/kollator.local+4.pem" ] && [ -f "certs/kollator.local+4-key.pem" ]; then
    echo -e "  ✅ mkcert SSL certificates found"
    # Check certificate validity
    if openssl x509 -in certs/kollator.local+4.pem -noout -checkend 86400 > /dev/null 2>&1; then
        echo -e "  ✅ Certificate is valid"
    else
        echo -e "  ⚠️  Certificate may be expired or invalid"
    fi
else
    echo -e "  ❌ mkcert SSL certificates missing"
    echo -e "     Run: cd certs && mkcert kollator.local '*.kollator.local' localhost 127.0.0.1 ::1"
fi
echo ""

# Check ports
echo -e "${BLUE}🌐 Port Status:${NC}"
if lsof -i :8000 > /dev/null 2>&1; then
    echo -e "  ✅ Port 8000 (Signaling) is in use"
else
    echo -e "  ❌ Port 8000 (Signaling) is free"
fi

if lsof -i :5173 > /dev/null 2>&1; then
    echo -e "  ✅ Port 5173 (Client) is in use"
else
    echo -e "  ❌ Port 5173 (Client) is free"
fi
echo ""

# Check log files
echo -e "${BLUE}📝 Recent Log Activity:${NC}"
if [ -d "logs" ]; then
    for log in logs/*.log; do
        if [ -f "$log" ]; then
            filename=$(basename "$log")
            size=$(wc -l < "$log" 2>/dev/null || echo "0")
            echo -e "  📄 $filename: $size lines"
            
            # Show last few lines if there are errors
            if grep -q -i "error\|failed\|exception" "$log" 2>/dev/null; then
                echo -e "    ⚠️  Recent errors found:"
                tail -3 "$log" | sed 's/^/      /'
            fi
        fi
    done
else
    echo -e "  ❌ No logs directory found"
fi
echo ""

# Test connectivity
echo -e "${BLUE}🔗 Connectivity Test:${NC}"
if curl -k -s --connect-timeout 5 https://kollator.local:8000/join > /dev/null 2>&1; then
    echo -e "  ✅ Signaling server is responding"
else
    echo -e "  ❌ Cannot connect to signaling server"
fi

if curl -k -s --connect-timeout 5 https://kollator.local:5173 > /dev/null 2>&1; then
    echo -e "  ✅ Client dev server is responding"
else
    echo -e "  ❌ Cannot connect to client dev server"
fi
echo ""

echo -e "${BLUE}💡 Quick Commands:${NC}"
echo -e "  Start testbed: ./start-testbed.sh"
echo -e "  View signaling logs: tail -f logs/signaling.log"
echo -e "  View worker logs: tail -f logs/worker1.log"
echo -e "  View client logs: tail -f logs/client.log"
echo -e "  Stop all: pkill -f 'bun run index.ts' && pkill -f 'npm run dev'"
