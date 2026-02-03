#!/bin/bash

# Dad Circles Development Start Script for Mac
# Starts Firebase emulators and Functions build watcher (no seeding, no Vite)

set -e  # Exit on error
export FORCE_COLOR=1

echo "🚀 Starting Dad Circles Emulators..."
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Set Java 21 path if installed via Homebrew
if [ -d "$(brew --prefix)/opt/openjdk@21" ]; then
    export PATH="$(brew --prefix)/opt/openjdk@21/bin:$PATH"
    export JAVA_HOME="$(brew --prefix)/opt/openjdk@21"
fi

# Function to cleanup on exit
cleanup() {
    echo ""
    echo -e "${YELLOW}🧹 Cleaning up...${NC}"

    # Kill background processes
    if [ ! -z "$FUNCTIONS_BUILD_PID" ]; then
        echo "Stopping Functions watcher..."
        kill $FUNCTIONS_BUILD_PID 2>/dev/null || true
    fi

    echo -e "${GREEN}✅ Cleanup complete${NC}"
    exit 0
}

# Trap SIGINT (Ctrl+C), SIGTERM, and EXIT
trap cleanup SIGINT SIGTERM EXIT

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📦 Installing dependencies...${NC}"
    npm install
    echo ""
fi

# Ensure functions dependencies exist
if [ ! -d "functions/node_modules" ]; then
    echo -e "${YELLOW}📦 Installing Functions dependencies...${NC}"
    (cd functions && npm install)
    echo ""
fi

# Free ports commonly used by Firebase emulators
free_port() {
    local port="$1"
    local pids
    pids=$(lsof -ti tcp:"$port" 2>/dev/null || true)
    if [ -n "$pids" ]; then
        echo -e "${YELLOW}🧹 Freeing port ${port} (PIDs: ${pids})...${NC}"
        kill $pids 2>/dev/null || true
        sleep 1
    fi
}

free_port 4004   # Emulator UI
free_port 9099   # Auth
free_port 8083   # Firestore
free_port 4400   # Emulator Hub
free_port 4500   # Logging

# Build functions first
echo -e "${YELLOW}🔨 Building Cloud Functions...${NC}"
(cd functions && npm run build)

# Start functions watcher in background
echo -e "${YELLOW}👀 Starting Cloud Functions watcher...${NC}"
(cd functions && npm run build:watch) > functions-build.log 2>&1 &
FUNCTIONS_BUILD_PID=$!

# Start Firebase emulators (Firestore + Functions + Auth) in the foreground
echo -e "${GREEN}🔥 Starting Firebase emulators (Firestore + Functions + Auth)...${NC}"
echo -e "${YELLOW}Press Ctrl+C to stop emulators and the Functions watcher${NC}"
firebase emulators:start --only firestore,functions,auth
