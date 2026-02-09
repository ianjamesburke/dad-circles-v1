#!/bin/bash
# Fix Firebase Auth custom token permissions
# This script grants the necessary IAM permission for creating custom tokens

set -e

echo "🔧 Fixing Firebase Auth Permissions"
echo ""

# Get the project ID from .firebaserc
if [ -f .firebaserc ]; then
  PROJECT_ID=$(grep -o '"default"[[:space:]]*:[[:space:]]*"[^"]*"' .firebaserc | cut -d'"' -f4)
fi

# Fallback to firebase CLI
if [ -z "$PROJECT_ID" ]; then
  PROJECT_ID=$(firebase use 2>/dev/null | grep -o "Now using.*" | awk '{print $NF}' | tr -d '()')
fi

if [ -z "$PROJECT_ID" ]; then
  echo "❌ Could not determine Firebase project ID"
  echo "Please run: firebase use <project-id>"
  exit 1
fi

echo "📋 Project ID: $PROJECT_ID"
echo ""

# Get the default service account email
SERVICE_ACCOUNT="${PROJECT_ID}@appspot.gserviceaccount.com"

echo "🔑 Service Account: $SERVICE_ACCOUNT"
echo ""

# Grant the required IAM role
echo "⚙️  Granting iam.serviceAccountTokenCreator role..."
echo ""

gcloud iam service-accounts add-iam-policy-binding \
  "$SERVICE_ACCOUNT" \
  --member="serviceAccount:$SERVICE_ACCOUNT" \
  --role="roles/iam.serviceAccountTokenCreator" \
  --project="$PROJECT_ID"

echo ""
echo "✅ Permission granted successfully!"
echo ""
echo "📝 What this does:"
echo "   - Allows the service account to sign tokens (create custom auth tokens)"
echo "   - Required for magic links and session authentication"
echo "   - This is a standard Firebase Admin SDK requirement"
echo ""
echo "🚀 You can now redeploy your functions:"
echo "   firebase deploy --only functions"
echo ""
