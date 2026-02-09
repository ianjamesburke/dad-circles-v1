#!/bin/bash

# Setup script for Gemini API secret (local development)
# This script helps configure the GEMINI_API_KEY for Firebase Emulators

set -e

echo "🔐 Gemini API Secret Setup"
echo "=========================="
echo ""

# Check if we're in the project root
if [ ! -f "package.json" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    exit 1
fi

# Check if functions directory exists
if [ ! -d "functions" ]; then
    echo "❌ Error: functions directory not found"
    exit 1
fi

# Check if .secret.local already exists
if [ -f "functions/.secret.local" ]; then
    echo "⚠️  Warning: functions/.secret.local already exists"
    read -p "Do you want to overwrite it? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Cancelled."
        exit 0
    fi
fi

# Prompt for API key
echo "Please enter your Gemini API key:"
echo "(Get one from: https://aistudio.google.com/app/apikey)"
echo ""
read -s -p "API Key: " API_KEY
echo ""

# Validate input
if [ -z "$API_KEY" ]; then
    echo "❌ Error: API key cannot be empty"
    exit 1
fi

# Create .secret.local file
echo "GEMINI_API_KEY=$API_KEY" > functions/.secret.local

echo ""
echo "✅ Success! Secret configured for local development"
echo ""
echo "Next steps:"
echo "1. Start the emulators: npm run dev:full"
echo "2. Test the chat interface"
echo ""
echo "For production deployment, run:"
echo "  firebase functions:secrets:set GEMINI_API_KEY"
echo ""
