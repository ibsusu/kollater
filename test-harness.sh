#!/bin/bash

# Kollator Upload Test Harness
# This script sets up and runs comprehensive tests for the upload functionality

set -e

echo "🚀 Kollator Upload Test Harness"
echo "================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if required commands exist
check_dependencies() {
    print_status "Checking dependencies..."
    
    if ! command -v bun &> /dev/null; then
        print_error "Bun is not installed"
        exit 1
    fi
    
    print_success "Dependencies check passed"
}

# Install test dependencies
install_test_deps() {
    print_status "Installing test dependencies..."
    cd tests
    bun install
    print_success "Test dependencies installed"
    cd ..
}

# Start the servers
start_servers() {
    print_status "Starting servers..."
    
    # Start signaling server
    print_status "Starting signaling server..."
    cd server/signaling
    bun install > /dev/null 2>&1 || true
    bun run index.ts &
    SIGNALING_PID=$!
    cd ../..
    
    # Start worker server
    print_status "Starting worker server..."
    cd server/worker
    bun install > /dev/null 2>&1 || true
    bun run index.ts &
    WORKER_PID=$!
    cd ../..
    
    # Start client dev server
    print_status "Starting client dev server..."
    cd client
    bun install > /dev/null 2>&1 || true
    bun run dev &
    CLIENT_PID=$!
    cd ..
    
    # Wait for servers to start
    print_status "Waiting for servers to start..."
    sleep 10
    
    print_success "All servers started"
    echo "Signaling PID: $SIGNALING_PID"
    echo "Worker PID: $WORKER_PID"
    echo "Client PID: $CLIENT_PID"
}

# Stop all servers
cleanup() {
    print_status "Cleaning up servers..."
    
    if [ ! -z "$CLIENT_PID" ]; then
        kill $CLIENT_PID 2>/dev/null || true
    fi
    
    if [ ! -z "$WORKER_PID" ]; then
        kill $WORKER_PID 2>/dev/null || true
    fi
    
    if [ ! -z "$SIGNALING_PID" ]; then
        kill $SIGNALING_PID 2>/dev/null || true
    fi
    
    # Kill any remaining processes
    pkill -f "vite" 2>/dev/null || true
    pkill -f "tsx" 2>/dev/null || true
    
    print_success "Cleanup completed"
}

# Set up trap to cleanup on exit
trap cleanup EXIT

# Run the tests
run_tests() {
    print_status "Running upload functionality tests..."
    
    cd tests
    
    # Run tests with different options based on arguments
    if [ "$1" = "--headed" ]; then
        print_status "Running tests in headed mode..."
        bun run test:headed
    elif [ "$1" = "--debug" ]; then
        print_status "Running tests in debug mode..."
        bun run test:debug
    elif [ "$1" = "--ui" ]; then
        print_status "Running tests with UI..."
        bun run test:ui
    else
        print_status "Running tests in headless mode..."
        bun run test
    fi
    
    cd ..
}

# Manual testing mode
manual_test() {
    print_status "Starting manual testing mode..."
    print_status "Servers are running. You can now:"
    echo "  - Open http://localhost:5173 in your browser"
    echo "  - Test file uploads using the dropzone"
    echo "  - Use the file explorer to view uploaded files"
    echo "  - Test different file types from the test_files directory"
    echo ""
    print_warning "Press Ctrl+C to stop all servers and exit"
    
    # Keep the script running
    while true; do
        sleep 1
    done
}

# Health check
health_check() {
    print_status "Performing health check..."
    
    # Check if client is responding (try both HTTP and HTTPS)
    if curl -s http://localhost:5173 > /dev/null 2>&1 || curl -s -k https://localhost:5173 > /dev/null 2>&1; then
        print_success "Client server is responding"
    else
        print_error "Client server is not responding"
        return 1
    fi
    
    # Add more health checks as needed
    print_success "Health check passed"
}

# Main execution
main() {
    case "$1" in
        "install")
            check_dependencies
            install_test_deps
            print_success "Installation completed"
            ;;
        "test")
            check_dependencies
            install_test_deps
            start_servers
            health_check
            run_tests "$2"
            ;;
        "manual")
            check_dependencies
            start_servers
            health_check
            manual_test
            ;;
        "clean")
            cleanup
            ;;
        *)
            echo "Usage: $0 {install|test|manual|clean} [--headed|--debug|--ui]"
            echo ""
            echo "Commands:"
            echo "  install  - Install test dependencies"
            echo "  test     - Run automated tests"
            echo "  manual   - Start servers for manual testing"
            echo "  clean    - Clean up running processes"
            echo ""
            echo "Test options:"
            echo "  --headed - Run tests with browser visible"
            echo "  --debug  - Run tests in debug mode"
            echo "  --ui     - Run tests with Playwright UI"
            exit 1
            ;;
    esac
}

main "$@"
