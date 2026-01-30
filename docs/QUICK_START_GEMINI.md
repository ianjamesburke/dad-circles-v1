# Quick Start: Gemini API Setup

## 🚀 Get Started in 2 Minutes

### Local Development

```bash
# 1. Run the setup script
./scripts/setup-gemini-secret.sh

# 2. Start development
npm run dev:full

# 3. Test the chat interface
# Open http://localhost:5173
```

That's it! The chat should work exactly as before.

## 🔐 What Changed?

The Gemini API key is now **secure**:
- ❌ Before: Exposed in browser (anyone could steal it)
- ✅ Now: Hidden in Cloud Functions (only server can access)

## 📁 File Structure

```
functions/
  src/
    gemini.ts              ← Backend (secure)
  .secret.local            ← Your API key (gitignored)

services/
  callableGeminiService.ts ← Client (calls backend)
  geminiService.ts         ← OLD (deprecated, don't use)
```

## 🛠️ Manual Setup (Alternative)

If the script doesn't work:

```bash
# Create the secret file
echo "GEMINI_API_KEY=your_actual_key_here" > functions/.secret.local

# Restart emulators
npm run dev:full
```

## 🚢 Production Deployment

```bash
# 1. Install dependencies (if not already done)
cd functions && npm install && cd ..

# 2. Set the secret (one-time)
firebase functions:secrets:set GEMINI_API_KEY
# Paste your key when prompted

# 3. Deploy
npm run deploy

# 4. Verify
# Test the chat on your production site
```

## ❓ Troubleshooting

### "GEMINI_API_KEY not configured"

**Local**: Create `functions/.secret.local` with your key  
**Production**: Run `firebase functions:secrets:set GEMINI_API_KEY`

### Chat not responding

1. Check browser console for errors
2. Check Cloud Functions logs: `firebase functions:log`
3. Verify emulators are running: `npm run dev:full`

### Where do I get an API key?

Get a free Gemini API key: https://aistudio.google.com/app/apikey

## 📚 More Info

- **Full Documentation**: `docs/GEMINI_API_SECURITY.md`
- **Summary**: `SECURITY_GEMINI_FIX.md`
- **Architecture**: `AGENTS.md` (Recent Architecture Changes section)

## ✅ Verification

Your setup is correct if:
- ✅ Chat responds to messages
- ✅ No errors in browser console
- ✅ Cloud Functions logs show `getGeminiResponse` calls
- ✅ No `VITE_GEMINI_API_KEY` in your `.env` file
