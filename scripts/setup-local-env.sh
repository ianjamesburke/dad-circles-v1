#!/bin/bash

# Setup script for local development environment
# Run this once after cloning the repo

set -e

echo "🔧 Setting up local development environment..."

# Check if .env exists
if [ -f .env ]; then
    echo "✅ .env already exists"
else
    echo "📝 Creating .env from .env.example..."
    cp .env.example .env
    echo "⚠️  Please edit .env and add your Firebase config"
fi

# Check if functions/.secret.local exists
if [ -f functions/.secret.local ]; then
    echo "✅ functions/.secret.local already exists"
else
    echo "📝 Creating functions/.secret.local..."
    cat > functions/.secret.local << 'EOF'
GEMINI_API_KEY=your_gemini_api_key_here
RESEND_API_KEY=your_resend_api_key_here
DEFAULT_FROM_EMAIL=circle@mail.dadcircles.com
SEND_REAL_EMAILS=false
EOF
    echo "⚠️  Please edit functions/.secret.local and add your API keys"
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env with your Firebase config"
echo "2. Edit functions/.secret.local with your API keys"
echo "3. Run 'npm install' to install dependencies"
echo "4. Run 'npm run emulator' to start Firebase emulators"
echo "5. Run 'npm run dev' in another terminal to start the dev server"
