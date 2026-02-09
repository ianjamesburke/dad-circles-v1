# Dad Circles

A conversational onboarding application that connects new and expecting dads with local peer groups through AI-powered matching.

## 🛠️ Tech Stack

**Frontend:**
- React 19 + Vite
- Tailwind CSS
- React Router

**Backend:**
- Firebase (Firestore, Cloud Functions, Auth, Hosting)
- Google Gemini API (via Cloud Functions)
- Resend (Email service)

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Firebase CLI: `npm install -g firebase-tools`

### Local Development Setup

1. **Clone and install dependencies:**
   ```bash
   git clone <repo-url>
   cd dad-circles-v1
   npm install
   cd functions && npm install && cd ..
   ```

2. **Set up environment variables:**
   ```bash
   ./scripts/setup-local-env.sh
   ```
   
   Then edit the created files:
   - `.env` - Add your Firebase config (get from Firebase Console)
   - `functions/.secret.local` - Add your API keys (Gemini, Resend)

3. **Start Firebase Emulators:**
   ```bash
   npm run emulator
   ```
   This starts Firestore, Functions, and Auth emulators and seeds the admin user.

4. **Start the dev server (in another terminal):**
   ```bash
   npm run dev
   ```

5. **Access the app:**
   - Frontend: http://localhost:5173
   - Admin Dashboard: http://localhost:5173/#/admin
   - Firebase Emulator UI: http://localhost:4000

### Default Admin Credentials (Emulator Only)
- Email: `admin@admin.com`
- Password: `password123`

## 📁 Project Structure

```
├── components/          # React components
│   ├── admin/          # Admin dashboard modules
│   └── chat/           # Chat interface components
├── functions/          # Firebase Cloud Functions
│   └── src/
│       ├── gemini/     # Gemini API integration
│       └── callable.ts # Backend callable functions
├── services/           # Client-side services
├── scripts/            # Utility scripts
└── utils/              # Shared utilities
```

## 🔐 Security

- API keys are managed via Firebase Secrets Manager (production)
- Local development uses `.env` and `functions/.secret.local` (gitignored)
- Gemini API calls are server-side only (never exposed to client)
- LLM responses are validated to prevent prompt injection

## 📚 Documentation

See `AGENTS.md` for detailed architecture, development workflow, and coding guidelines.