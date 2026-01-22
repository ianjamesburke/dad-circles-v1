# Dad Circles Onboarding MVP (Phase 1)

A high-fidelity conversational onboarding experience built for new and expecting dads. This project uses the **Gemini 2.0 Flash** model to drive a human-like, state-aware onboarding flow.

## 🚀 Key Features
- **State-Driven Onboarding**: The agent strictly follows a sequence (Welcome -> Status -> Child Info -> Interests -> Location -> Confirmation).
- **Test Persona System**: Built-in switcher to test different user journeys (New Dad, Expecting Dad, and Completed profiles).
- **Admin Dashboard**: A real-time monitoring view where admins can see active sessions and manually inject messages into the conversation.
- **In-Memory Store**: A robust data structure that mimics a SQL database for easy migration later.

## 🛠️ Tech Stack
- **React 19** (via ESM)
- **Tailwind CSS** (Styling)
- **Google Gemini API** (LLM Logic)
- **React Router** (Navigation)

## 🔑 Environment Setup
To run this project locally outside of Google AI Studio:
1. Clone the repository.
2. Create a `.env` file in the root directory.
3. Add your Gemini API Key:
   ```env
   API_KEY=your_api_key_here
   ```
4. Serve the `index.html` using a local server (e.g., VS Code Live Server or Vite).

## 🧪 Testing the Flow
Use the **Test Persona** buttons at the top of the Chat interface to jump between different stages of the onboarding process to verify the LLM's state management logic.