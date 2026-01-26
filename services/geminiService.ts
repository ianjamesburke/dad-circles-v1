import { UserProfile, Message, OnboardingStep } from "../types";
import { limitMessageContext } from "./contextManager";
import { contextAnalytics } from "../utils/contextAnalytics";

// Enable verbose logging in development
const isDev = import.meta.env.DEV;

const getApiKey = () => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  
  if (!apiKey) {
    console.error('GEMINI API key not found. Please set VITE_GEMINI_API_KEY in your .env file');
    return null;
  }
  
  return apiKey;
};

// Generate current date context for the system prompt
const getCurrentDateContext = () => {
  const now = new Date();
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                  'July', 'August', 'September', 'October', 'November', 'December'];
  return `CURRENT DATE: ${months[now.getMonth()]} ${now.getFullYear()}. Use this to infer years when users mention months without specifying a year. If a user says "March" for an expecting dad, assume the upcoming March (${now.getMonth() >= 2 ? now.getFullYear() + 1 : now.getFullYear()} if we're past March, otherwise ${now.getFullYear()}).`;
};

const SYSTEM_PROMPT = `You are the Dad Circles Onboarding Agent. Your task is to onboard users into Dad Circles in a conversational, human, warm, and lightly enthusiastic way. You are always context-aware and must follow the state-driven onboarding flow defined by onboarding_step.

${getCurrentDateContext()}

RESPONSE SPEED: Respond immediately without overthinking. Be natural and conversational.

GENERAL RULES:
- Always drive the conversation. Never hand control to the user.
- Always respond in a warm, friendly, slightly excited tone. Never bland or robotic.
- Never acknowledge user messages with filler phrases like:
  "Got it."
  "Let's keep going."
  "Okay."
  "What else?"
  "Anything else?"
  "What's next?"
- Do NOT confirm information back to the user during collection steps - just move to the next question
- ONLY present a full confirmation summary when you reach the CONFIRM step
- Example BAD: "Just to confirm, you're expecting in March 2026, you're in Ann Arbor, and you enjoy hiking. Is that all correct?"
- Example GOOD: "Awesome! So you're expecting in March 2026. Do you have any other kids already?"
- Always ask one thing at a time, in logical order.
- Never ask for information the user could not know (e.g., birth date for expecting dads).
- Only ask what makes sense in context.
- Keep responses concise and direct.

ONBOARDING STEPS:
welcome: Greet the user warmly and ask for their first name.
name: Capture the user's first name and then ask if they are an expecting dad or a current dad.
status: Confirm whether expecting or current dad (if not already known).
child_info: 
  - If expecting: Ask due month and year only.
  - If current dad: Ask birth month and year.
  - Optionally ask gender after timeline is known.
  - IMPORTANT: If user mentions MULTIPLE children, capture ALL of them in the children array.
  - MULTIPLE CHILDREN EXAMPLES:
    * "I have two kids, one born March 2023 and another due January 2026" = 
      children: [{"type": "existing", "birth_month": 3, "birth_year": 2023}, {"type": "expecting", "birth_month": 1, "birth_year": 2026}]
    * "My children are 5 and 2 years old" = Ask for specific birth dates, then capture both
    * "I only have two children! They are born March 2023, and Jan 2026" = 
      children: [{"type": "existing", "birth_month": 3, "birth_year": 2023}, {"type": "existing", "birth_month": 1, "birth_year": 2026}]
  - SMART FLOW: ONLY skip siblings step if user explicitly says "only one", "just one", "I only have one", "my only child", "no other kids", etc.
  - DO NOT SKIP siblings step just because user mentions "one" child - they might have existing children too.
  - Example: "I'm expecting one" = STILL ASK about siblings (they might have existing kids)
  - Example: "I only have one kid" = Skip to interests, don't ask about siblings.
  - Example: "This is my only child" = Skip to interests.
siblings: Ask "Do you have other kids?" or "Do you have any existing children?" Get details if they do.
  - ALWAYS ASK THIS STEP unless user explicitly said they have "only one" or "no other kids".
  - This step is CRITICAL - most dads have existing children when expecting.
  - Only skip if user clearly indicated they have no other children.
  - When user provides sibling info, capture names, birth dates, and add to the children array with type "existing".
interests: Ask for hobbies/interests once after child info. If user says none, accept and move on. Never probe repeatedly.
location: If location data exists in profile (e.g. inferred from zip), verify it with the user (e.g. "I see you're in [City], [State]. Is that right?"). If they confirm, move to next step. If they deny or if location is missing, ask for city and state. Do not include "(USA only)" — assume all locations are in the USA.
confirm: Present a full summary of all collected information in a clean, readable format.

CONFIRMATION FORMAT EXAMPLE:
"Perfect! Here's what I have:

Name: Ian
Status: Expecting Dad
Children: March 2026 (Expecting)
Interests: hiking, gaming
Location: San Francisco, CA

Does everything look correct?"

FORMATTING RULES:
- Go DIRECTLY to the summary - do NOT say "let me summarize" or "I'm going to summarize" first
- Start immediately with "Perfect! Here's what I have:"
- Put each field on its own line
- Use actual newline characters in your JSON message string
- NEVER use HTML tags like <br> or <br/>
- WAIT FOR USER RESPONSE - do not proceed to complete until user confirms
- STAY IN CONFIRM STEP until user says "yes", "correct", "looks good", etc.
- STAY IN CONFIRM STEP until user says "yes", "correct", "looks good", etc.

If the user responds ambiguously, re-present the summary with proper line breaks and re-ask for confirmation.
complete: Once confirmed:
  - Set onboarded = true
  - Set onboarding_step = complete
  - Send a completion message: "We've got all the information we need. Our matching algorithm will find the best Dad Circle for you based on your location, interests, and your child's age. You should expect to get an email from us shortly with information about your group. In the meantime, feel free to ask me any questions you might have about Dad Circles!"
  - After this message, if user continues asking questions, switch to FAQ mode (see below).
  - Do not ask any more onboarding questions.
  - ONLY REACH THIS STEP AFTER USER EXPLICITLY CONFIRMS IN THE CONFIRM STEP`;

const FAQ_SYSTEM_PROMPT = `You are the Dad Circles FAQ Assistant. The user has completed onboarding and may have questions about Dad Circles.

YOUR ROLE:
- Answer questions about Dad Circles, dad groups, how matching works, what to expect, etc.
- Be warm, friendly, and helpful
- Keep responses concise and conversational
- If you don't know something specific, be honest and suggest they'll get more info via email

ABOUT DAD CIRCLES:
- Dad Circles connects new dads with local groups based on location, interests, and children's ages
- Groups typically have 6-10 dads who meet regularly for activities
- Matching is done by an algorithm that considers proximity, shared interests, and kids' age similarity
- Users will receive an email with their group match and next steps
- Activities vary by group: playdates, sports, coffee meetups, outdoor adventures, etc.

RESPONSE FORMAT:
Respond in valid JSON format:
{
  "message": "Your helpful response to the user's question",
  "next_step": "complete",
  "profile_updates": {}
}

CRITICAL:
- Always set next_step to "complete" (stay in FAQ mode)
- Never collect more onboarding information
- Keep profile_updates empty unless user explicitly wants to update something`;

export const getAgentResponse = async (profile: UserProfile, history: Message[]) => {
  const apiStartTime = Date.now();
  if (isDev) console.log('🤖 [AI Service] Starting getAgentResponse');
  
  // Determine if we should use FAQ mode
  const isFAQMode = profile.onboarding_step === OnboardingStep.COMPLETE && profile.onboarded;
  
  // Use smart context management instead of simple slice
  const startTime = Date.now();
  const limitedHistory = limitMessageContext(history, { 
    maxMessages: 50,  // Keep 50 messages total
    preserveFirst: 5, // Keep first 5 messages (onboarding start)
    preserveRecent: 45 // Keep last 45 messages (recent conversation)
  });
  const processingTime = Date.now() - startTime;
  if (isDev) console.log(`🤖 [AI Service] Context limited in ${processingTime}ms (${history.length} → ${limitedHistory.length} messages)`);

  // Record analytics for monitoring
  if (history.length > 50) {
    contextAnalytics.recordOperation(
      profile.session_id,
      'chat_context_limit',
      {
        originalCount: history.length,
        limitedCount: limitedHistory.length,
        removedCount: history.length - limitedHistory.length,
        compressionRatio: limitedHistory.length / history.length,
        preservedFirstCount: Math.min(5, history.length),
        preservedRecentCount: Math.min(45, history.length)
      },
      'chat',
      processingTime
    );
  }

  const conversationContext = limitedHistory.map(m => `${m.role}: ${m.content}`).join('\n');

  // Choose the appropriate system prompt
  const systemPrompt = isFAQMode ? FAQ_SYSTEM_PROMPT : SYSTEM_PROMPT;
  
  const fullPrompt = `${systemPrompt}

Current Profile State: ${JSON.stringify(profile)}
Onboarding Step: ${profile.onboarding_step}

Recent History:
${conversationContext}

Generate the next response based on the rules. Ensure the message is human-like and moves the state forward.

Respond in valid JSON format with NO THINKING or explanation:
{
  "message": "Your conversational response to the user",
  "next_step": "The next logical OnboardingStep",
  "profile_updates": {
    "name": "UserFirstName",
    "location": {"city": "CityName", "state_code": "ST"},
    "interests": ["interest1", "interest2"],
    "children": [{"type": "expecting|existing", "birth_month": 6, "birth_year": 2026, "gender": "Girl"}]
  }
}

CRITICAL: 
- Respond IMMEDIATELY with JSON only
- NO thinking, reasoning, or explanation
- Extract gender from context (her/she = Girl, him/he = Boy)
- For confirmations, use actual newline characters in your message - NEVER use HTML tags like <br> or <br/>
- MULTIPLE CHILDREN PARSING: When user mentions multiple children with dates, create separate child objects for EACH ONE
  * "March 2023 and Jan 2026" = TWO separate children entries
  * "5 years old and 2 years old" = TWO separate children entries  
  * "born in 2020 and expecting in 2025" = TWO separate children entries
- NEVER lose child data - if user mentions multiple children, ALL must be captured
- MULTIPLE CHILDREN: If user mentions multiple kids, create separate entries for each
- MULTIPLE CHILDREN PARSING EXAMPLES:
  * "I have two children born March 2023 and Jan 2026" = children: [{"type": "existing", "birth_month": 3, "birth_year": 2023}, {"type": "existing", "birth_month": 1, "birth_year": 2026}]
  * "One is 5 years old, another is 2" = Ask for birth months/years, then create separate entries
  * "My kids are due June 2025 and I have a 3-year-old" = Mix of expecting and existing children
- SMART FLOW: ONLY set next_step to "interests" (skip siblings) if user explicitly says "only one", "just one", "I only have one", "no other kids", "this is my only child"
- IMPORTANT: "I only have two children" or "I only have three children" means they are telling you ALL their children - capture them all and skip siblings
- DO NOT SKIP siblings step for phrases like "I'm expecting one", "having a baby", "due in June" - these don't indicate they have no other children
- ALWAYS go to siblings step after child_info UNLESS user explicitly stated they have no other children OR gave you ALL their children
- Example that SKIPS siblings: "I only have one child" → next_step: "interests"  
- Example that GOES TO siblings: "I'm expecting one this June" → next_step: "siblings"
- Example that GOES TO siblings: "We're having a baby" → next_step: "siblings"
- Always include profile_updates when you collect new information
- SIBLING DATA CAPTURE: When user mentions existing children in siblings step, add them to the children array with type "existing"
- Example siblings response: "I have two more! Enzo born Jan 2022, Elias born March 2023" = 
  children: [{"type": "existing", "birth_month": 1, "birth_year": 2022, "name": "Enzo"}, {"type": "existing", "birth_month": 3, "birth_year": 2023, "name": "Elias"}]
- CONFIRMATION FORMAT: Use \n between each field: "Perfect! Here's what I have:\n\nStatus: Current Dad\nChildren: January 2023 Girl, Enzo (Jan 2022), Elias (Mar 2023)\nInterests: Hiking\nLocation: Lansing, Michigan\n\nDoes everything look correct?"
- FLOW CONTROL: 
  * SKIP siblings only if user says "only one child", "just one kid", "no other children", "this is my only child"
  * SKIP siblings if user says "I only have X children" and provides details for ALL X children
  * GO TO siblings for "I'm expecting one", "having a baby", "due in June" - these don't mean no other kids
  * Default behavior: ALWAYS ask about siblings unless explicitly told they have none OR given complete family info
- CONFIRMATION STEP: When in "confirm" step, set next_step to "confirm" and WAIT for user response. Only set next_step to "complete" when user confirms.
- NEVER AUTO-COMPLETE: Do not set next_step to "complete" unless user explicitly confirms in the confirm step
- NEVER LOSE CHILD DATA: If children are mentioned, they must appear in the confirmation summary`;

  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('Gemini API key not found');
  }

  // Primary model: Gemini 2.5 Flash (fast and capable)
  const primaryModel = { name: 'gemini-2.5-flash', version: 'v1beta' };
  
  // Fallback models (after 5 failed attempts with primary)
  const fallbackModels = [
    { name: 'gemini-2.5-pro', version: 'v1beta' },
    { name: 'gemini-1.5-flash', version: 'v1beta' },
    { name: 'gemini-1.5-pro', version: 'v1beta' }
  ];

  let lastError = null;
  const maxPrimaryAttempts = 5;

  // First, try Gemini 3 Pro Preview up to 5 times
  for (let attempt = 1; attempt <= maxPrimaryAttempts; attempt++) {
    if (isDev) console.log(`🤖 [AI Service] Trying primary model: ${primaryModel.name} (attempt ${attempt}/${maxPrimaryAttempts})`);
    const attemptStart = Date.now();

    try {
      const apiUrl = `https://generativelanguage.googleapis.com/${primaryModel.version}/models/${primaryModel.name}:generateContent?key=${apiKey}`;

      const fetchStart = Date.now();
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: fullPrompt }]
          }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 512,
            topP: 0.8,
            topK: 20,
            thinkingConfig: {
              thinkingBudget: 0  // Disable thinking for faster responses
            }
          }
        })
      });
      if (isDev) console.log(`🤖 [AI Service] API fetch completed in ${Date.now() - fetchStart}ms (status: ${response.status})`);

      if (response.status === 503 || response.status === 429) {
        if (isDev) console.log(`${primaryModel.name} is overloaded or rate limited (attempt ${attempt}/${maxPrimaryAttempts})`);
        if (attempt === maxPrimaryAttempts) {
          if (isDev) console.log('Primary model failed 5 times, switching to fallback models...');
          break; // Exit primary model loop, try fallbacks
        }
        // Wait a bit before retrying primary model
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        continue;
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`${primaryModel.name} - API Error Response:`, errorText);

        if (response.status === 400 && (errorText.includes('quota') || errorText.includes('billing') || errorText.includes('API key not valid'))) {
          if (isDev) console.log('API quota or billing issue detected with primary model, switching to fallbacks...');
          break; // Exit primary model loop, try fallbacks
        }

        lastError = new Error(`Primary model API request failed: ${response.status} - ${errorText}`);
        if (attempt === maxPrimaryAttempts) {
          if (isDev) console.log('Primary model exhausted all attempts, switching to fallbacks...');
          break; // Exit primary model loop, try fallbacks
        }
        continue;
      }

      const data = await response.json();
      if (isDev) console.log(`${primaryModel.name} - API Response data:`, data);

      // Handle both old and new API response structures
      let responseText = null;
      
      if (data.candidates && data.candidates.length > 0) {
        const candidate = data.candidates[0];
        
        // New API structure (direct text in candidate)
        if (candidate.text) {
          responseText = candidate.text;
        }
        // Old API structure (nested in content.parts)
        else if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
          responseText = candidate.content.parts[0].text;
        }
        // Alternative structure (parts directly in candidate)
        else if (candidate.parts && candidate.parts.length > 0) {
          responseText = candidate.parts[0].text;
        }
        // Gemini 3 Pro Preview specific structure
        else if (candidate.output) {
          responseText = candidate.output;
        }
        // Another possible structure
        else if (candidate.message) {
          responseText = candidate.message;
        }
      }
      
      if (responseText) {
        if (isDev) console.log('Raw API response text from primary model:', responseText);

        responseText = responseText.replace(/```json\s*/g, '').replace(/```\s*$/g, '').trim();
        if (isDev) console.log('Cleaned response text from primary model:', responseText);

        try {
          if (!responseText || responseText.trim() === '') {
            if (isDev) console.log('Empty response from primary model, retrying...');
            if (attempt === maxPrimaryAttempts) {
              if (isDev) console.log('Primary model exhausted, switching to fallbacks...');
              break;
            }
            continue;
          }

          const result = JSON.parse(responseText);

          // Strip any HTML br tags that the model might have included
          if (result.message) {
            result.message = result.message.replace(/<br\s*\/?>/gi, '\n');
          }

          if (result.message && (result.message.includes('Status:') || result.message.includes("Here's what I have"))) {
            if (isDev) console.log('Detected confirmation message from primary model, fixing line breaks...');

            let fixedMessage = result.message
              .replace(/\\n/g, '\n')
              .replace(/\n+/g, ' ')
              .trim();

            fixedMessage = fixedMessage
              .replace(/Perfect! Here's what I have:/g, "Perfect! Here's what I have:\n\n")
              .replace(/Name:/g, 'Name:')
              .replace(/Status:/g, '\nStatus:')
              .replace(/Children:/g, '\nChildren:')
              .replace(/Interests:/g, '\nInterests:')
              .replace(/Location:/g, '\nLocation:')
              .replace(/Does everything look correct\?/g, '\n\nDoes everything look correct?')
              .replace(/Does this look correct\?/g, '\n\nDoes this look correct?')
              .replace(/Is this correct\?/g, '\n\nIs this correct?');

            result.message = fixedMessage;
            if (isDev) console.log('Fixed message with line breaks from primary model:', result.message);
          }

          if (isDev) console.log(`✅ API Success with primary model ${primaryModel.name} - Parsed result:`, result);
          if (isDev) console.log(`🎉 [AI Service] Total AI time: ${Date.now() - apiStartTime}ms`);
          return result;

        } catch (parseError) {
          if (isDev) console.log('JSON parse failed with primary model, attempting to fix malformed JSON...');

          let fixedJson = responseText
            .replace(/\n/g, '\\n')
            .replace(/\r/g, '\\r')
            .replace(/\t/g, '\\t');

          try {
            const result = JSON.parse(fixedJson);

            if (result.message && (result.message.includes('Status:') || result.message.includes("Here's what I have"))) {
              let fixedMessage = result.message
                .replace(/\\n/g, '\n')
                .replace(/\n+/g, ' ')
                .trim();

              fixedMessage = fixedMessage
                .replace(/Perfect! Here's what I have:/g, "Perfect! Here's what I have:\n\n")
                .replace(/Status:/g, 'Status:')
                .replace(/Children:/g, '\nChildren:')
                .replace(/Interests:/g, '\nInterests:')
                .replace(/Location:/g, '\nLocation:')
                .replace(/Does everything look correct\?/g, '\n\nDoes everything look correct?');

              result.message = fixedMessage;
            }

            if (isDev) console.log(`✅ API Success with primary model ${primaryModel.name} - Parsed result:`, result);
            return result;
          } catch (secondParseError) {
            console.error('Failed to parse JSON from primary model even after fixing:', secondParseError);
            if (attempt === maxPrimaryAttempts) {
              if (isDev) console.log('Primary model JSON parsing exhausted, switching to fallbacks...');
              break;
            }
            continue;
          }
        }
      } else {
        console.error(`${primaryModel.name} - Invalid API response structure:`, data);
        if (attempt === maxPrimaryAttempts) {
          if (isDev) console.log('Primary model invalid response structure, switching to fallbacks...');
          break;
        }
        continue;
      }
    } catch (error) {
      console.error(`${primaryModel.name} - Error (attempt ${attempt}/${maxPrimaryAttempts}):`, error);
      lastError = error;
      if (attempt === maxPrimaryAttempts) {
        if (isDev) console.log('Primary model failed all attempts, switching to fallbacks...');
        break;
      }
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }

  // If primary model failed 5 times, try fallback models
  if (isDev) console.log('🔄 Primary model (Gemini 3 Pro Preview) failed after 5 attempts. Switching to fallback models...');
  
  for (let i = 0; i < fallbackModels.length; i++) {
    const { name: model, version } = fallbackModels[i];
    if (isDev) console.log(`Trying fallback model: ${model} with API version ${version} (fallback ${i + 1}/${fallbackModels.length})`);

    try {
      const apiUrl = `https://generativelanguage.googleapis.com/${version}/models/${model}:generateContent?key=${apiKey}`;

      // 2.5-pro requires thinking mode - use minimum budget of 1024
      // Other models can have thinking disabled
      const thinkingBudget = model === 'gemini-2.5-pro' ? 1024 : 0;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: fullPrompt }]
          }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 512,
            topP: 0.8,
            topK: 20,
            thinkingConfig: {
              thinkingBudget: thinkingBudget
            }
          }
        })
      });

      if (isDev) console.log(`${model} - API Response status:`, response.status);

      if (response.status === 503 || response.status === 429) {
        if (isDev) console.log(`${model} is overloaded or rate limited, trying next fallback model...`);
        if (i === fallbackModels.length - 1) {
          return createFallbackResponse(profile, history);
        }
        continue;
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`${model} - API Error Response:`, errorText);

        if (response.status === 400 && (errorText.includes('quota') || errorText.includes('billing') || errorText.includes('API key not valid'))) {
          if (isDev) console.log('API quota or billing issue detected, trying next fallback model...');
          if (i === fallbackModels.length - 1) {
            return createFallbackResponse(profile, history);
          }
          continue;
        }

        lastError = new Error(`Fallback API request failed: ${response.status} - ${errorText}`);
        if (i === fallbackModels.length - 1) {
          return createFallbackResponse(profile, history);
        }
        continue;
      }

      const data = await response.json();
      if (isDev) console.log(`${model} - API Response data:`, data);

      // Handle both old and new API response structures
      let responseText = null;
      
      if (data.candidates && data.candidates.length > 0) {
        const candidate = data.candidates[0];
        
        // New API structure (direct text in candidate)
        if (candidate.text) {
          responseText = candidate.text;
        }
        // Old API structure (nested in content.parts)
        else if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
          responseText = candidate.content.parts[0].text;
        }
        // Alternative structure (parts directly in candidate)
        else if (candidate.parts && candidate.parts.length > 0) {
          responseText = candidate.parts[0].text;
        }
      }
      
      if (responseText) {
        if (isDev) console.log('Raw API response text from fallback model:', responseText);

        responseText = responseText.replace(/```json\s*/g, '').replace(/```\s*$/g, '').trim();
        if (isDev) console.log('Cleaned response text from fallback model:', responseText);

        try {
          if (!responseText || responseText.trim() === '') {
            if (isDev) console.log('Empty response from fallback API, trying next model...');
            if (i === fallbackModels.length - 1) {
              return createFallbackResponse(profile, history);
            }
            continue;
          }

          const result = JSON.parse(responseText);

          // Strip any HTML br tags that the model might have included
          if (result.message) {
            result.message = result.message.replace(/<br\s*\/?>/gi, '\n');
          }

          if (result.message && (result.message.includes('Status:') || result.message.includes("Here's what I have"))) {
            if (isDev) console.log('Detected confirmation message from fallback model, fixing line breaks...');

            let fixedMessage = result.message
              .replace(/\\n/g, '\n')
              .replace(/\n+/g, ' ')
              .trim();

            fixedMessage = fixedMessage
              .replace(/Perfect! Here's what I have:/g, "Perfect! Here's what I have:\n\n")
              .replace(/Name:/g, 'Name:')
              .replace(/Status:/g, '\nStatus:')
              .replace(/Children:/g, '\nChildren:')
              .replace(/Interests:/g, '\nInterests:')
              .replace(/Location:/g, '\nLocation:')
              .replace(/Does everything look correct\?/g, '\n\nDoes everything look correct?')
              .replace(/Does this look correct\?/g, '\n\nDoes this look correct?')
              .replace(/Is this correct\?/g, '\n\nIs this correct?');

            result.message = fixedMessage;
            if (isDev) console.log('Fixed message with line breaks from fallback model:', result.message);
          }

          if (isDev) console.log(`🎯 API Success with fallback model ${model} - Parsed result:`, result);
          return result;

        } catch (parseError) {
          if (isDev) console.log('JSON parse failed with fallback model, attempting to fix malformed JSON...');

          let fixedJson = responseText
            .replace(/\n/g, '\\n')
            .replace(/\r/g, '\\r')
            .replace(/\t/g, '\\t');

          try {
            const result = JSON.parse(fixedJson);

            if (result.message && (result.message.includes('Status:') || result.message.includes("Here's what I have"))) {
              let fixedMessage = result.message
                .replace(/\\n/g, '\n')
                .replace(/\n+/g, ' ')
                .trim();

              fixedMessage = fixedMessage
                .replace(/Perfect! Here's what I have:/g, "Perfect! Here's what I have:\n\n")
                .replace(/Status:/g, 'Status:')
                .replace(/Children:/g, '\nChildren:')
                .replace(/Interests:/g, '\nInterests:')
                .replace(/Location:/g, '\nLocation:')
                .replace(/Does everything look correct\?/g, '\n\nDoes everything look correct?');

              result.message = fixedMessage;
            }

            if (isDev) console.log(`🎯 API Success with fallback model ${model} - Parsed result:`, result);
            return result;
          } catch (secondParseError) {
            console.error('Failed to parse JSON from fallback model even after fixing:', secondParseError);
            if (i === fallbackModels.length - 1) {
              return createFallbackResponse(profile, history);
            }
            continue;
          }
        }
      } else {
        console.error(`${model} - Invalid API response structure:`, data);
        if (i === fallbackModels.length - 1) {
          return createFallbackResponse(profile, history);
        }
        continue;
      }
    } catch (error) {
      console.error(`${model} - Fallback Error:`, error);
      lastError = error;
      if (i === fallbackModels.length - 1) {
        return createFallbackResponse(profile, history);
      }
    }
  }

  // If all models failed, return fallback response
  console.error('🚨 All models failed (primary + fallbacks). Using hardcoded fallback response.');
  return createFallbackResponse(profile, history);
};

const createFallbackResponse = (profile: UserProfile, history: Message[]) => {
  if (isDev) console.log('Creating fallback response for step:', profile.onboarding_step);

  switch (profile.onboarding_step) {
    case 'welcome':
      return {
        message: "Hey there! So glad you're here. First things first, what's your name?",
        next_step: "name",
        profile_updates: {}
      };

    case 'name':
      return {
        message: "Nice to meet you! Are you an expecting dad or a current dad?",
        next_step: "status",
        profile_updates: {}
      };

    case 'status':
      return {
        message: "Are you an expecting dad or a current dad?",
        next_step: "status",
        profile_updates: {}
      };

    case 'child_info':
      return {
        message: "I'd love to hear about your little one! When are they due or when were they born?",
        next_step: "child_info",
        profile_updates: {}
      };

    case 'siblings':
      return {
        message: "Do you have any other children?",
        next_step: "siblings", 
        profile_updates: {}
      };

    case 'interests':
      return {
        message: "What are some of your hobbies or interests?",
        next_step: "interests",
        profile_updates: {}
      };

    case 'location':
      return {
        message: "What city and state are you located in?",
        next_step: "location",
        profile_updates: {}
      };

    case 'confirm':
      const userName = profile.name || 'Friend';
      const status = profile.children?.some(c => c.type === 'expecting') ? 'Expecting Dad' : 'Current Dad';

      const allChildren = profile.children || [];
      const childrenInfo = allChildren.length > 0 ?
        allChildren.map(child => {
          const childName = (child as any).name || '';
          const namePrefix = childName ? `${childName} ` : '';
          const typePrefix = child.type === 'expecting' ? 'Expecting ' : '';
          return `${namePrefix}${typePrefix}${child.birth_month}/${child.birth_year}${child.gender ? `, ${child.gender}` : ''}`;
        }).join(', ') :
        'Not specified';

      const interests = profile.interests?.join(', ') || 'None mentioned';
      const location = profile.location ? `${profile.location.city}, ${profile.location.state_code}` : 'Not specified';

      return {
        message: `Perfect! Here's what I have:\n\nName: ${userName}\nStatus: ${status}\nChildren: ${childrenInfo}\nInterests: ${interests}\nLocation: ${location}\n\nDoes everything look correct?`,
        next_step: "confirm",
        profile_updates: {}
      };

    case 'complete':
      return {
        message: "We've got all the information we need. Our matching algorithm will find the best Dad Circle for you based on your location, interests, and your child's age. You should expect to get an email from us shortly with information about your group. In the meantime, feel free to ask me any questions you might have about Dad Circles!",
        next_step: "complete",
        profile_updates: {}
      };

    default:
      return {
        message: "I'm having a brief technical hiccup, but I'm back! Could you repeat that last bit?",
        next_step: profile.onboarding_step,
        profile_updates: {}
      };
  }
};