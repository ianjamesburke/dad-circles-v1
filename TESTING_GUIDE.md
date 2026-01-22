# Task 01 - Testing Guide

## Quick Start
```bash
# Terminal 1
npm run emulator

# Terminal 2
npm run dev

# Browser: http://localhost:5173
```

## Test Scenarios

### Test 1: New User Flow

1. Enter new email (e.g., `test1@example.com`)
2. Enter postcode (e.g., `12345`)
3. Leave "I'm signing up for someone else" **UNCHECKED**
4. Click "Join Waitlist"

**Expected:** Redirects to `/chat?session={uuid}` and starts onboarding

---

### Test 2: Returning User

1. Enter the SAME email from Test 1
2. Click "Join Waitlist"

**Expected:** Redirects to chat with full message history and "Welcome back!" message

---

### Test 3: Signup for Others

1. Enter new email
2. **CHECK** "I'm signing up for someone else"
3. Click "Join Waitlist"

**Expected:** Stays on landing page with success message

---

### Test 4: Mobile

```bash
npm run dev -- --host
# Access from phone: http://<your-local-ip>:5173
```

**Check:**
- No horizontal scroll
- Input stays at bottom when keyboard opens
- Buttons are easily tappable
- Messages scroll smoothly

---

## Deployment

```bash
npm run build
npm run deploy
```
