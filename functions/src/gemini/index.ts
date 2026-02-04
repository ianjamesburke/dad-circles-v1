/**
 * Gemini Service - Callable Function (Simplified)
 *
 * Structured-output flow: Gemini returns JSON that contains the next
 * assistant message and any profile updates. The server validates and
 * normalizes updates, determines next step deterministically, and
 * returns a minimal response to the client.
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as admin from "firebase-admin";
import { GoogleGenAI } from "@google/genai";
import { logger } from "../logger";
import { RateLimiter } from "../rateLimiter";
import { CONFIG } from "../config";
import { getLocationFromPostcode, formatLocation } from "../utils/location";

const geminiApiKey = defineSecret("GEMINI_API_KEY");

enum OnboardingStep {
  WELCOME = "welcome",
  NAME = "name",
  STATUS = "status",
  CHILD_INFO = "child_info",
  SIBLINGS = "siblings",
  INTERESTS = "interests",
  LOCATION = "location",
  CONFIRM = "confirm",
  COMPLETE = "complete"
}

type DadStatus = "current" | "expecting" | "both";

type HistoryMessage = { role: string; content: string };

interface Child {
  type?: "expecting" | "existing";
  birth_month?: number;
  birth_year?: number;
  gender?: string;
}

interface UserLocation {
  city: string;
  state_code: string;
  country_code?: string;
}

interface UserProfile {
  session_id: string;
  name?: string;
  dad_status?: DadStatus;
  email?: string;
  postcode?: string;
  onboarded: boolean;
  onboarding_step: OnboardingStep;
  location?: UserLocation;
  location_confirmed?: boolean;
  interests?: string[];
  children: Child[];
  children_complete?: boolean;
  last_updated?: any;
  matching_eligible?: boolean;
}

const RESPONSE_JSON_SCHEMA = {
  type: "object",
  properties: {
    assistant_message: { type: "string" },
    profile_updates: {
      type: "object",
      properties: {
        name: { type: "string" },
        dad_status: {
          type: "string",
          enum: ["current", "expecting", "both"]
        },
        interests: {
          type: "array",
          items: { type: "string" }
        },
        children: {
          type: "array",
          items: {
            type: "object",
            properties: {
              type: { type: "string", enum: ["existing", "expecting"] },
              birth_month: { type: "integer" },
              birth_year: { type: "integer" },
              gender: { type: "string" }
            },
            additionalProperties: false
          }
        },
        children_action: {
          type: "string",
          enum: ["append", "replace"]
        },
        children_complete: { type: "boolean" },
        location: {
          type: "object",
          properties: {
            city: { type: "string" },
            state_code: { type: "string" },
            country_code: { type: "string" }
          },
          additionalProperties: false
        },
        location_confirmed: { type: "boolean" }
      },
      additionalProperties: false
    },
    profile_confirmed: { type: "boolean" }
  },
  required: ["assistant_message"],
  additionalProperties: false
};

const toContents = (history: HistoryMessage[]) =>
  history.map((msg) => ({
    role: msg.role === "user" ? "user" : "model",
    parts: [{ text: msg.content }]
  }));

const getLatestUserMessage = (history: HistoryMessage[]): string | undefined => {
  for (let i = history.length - 1; i >= 0; i -= 1) {
    if (history[i]?.role === "user" && history[i]?.content) {
      return history[i].content.trim();
    }
  }
  return undefined;
};

const cleanString = (value?: string): string | undefined => {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
};

const normalizeLocation = (value?: UserLocation): UserLocation | undefined => {
  if (!value) return undefined;
  const city = cleanString(value.city);
  const state = cleanString(value.state_code)?.toUpperCase();
  const country = cleanString(value.country_code)?.toUpperCase();
  if (!city || !state) return undefined;
  return {
    city,
    state_code: state,
    ...(country ? { country_code: country } : {})
  };
};

const normalizeInterests = (value?: string[]): string[] | undefined => {
  if (!value) return undefined;
  const cleaned = value.map((item) => item.trim()).filter(Boolean);
  return cleaned;
};

const normalizeChildren = (children?: Child[]): Child[] | undefined => {
  if (!children) return undefined;
  const cleaned: Child[] = [];
  for (const child of children) {
    if (!child) continue;
    const birth_year =
      child.birth_year !== undefined && Number.isFinite(child.birth_year)
        ? Number(child.birth_year)
        : undefined;
    const birth_month =
      child.birth_month !== undefined && Number.isFinite(child.birth_month)
        ? Number(child.birth_month)
        : undefined;
    const type =
      child.type === "existing" || child.type === "expecting" ? child.type : undefined;
    const gender = cleanString(child.gender);

    if (!birth_year && !birth_month && !type && !gender) continue;

    cleaned.push({
      ...(type ? { type } : {}),
      ...(birth_month ? { birth_month } : {}),
      ...(birth_year ? { birth_year } : {}),
      ...(gender ? { gender } : {})
    });
  }
  return cleaned.length ? cleaned : undefined;
};

const mergeChildren = (existing: Child[], incoming: Child[]): Child[] => {
  const combined = [...existing];
  for (const child of incoming) {
    const exists = combined.some(
      (existingChild) =>
        existingChild.birth_year === child.birth_year &&
        existingChild.birth_month === child.birth_month &&
        existingChild.gender === child.gender &&
        existingChild.type === child.type
    );
    if (!exists) {
      combined.push(child);
    }
  }
  return combined;
};

const formatChild = (child: Child): string => {
  const monthYear =
    child.birth_month && child.birth_year
      ? `${child.birth_month}/${child.birth_year}`
      : child.birth_year
        ? `${child.birth_year}`
        : "unknown date";
  const type = child.type === "expecting" ? "expecting" : "born";
  const gender = child.gender ? ` (${child.gender})` : "";
  return `${type} ${monthYear}${gender}`;
};

const buildSummary = (profile: UserProfile): string => {
  const lines: string[] = [];
  if (profile.name) lines.push(`Name: ${profile.name}`);
  if (profile.dad_status) lines.push(`Dad status: ${profile.dad_status}`);
  if (profile.children?.length) {
    const children = profile.children.map(formatChild).join(", ");
    lines.push(`Kids: ${children}`);
  }
  if (profile.children_complete) {
    lines.push("Kids list: confirmed complete");
  }
  if (profile.interests !== undefined) {
    lines.push(`Interests: ${profile.interests.length ? profile.interests.join(", ") : "none"}`);
  }
  if (profile.location?.city && profile.location?.state_code) {
    lines.push(
      `Location: ${formatLocation(
        profile.location.city,
        profile.location.state_code,
        profile.location.country_code
      )}`
    );
  }
  return lines.join("\n");
};

const hasValidChildren = (children: Child[]): boolean =>
  children.some((child) => typeof child.birth_year === "number");

const getMissingFields = (profile: UserProfile) => {
  const missing: string[] = [];
  if (!profile.name) missing.push("name");
  if (!profile.dad_status) missing.push("dad_status");

  const hasChildren = profile.children && profile.children.length > 0;
  if (!hasChildren || !hasValidChildren(profile.children)) {
    missing.push("children");
  } else if (!profile.children_complete) {
    missing.push("children_complete");
  }

  if (profile.interests === undefined) missing.push("interests");

  if (!profile.location?.city || !profile.location?.state_code || profile.location_confirmed !== true) {
    missing.push("location");
  }

  return missing;
};

const getNextStep = (profile: UserProfile): OnboardingStep => {
  if (!profile.name) return OnboardingStep.NAME;
  if (!profile.dad_status) return OnboardingStep.STATUS;

  const hasChildren = profile.children && profile.children.length > 0;
  if (!hasChildren || !hasValidChildren(profile.children)) return OnboardingStep.CHILD_INFO;
  if (!profile.children_complete) return OnboardingStep.SIBLINGS;

  if (profile.interests === undefined) return OnboardingStep.INTERESTS;
  if (!profile.location?.city || !profile.location?.state_code) return OnboardingStep.LOCATION;
  if (!profile.onboarded) return OnboardingStep.CONFIRM;
  return OnboardingStep.COMPLETE;
};

const buildFallbackPrompt = (
  nextStep: OnboardingStep,
  profile: UserProfile,
  inferredLocation?: { city: string; stateCode: string; countryCode: string } | null
): string => {
  switch (nextStep) {
    case OnboardingStep.NAME:
      return "What’s your first name?";
    case OnboardingStep.STATUS:
      return "Are you a current dad, expecting, or both?";
    case OnboardingStep.CHILD_INFO: {
      if (profile.dad_status === "expecting") {
        return "What’s the due month and year? (e.g. March 2026)";
      }
      if (profile.dad_status === "both") {
        return "What are the birth month/year for your current kid(s), and the due month/year for the expecting one?";
      }
      return "What are the birth month and year for your child(ren)?";
    }
    case OnboardingStep.SIBLINGS:
      return "Do you have any other children besides the one you just mentioned?";
    case OnboardingStep.INTERESTS:
      return "What are a few interests or hobbies you’re into?";
    case OnboardingStep.LOCATION:
      if (inferredLocation) {
        return `I have you in ${formatLocation(
          inferredLocation.city,
          inferredLocation.stateCode,
          inferredLocation.countryCode
        )}. Is that right?`;
      }
      return "What city and state are you in?";
    case OnboardingStep.CONFIRM:
      return `Here's what I have.\n${buildSummary(profile)}\nDoes that look right?`;
    default:
      return "What should we update?";
  }
};

const normalizeUpdates = (rawUpdates: any): Partial<UserProfile> => {
  if (!rawUpdates || typeof rawUpdates !== "object") return {};

  const updates: Partial<UserProfile> = {};

  const name = cleanString(rawUpdates.name);
  if (name) updates.name = name;

  if (rawUpdates.dad_status === "current" || rawUpdates.dad_status === "expecting" || rawUpdates.dad_status === "both") {
    updates.dad_status = rawUpdates.dad_status;
  }

  const interests = normalizeInterests(rawUpdates.interests);
  if (interests !== undefined) updates.interests = interests;

  const location = normalizeLocation(rawUpdates.location);
  if (location) updates.location = location;

  const children = normalizeChildren(rawUpdates.children);
  if (children) updates.children = children;

  if (typeof rawUpdates.children_complete === "boolean") {
    updates.children_complete = rawUpdates.children_complete;
  }

  if (typeof rawUpdates.location_confirmed === "boolean") {
    updates.location_confirmed = rawUpdates.location_confirmed;
  }

  return updates;
};

export const getGeminiResponse = onCall(
  {
    cors: true,
    timeoutSeconds: CONFIG.gemini.timeout,
    secrets: [geminiApiKey]
  },
  async (request) => {
    const startTime = Date.now();
    const { history } = request.data || {};

    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication required");
    }

    const sessionId = request.auth.uid;

    if (history !== undefined) {
      if (!Array.isArray(history)) {
        throw new HttpsError("invalid-argument", "history must be an array");
      }
      if (history.length > CONFIG.validation.maxHistoryLength) {
        throw new HttpsError(
          "invalid-argument",
          `history too long (max ${CONFIG.validation.maxHistoryLength} messages)`
        );
      }
      for (const msg of history) {
        if (!msg?.role || !msg?.content) {
          throw new HttpsError("invalid-argument", "invalid message format in history");
        }
        if (
          typeof msg.content !== "string" ||
          msg.content.length > CONFIG.validation.maxMessageLength
        ) {
          throw new HttpsError(
            "invalid-argument",
            `Message too long. Please keep your message under ${CONFIG.validation.maxMessageLength} characters.`
          );
        }
      }
    }

    const rateLimitCheck = await RateLimiter.checkGeminiRequest(sessionId);
    if (!rateLimitCheck.allowed) {
      logger.warn("Gemini request rate limited", {
        sessionId,
        reason: rateLimitCheck.reason
      });
      throw new HttpsError("resource-exhausted", rateLimitCheck.reason || "Rate limit exceeded");
    }

    const profileSnap = await admin.firestore().collection("profiles").doc(sessionId).get();
    if (!profileSnap.exists) {
      throw new HttpsError("not-found", "Profile not found");
    }
    const rawProfile = profileSnap.data() as UserProfile | undefined;
    if (!rawProfile) {
      throw new HttpsError("data-loss", "Profile data missing");
    }

    const profile: UserProfile = {
      ...rawProfile,
      children: Array.isArray(rawProfile.children) ? rawProfile.children : [],
      onboarding_step: Object.values(OnboardingStep).includes(
        rawProfile.onboarding_step as OnboardingStep
      )
        ? (rawProfile.onboarding_step as OnboardingStep)
        : OnboardingStep.WELCOME
    };

    const latestUserMessage = getLatestUserMessage(history || []);
    if (!latestUserMessage) {
      throw new HttpsError("invalid-argument", "Latest user message missing");
    }

    const inferredLocation =
      !profile.location && profile.postcode
        ? await getLocationFromPostcode(profile.postcode)
        : null;

    const missingFields = getMissingFields(profile);
    const stage = profile.onboarded
      ? "complete"
      : missingFields.length === 0
        ? "confirm"
        : "collecting";

    const summary = buildSummary(profile);

    const systemInstruction = [
      "You are the Dad Circles onboarding assistant. Be warm, friendly, and concise.",
      "Do not use markdown. Plain text only.",
      "Ask one question at a time unless the user already answered multiple items.",
      "If the user gives ages only (e.g. 'she is 2'), ask for birth month and year. Do not guess.",
      "For expecting kids, use the due month and year as birth_month and birth_year.",
      "If the user gives a due month without a year, ask for the year.",
      "If the user gives a relative due date (e.g. 'next month', 'in 2 months'), infer the specific month/year using today's date and ask for confirmation (do not ask them to re-state the date).",
      "If you detect a correction, update the field and continue.",
      "When adding children and the profile already has kids, set children_action to 'append'. Otherwise use 'replace'.",
      "If an inferred location is provided and the user confirms it, set location_confirmed to true (and set location to the inferred city/state).",
      "If the user provides their location directly, set location and location_confirmed to true.",
      "Return only JSON that matches the schema. Do not include extra text.",
      "Keep assistant_message under 240 characters.",
      "Never respond with a vague prompt. Ask a specific question about missing info.",
      "When all required data is collected, present a confirmation message that starts with: 'Here's what I have.'",
      "After the user confirms the summary, respond with a warm completion message that says their profile is set, welcome them to DadCircles, say we'll email when a suitable group is found, and invite them to ask questions or update info.",
      "If the user confirms the summary, set profile_confirmed to true.",
      "Required for completion: name, dad status, at least one child with birth year, children_complete confirmation, interests (can be empty), and location (city + state).",
      "If onboarding is already complete, answer questions and allow updates to details if asked.",
      `Today: ${new Date().toISOString().split("T")[0]}`,
      `Stage: ${stage}`,
      `Missing fields: ${missingFields.length ? missingFields.join(", ") : "none"}`,
      inferredLocation
        ? `Inferred location from postcode: ${formatLocation(
            inferredLocation.city,
            inferredLocation.stateCode,
            inferredLocation.countryCode
          )}`
        : "",
      `Current profile summary:\n${summary || "(empty)"}`
    ]
      .filter(Boolean)
      .join("\n");

    let parsed: any;
    try {
      const apiKey = geminiApiKey.value();
      if (!apiKey) {
        throw new HttpsError("failed-precondition", "Gemini API key not configured");
      }

      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: CONFIG.gemini.model,
        contents: toContents(history || []),
        config: {
          systemInstruction,
          temperature: CONFIG.gemini.temperature,
          maxOutputTokens: CONFIG.gemini.maxOutputTokens,
          responseMimeType: "application/json",
          responseJsonSchema: RESPONSE_JSON_SCHEMA
        }
      });

      const text = response.text ?? "";
      if (!text.trim()) {
        parsed = {};
      } else {
        try {
          parsed = JSON.parse(text);
        } catch (parseError) {
          const start = text.indexOf("{");
          const end = text.lastIndexOf("}");
          if (start !== -1 && end !== -1 && end > start) {
            const candidate = text.slice(start, end + 1);
            parsed = JSON.parse(candidate);
          } else {
            logger.warn("Gemini returned non-JSON response", { text });
            parsed = {};
          }
        }
      }
    } catch (error: any) {
      logger.error("Gemini request failed", {
        message: error?.message,
        name: error?.name,
        stack: error?.stack,
        string: String(error)
      });
      throw new HttpsError("internal", "Gemini request failed");
    }

    const updates = normalizeUpdates(parsed.profile_updates);
    const childrenAction = parsed.profile_updates?.children_action;

    if (updates.children) {
      const defaultAction = profile.children?.length ? "append" : "replace";
      const action =
        childrenAction === "append" || childrenAction === "replace"
          ? childrenAction
          : defaultAction;
      updates.children =
        action === "append"
          ? mergeChildren(profile.children, updates.children)
          : updates.children;
    }

    if (inferredLocation) {
      if (updates.location && updates.location_confirmed !== true) {
        delete updates.location;
      }
      if (!updates.location && updates.location_confirmed === true) {
        updates.location = {
          city: inferredLocation.city,
          state_code: inferredLocation.stateCode,
          country_code: inferredLocation.countryCode
        };
      }
    }

    const mergedProfile: UserProfile = {
      ...profile,
      ...updates,
      children: updates.children ?? profile.children
    };

    const refreshedMissing = getMissingFields(mergedProfile);
    const profileConfirmed = parsed.profile_confirmed === true;

    const nextStep = profileConfirmed && refreshedMissing.length === 0
      ? OnboardingStep.COMPLETE
      : getNextStep(mergedProfile);

    const completionMessage =
      "You’re all set! Welcome to DadCircles. Sit tight — we’ll email you when we find a great group. In the meantime, feel free to ask questions or update your info anytime.";

    const assistantMessage =
      nextStep === OnboardingStep.COMPLETE
        ? completionMessage
        : typeof parsed.assistant_message === "string" && parsed.assistant_message.trim().length
          ? parsed.assistant_message.trim()
          : buildFallbackPrompt(nextStep, mergedProfile, inferredLocation);

    logger.info("Gemini response", {
      sessionId,
      durationMs: Date.now() - startTime,
      nextStep,
      updates
    });

    return {
      message: assistantMessage,
      profile_updates: updates,
      next_step: nextStep
    };
  }
);
