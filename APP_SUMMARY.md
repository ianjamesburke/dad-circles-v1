# Dad Circles App Summary

## 1. Overview
Dad Circles is a **conversational onboarding application** designed to connect new and expecting dads with local peer groups. It uses **Google Gemini** to guide users through a natural chat interface, collecting their profile information to facilitate AI-driven matching.

## 2. Core Features

### 🗣️ Conversational Onboarding (The "Dad Bot")
*   **AI-Driven Chat**: Uses Google Gemini 2.0 Flash to act as a friendly "Dad Ops" assistant.
*   **State Machine Logic**: Strictly follows a defined sequence (Name -> Status -> Kids -> Interests -> Location) to ensure complete data collection.
*   **Context Management**: intelligently manages the context window to keep costs low and performance high.
*   **Security**: Server-side validation prevents prompt injection and ensures data integrity before updating user profiles.

### 📍 Intelligent Matching
*   **Location-Based Grouping**: Matches dads based on their specific city and state.
*   **Life Stage Alignment**: Groups dads with children of similar ages impact (Expecting, Newborn, Infant, Toddler).
*   **Group Formation**: Automatically suggests groups of 4-6 dads when a critical mass is reached in a location.

### 📧 Automated Communications
*   **Tech Stack**: Powered by **Resend** and Firebase Cloud Functions.
*   **Flows**:
    *   **Welcome Emails**: Immediate confirmation upon signup.
    *   **Abandonment Recovery**: Detects when a user drops off mid-chat and sends a "magic link" to resume the session.
    *   **Group Introductions**: Automatically introduces matched dads to each other via email.

### 🛠️ Admin Dashboard
*   **Comprehensive Monitoring**: View real-time stats on leads, active users, and groups.
*   **Manual Override**: Admins can manually trigger matching algorithms, approve groups, or step into a chat session.
*   **Metrics**: Tracks conversion rates and geographic distribution.

## 3. Technology Stack

### Frontend
*   **Framework**: React 19 (via Vite)
*   **Styling**: Tailwind CSS
*   **Routing**: React Router (HashRouter)

### Backend (Serverless)
*   **Platform**: Firebase
*   **Database**: Cloud Firestore (NoSQL)
*   **Compute**: Cloud Functions (Typescript)
*   **AI**: Google Gemini API (via Vertex AI or Google AI Studio)

### Development Tools
*   **Local Emulation**: Full Firebase Emulator Suite for offline development.
*   **Task Management**: `just` command runner for standardized workflows.

## 4. Current Status
The application is in **Phase 1 (MVP)**. The core onboarding and matching infrastructure is built and tested. The focus is now shifting to **Phase 2**, which involves enriching the post-match experience with high-value AI-generated content (like the "Weekend Mission" feature).
