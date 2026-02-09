# Weekend Mission: AI-Powered Local Activity Discovery

## Overview
The "Weekend Mission" is a feature that leverages Gemini 3's reasoning capabilities to automatically find, vet, and prescribe specific "Dad Activities" for Dad Circles groups based on their specific location and demographics.

Instead of a generic list, this feature acts as an "Intelligence Officer" for the group, providing a single, high-quality detailed recommendation for the upcoming weekend.

## Goals
1.  **Solve the analysis paralysis** problem for new dad groups ("What should we do?").
2.  **Demonstrate Gemini 3's capabilities** in reasoning, local search (grounding), and multimodal content generation.
3.  **Increase email engagement** by providing high-value, locally relevant content.

## User Flow
1.  **System Trigger**: A scheduled job runs (e.g., Thursday morning) or is triggered upon group formation.
2.  **AI Analysis**: The system analyzes the group's location (City, State) and the age range of the children (e.g., "mostly newborns", "toddlers").
3.  **Search & Reason**: Gemini searches for local events/places and filters them based on "Dad Criteria" (e.g., stroller access, shade, coffee nearby, parking availability).
4.  **Content Generation**: Gemini generates a "Mission Brief" — a punchy, fun summary of the activity.
5.  **Delivery**: The brief is inserted into the group email (Weekly Update or Welcome Email).

## Technical Architecture

### 1. New Cloud Function: `generateWeekendMission`
-   **Input**:
    -   `location`: { city: string, state: string }
    -   `avgChildAge`: number (months/years)
    -   `groupInterest`: string[] (optional, e.g., "hiking", "breweries")
-   **Gemini Implementation**:
    -   Use `google-genai` SDK.
    -   **Model**: Gemini 1.5 Pro (or Flash for speed).
    -   **Tools**: Google Search Grounding (if available/enabled) or internal knowledge base of activity types.
    -   **Prompt Engineering**:
        -   Role: "Elite Dad Ops Planner"
        -   Task: Find 1 specific activity for this weekend in [Location].
        -   Constraints: Must be suitable for [Age Group]. Must have [Amenities like parking/coffee].
        -   Tone: Encouraging, slightly tactical/fun.

### 2. Data Structure (The "Mission Brief")
```typescript
interface MissionBrief {
  title: string;        // e.g., "Operation: Zilker Park Train"
  location_name: string;
  address: string;
  best_time: string;    // e.g., "0900 hours (beat the heat)"
  dad_intel: string;    // Specific tips: "Park in the south lot for easier stroller access."
  weather_check: string;// specialized comment based on general climate
  activity_type: 'playground' | 'hike' | 'brewery' | 'museum';
}
```

### 3. Email Integration
-   **Template**: New component in `email-templates` or section in `weekly-update.html`.
-   **Visual**:
    -   (Phase 1) Dynamic map link and formatted text box.
    -   (Phase 2 - Multimodal) Generate a custom image using Imagen 3 representing the "Mission" (e.g., a stylized badge).

## Implementation Plan

### Step 1: Core Logic
-   Create `functions/src/gemini/missionAgent.ts`.
-   Implement `generateMission(city, state, demographics)` function.
-   Integrate simple search prompt logic (simulated or real grounding).

### Step 2: Cloud Function Trigger
-   Expose `getWeekendMission` as a callable function for testing.
-   Add `runWeeklyMissionGenerator` scheduled function (cron).

### Step 3: Frontend/Email
-   Design the "Mission Brief" UI in HTML for emails.
-   Test with sample locations (Austin, Brooklyn, Seattle).

## Future Multimodal Enhancements
-   **Voice Briefing**: Generate a 30s audio clip of the mission details using TTS.
-   **Visual Scouting**: Dads upload a photo of the location, Gemini confirms "Mission Accomplished" and updates the group's "Scrapbook".
