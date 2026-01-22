#!/bin/bash

# Dad Circles Development Start Script for Mac
# This script starts Firebase emulators and the Vite dev server

set -e  # Exit on error
export FORCE_COLOR=1

echo "🚀 Starting Dad Circles Development Environment..."
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
    if [ ! -z "$EMULATOR_PID" ]; then
        echo "Stopping Firebase emulators..."
        kill $EMULATOR_PID 2>/dev/null || true
    fi
    
    if [ ! -z "$VITE_PID" ]; then
        echo "Stopping Vite dev server..."
        kill $VITE_PID 2>/dev/null || true
    fi

    if [ ! -z "$FUNCTIONS_BUILD_PID" ]; then
        echo "Stopping Functions watcher..."
        kill $FUNCTIONS_BUILD_PID 2>/dev/null || true
    fi
    
    # Kill any remaining Firebase emulator processes
    pkill -f "firebase emulators" 2>/dev/null || true
    pkill -f "java.*firestore" 2>/dev/null || true
    
    echo -e "${GREEN}✅ Cleanup complete${NC}"
    exit 0
}

# Trap SIGINT (Ctrl+C) and SIGTERM
trap cleanup SIGINT SIGTERM

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📦 Installing dependencies...${NC}"
    npm install
    echo ""
fi

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚠️  Warning: .env file not found${NC}"
    echo "Creating .env from .env.example..."
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo -e "${RED}⚠️  Please edit .env and add your API keys before continuing${NC}"
        exit 1
    else
        echo -e "${RED}❌ .env.example not found. Please create .env manually${NC}"
        exit 1
    fi
fi

# Clean up any existing emulator processes
echo -e "${YELLOW}🧹 Cleaning up existing processes...${NC}"
pkill -f "firebase emulators" 2>/dev/null || true
pkill -f "java.*firestore" 2>/dev/null || true
sleep 2

pkill -f "java.*firestore" 2>/dev/null || true
sleep 2

# Build functions first
echo -e "${YELLOW}🔨 Building Cloud Functions...${NC}"
(cd functions && npm install && npm run build)

# Start functions watcher in background
echo -e "${YELLOW}👀 Starting Cloud Functions watcher...${NC}"
(cd functions && npm run build:watch) > functions-build.log 2>&1 &
FUNCTIONS_BUILD_PID=$!

# Start Firebase emulators (Firestore + Functions + Auth) in background
echo -e "${GREEN}🔥 Starting Firebase emulators (Firestore + Functions + Auth)...${NC}"
firebase emulators:start --only firestore,functions,auth > firebase-emulator.log 2>&1 &
EMULATOR_PID=$!

# Wait for emulators to be ready
echo "Waiting for emulators to start..."
sleep 5

# Check if emulator is running
if ! ps -p $EMULATOR_PID > /dev/null; then
    echo -e "${RED}❌ Firebase emulator failed to start. Check firebase-emulator.log${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Firebase emulators running (PID: $EMULATOR_PID)${NC}"
echo "   Firestore UI: http://127.0.0.1:4004/firestore"
echo "   Emulator Hub: http://127.0.0.1:4004/"
echo ""

# Seed admin user (script has built-in retry logic)
echo -e "${YELLOW}🔐 Seeding admin user...${NC}"
node scripts/seedAdminUser.js
echo ""

# Start Vite dev server in background
echo -e "${GREEN}⚡ Starting Vite dev server...${NC}"
npm run dev > vite-dev.log 2>&1 &
VITE_PID=$!

# Wait for Vite to be ready
echo "Waiting for Vite to start..."
sleep 3

# Check if Vite is running
if ! ps -p $VITE_PID > /dev/null; then
    echo -e "${RED}❌ Vite dev server failed to start. Check vite-dev.log${NC}"
    cleanup
    exit 1
fi

echo -e "${GREEN}✅ Vite dev server running (PID: $VITE_PID)${NC}"
echo "   App URL: http://localhost:3000/"
echo ""

echo -e "${GREEN}🎉 Development environment is ready!${NC}"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop all services${NC}"
echo ""
echo "📝 Streaming logs (Ctrl+C to stop)..."
echo ""

# Tail logs in the foreground, starting from the beginning of the files
tail -f -n +1 firebase-emulator.log vite-dev.log
