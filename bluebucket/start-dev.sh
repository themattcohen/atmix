#!/bin/bash
# ============================================
# Blue Bucket Development Server Startup Script
# ============================================

set -e

echo ""
echo "========================================"
echo "  Blue Bucket Dev Server Startup"
echo "========================================"
echo ""

# Get the directory where the script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$SCRIPT_DIR/server"

# Navigate to server directory
if [ ! -d "$SERVER_DIR" ]; then
    echo "[ERROR] Server directory not found: $SERVER_DIR"
    exit 1
fi

cd "$SERVER_DIR"
echo "[INFO] Working directory: $(pwd)"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "[ERROR] Node.js is not installed or not in PATH"
    echo "        Please install Node.js from https://nodejs.org/"
    exit 1
fi

echo "[INFO] Node.js version: $(node --version)"
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "[INFO] node_modules not found. Running npm install..."
    echo ""
    npm install
    echo ""
    echo "[SUCCESS] Dependencies installed successfully"
    echo ""
fi

# Check environment variables
if [ -f "scripts/check-env.js" ]; then
    echo "[INFO] Checking environment configuration..."
    if ! node scripts/check-env.js; then
        echo ""
        echo "[WARNING] Environment check failed. Server may not work correctly."
        echo "         Please check your .env file configuration."
        echo ""
        read -p "Continue anyway? (y/n) " -n 1 -r
        echo ""
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
    echo ""
fi

# Start the development server
echo "[INFO] Starting development server..."
echo "[INFO] Press Ctrl+C to stop the server"
echo ""
echo "----------------------------------------"
echo ""

npm run dev
