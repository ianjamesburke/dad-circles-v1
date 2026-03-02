# Dad Circles

**🔗 Live Demo: [https://dadcircles.com/](https://dadcircles.com/)**

An AI-powered platform that connects new and expecting dads with local peer support groups through conversational onboarding and intelligent matching.

## 🎯 What is Dad Circles?

Dad Circles addresses the isolation many new fathers face by creating local peer support groups. The platform uses a conversational AI interface powered by Google Gemini to guide dads through onboarding, collecting information about their children, interests, and location in a natural, engaging way. Once onboarded, our matching algorithm connects dads with similar profiles in their area to form small, local support circles.

**Key Features:**
- 🤖 **Conversational Onboarding** - Natural language chat interface powered by Gemini 3.0 Flash
- 🎯 **Smart Matching** - Algorithm matches dads based on child age, location, and interests
- 📧 **Automated Engagement** - Email flows for abandoned sessions, group introductions, and follow-ups
- 👥 **Group Management** - Admin dashboard for reviewing and approving matched groups

## 🏗️ Architecture

Dad Circles uses a modern serverless architecture:

**Frontend:**
- React 19 + Vite for fast, responsive UI
- Tailwind CSS for styling
- Real-time Firestore integration

**Backend:**
- Firebase Cloud Functions for serverless compute
- Firestore for user profiles, messages, and group data
- Google Gemini 2.0 Flash for conversational AI (server-side only)
- Resend for transactional emails with template management
- Firebase Auth for admin authentication

**Key Design Decisions:**
- All LLM calls are server-side to protect API keys and enable rate limiting
- Onboarding state machine with validation to prevent prompt injection
- Server timestamps throughout for consistency and security
- Modular admin dashboard for scalable group management

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

- **`AGENTS.md`** - Comprehensive architecture, development workflow, and coding guidelines
- **`APP_SUMMARY.md`** - High-level product overview and feature documentation
- **`internal-docs/`** - Security audit reports and compliance documentation

## 🤝 Contributing

This project was built for a hackathon. For development guidelines, see `AGENTS.md`.

## 📄 License

MIT