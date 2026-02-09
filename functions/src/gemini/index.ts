/**
 * Gemini Service - Callable Function
 *
 * Server-side conversation flow + structured extraction via function calling.
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { FieldValue } from "firebase-admin/firestore";
import * as admin from "firebase-admin";
import {
  GoogleGenAI,
  FunctionCallingConfigMode,
  FunctionDeclaration
} from "@google/genai";
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

interface Child {
  type?: "expecting" | "existing";
  birth_month?: number;
  birth_year: number;
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
  interests?: string[];
  children: Child[];
  children_complete?: boolean;
  last_updated?: any;
  matching_eligible?: boolean;
}

type HistoryMessage = { role: string; content: string };

const recordProfileUpdatesDeclaration: FunctionDeclaration = {
  name: "record_profile_updates",
  description: "Record structured onboarding data extracted from the user.",
  parametersJsonSchema: {
    type: "object",
    properties: {
      name: { type: "string", description: "User's preferred first name." },
      dad_status: {
        type: "string",
        enum: ["current", "expecting", "both"],
        description: "Whether the user is a current dad, expecting dad, or both."
      },
      interests: {
        type: "array",
        items: { type: "string" },
        description: "Interests or hobbies. Can be an empty array if none."
      },
      children: {
        type: "array",
        items: {
          type: "object",
          properties: {
            type: { type: "string", enum: ["existing", "expecting"] },
            birth_year: { type: "integer", description: "Four-digit year. Optional if only a month was provided." },
            birth_month: {
              type: "integer",
              minimum: 1,
              maximum: 12,
              description: "Month number (1-12). Optional."
            },
            gender: { type: "string", description: "Optional gender." }
          }
        }
      },
      children_action: {
        type: "string",
        enum: ["append", "replace"],
        description: "Whether to append children or replace the list."
      },
      children_complete: {
        type: "boolean",
        description: "True when the user confirms no additional kids."
      },
      location: {
        type: "object",
        properties: {
          city: { type: "string" },
          state_code: { type: "string" },
          country_code: { type: "string" }
        },
        required: ["city", "state_code"]
      },
      location_confirmed: {
        type: "boolean",
        description: "True if the user confirms the inferred location."
      },
      profile_confirmed: {
        type: "boolean",
        description: "True if the user confirms the final summary."
      }
    },
    additionalProperties: false
  }
};

const isAffirmative = (value: string): boolean => {
  const normalized = value.trim().toLowerCase();
  return [
    "yes",
    "yep",
    "yeah",
    "yup",
    "correct",
    "looks good",
    "that's right",
    "that is right",
    "right",
    "sure",
    "ok",
    "okay"
  ].some((phrase) => normalized === phrase || normalized.includes(phrase));
};

const normalizeName = (value?: string): string | undefined => {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
};

const normalizeInterests = (value?: string[] | string): string[] | undefined => {
  if (!value) return undefined;
  const items = Array.isArray(value) ? value : value.split(/[,;]+/);
  const cleaned = items
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  if (
    cleaned.length === 1 &&
    ["none", "no", "nope", "n/a"].includes(cleaned[0].toLowerCase())
  ) {
    return [];
  }
  return cleaned;
};

const normalizeLocation = (location?: UserLocation): UserLocation | undefined => {
  if (!location) return undefined;
  const city = location.city?.trim();
  const state = location.state_code?.trim().toUpperCase();
  const country = location.country_code?.trim().toUpperCase();
  if (!city || !state) return undefined;
  return {
    city,
    state_code: state,
    ...(country ? { country_code: country } : {})
  };
};

const MONTH_NAMES_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December"
];

const getMonthNameLong = (month: number): string =>
  MONTH_NAMES_LONG[month - 1] || "";

const parseMonthFromText = (value?: string): number | undefined => {
  if (!value) return undefined;
  const normalized = value.toLowerCase();
  const monthMatches: { [key: string]: number } = {
    jan: 1,
    january: 1,
    feb: 2,
    february: 2,
    mar: 3,
    march: 3,
    apr: 4,
    april: 4,
    may: 5,
    jun: 6,
    june: 6,
    jul: 7,
    july: 7,
    aug: 8,
    august: 8,
    sep: 9,
    sept: 9,
    september: 9,
    oct: 10,
    october: 10,
    nov: 11,
    november: 11,
    dec: 12,
    december: 12
  };
  const match = normalized.match(
    /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/
  );
  if (!match) return undefined;
  return monthMatches[match[1]];
};

const parseRelativeMonthsFromText = (
  value?: string,
  now: Date = new Date()
): { month: number; year: number } | undefined => {
  if (!value) return undefined;
  const normalized = value.toLowerCase();
  const match = normalized.match(/\b(?:due\s+in|in)\s+(\d{1,2})\s+months?\b/);
  if (!match) return undefined;
  const offset = Number(match[1]);
  if (!Number.isInteger(offset) || offset <= 0 || offset > 24) {
    return undefined;
  }
  const baseMonth = now.getMonth() + 1;
  const baseYear = now.getFullYear();
  const total = baseMonth + offset;
  const month = ((total - 1) % 12) + 1;
  const year = baseYear + Math.floor((total - 1) / 12);
  return { month, year };
};

const inferExpectingYear = (birthMonth: number, now: Date): number => {
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  return birthMonth >= currentMonth ? currentYear : currentYear + 1;
};

const normalizeChildren = (
  children?: Child[],
  now: Date = new Date()
): { normalized?: Child[]; inferredDueDates?: { month: number; year: number }[] } => {
  if (!children) return {};
  const normalized: Child[] = [];
  const inferredDueDates: { month: number; year: number }[] = [];

  for (const child of children) {
    const rawMonth =
      child.birth_month !== undefined ? Number(child.birth_month) : undefined;
    const validMonth =
      rawMonth !== undefined &&
      Number.isInteger(rawMonth) &&
      rawMonth >= 1 &&
      rawMonth <= 12
        ? rawMonth
        : undefined;

    let birthYear =
      child.birth_year !== undefined ? Number(child.birth_year) : NaN;
    if (!Number.isInteger(birthYear) && child.type === "expecting" && validMonth) {
      birthYear = inferExpectingYear(validMonth, now);
      inferredDueDates.push({ month: validMonth, year: birthYear });
    }

    if (!Number.isInteger(birthYear)) {
      continue;
    }
    if (
      birthYear < CONFIG.validation.minBirthYear ||
      birthYear > CONFIG.validation.maxBirthYear
    ) {
      continue;
    }

    const gender = child.gender?.trim();
    normalized.push({
      birth_year: birthYear,
      ...(validMonth ? { birth_month: validMonth } : {}),
      ...(gender ? { gender } : {}),
      ...(child.type ? { type: child.type } : {})
    });
  }

  return {
    normalized: normalized.length ? normalized : undefined,
    inferredDueDates: inferredDueDates.length ? inferredDueDates : undefined
  };
};

const formatChildSummary = (child: Child): string => {
  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec"
  ];
  const date = child.birth_month
    ? `${monthNames[child.birth_month - 1]} ${child.birth_year}`
    : `${child.birth_year}`;
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const isExpecting =
    child.type === "expecting"
      ? true
      : child.type === "existing"
        ? false
        : child.birth_year > currentYear ||
          (child.birth_year === currentYear &&
            child.birth_month !== undefined &&
            child.birth_month > currentMonth);
  const prefix = isExpecting ? "Due" : "Born";
  return child.gender ? `${prefix} ${date} (${child.gender})` : `${prefix} ${date}`;
};

const buildSummary = (profile: UserProfile): string => {
  const nameLine = `Name: ${profile.name ?? "—"}`;
  const statusLine = `Dad status: ${profile.dad_status ?? "—"}`;
  const childrenLine = profile.children?.length
    ? `Kids: ${profile.children.map(formatChildSummary).join("; ")}`
    : "Kids: —";
  const interestsLine =
    profile.interests !== undefined
      ? `Interests: ${profile.interests.length ? profile.interests.join(", ") : "None"}`
      : "Interests: —";
  const locationLine = profile.location
    ? `Location: ${formatLocation(
        profile.location.city,
        profile.location.state_code,
        profile.location.country_code
      )}`
    : "Location: —";
  return [nameLine, statusLine, childrenLine, interestsLine, locationLine].join("\n");
};

const COMPLETION_MESSAGE =
  "You're all set. Sit tight while we find a local dad group for you — we'll email you as soon as there's a good match. If you have any questions or want to update your details, just ask.";

const isLikelyTruncated = (text: string): boolean => {
  const trimmed = text.trim();
  if (!trimmed) return true;
  if (!/[?!.]$/.test(trimmed)) return true;
  if (/(to help|thanks|thank you).*(what|who|where|when)\?$/.test(trimmed.toLowerCase())) {
    return true;
  }
  if (/(or your\?|or you\?|your\?|you\?)$/.test(trimmed.toLowerCase()) &&
      /(hobbies|interests|enjoy|share)/.test(trimmed.toLowerCase())) {
    return true;
  }
  // Common dangling endings that indicate cut-off mid-thought
  const lower = trimmed.toLowerCase();
  const danglingEndings = [
    " in",
    " for",
    " to",
    " with",
    " at",
    " from",
    " about",
    " by",
    " of",
    " on",
    " and",
    " but"
  ];
  return danglingEndings.some((ending) => lower.endsWith(ending));
};

const buildFallbackMessage = (
  step: OnboardingStep,
  profile: UserProfile,
  inferredLocation?: UserLocation | null
): string => {
  switch (step) {
    case OnboardingStep.NAME:
      return "Hey, thanks for joining Dad Circles. Excited that you're here. First of all, what's your name? And are you a current dad, expecting dad, or both?";
    case OnboardingStep.STATUS:
      return "Are you a current dad, an expecting dad, or both?";
    case OnboardingStep.CHILD_INFO: {
      if (profile.dad_status === "both") {
        return "Great. What’s the birth month and year for your current kid(s)? And when is your next little one due (month and year)?";
      }
      if (profile.dad_status === "expecting") {
        return "Awesome. When is your little one due? Month and year is perfect.";
      }
      return "Great. What’s the birth month and year for your kid(s)? If you have more than one, feel free to list them.";
    }
    case OnboardingStep.INTERESTS:
      return "Nice. What are some interests or hobbies for you or your kids? If none, just say none.";
    case OnboardingStep.LOCATION: {
      const location = profile.location ?? inferredLocation;
      if (location) {
        const locationText = formatLocation(
          location.city,
          location.state_code,
          location.country_code
        );
        return `I have you in ${locationText}. Is that where you live?`;
      }
      return "What city and state do you live in?";
    }
    case OnboardingStep.CONFIRM:
      return `Great, here’s what I have so far:\n${buildSummary(profile)}\n\nDoes that look right?`;
    case OnboardingStep.COMPLETE:
      return COMPLETION_MESSAGE;
    default:
      return "Thanks! What should we start with?";
  }
};

const buildNextQuestionHint = (
  step: OnboardingStep,
  profile: UserProfile,
  inferredLocation?: UserLocation | null,
  latestUserMessage?: string,
  childInfoMissing?: boolean,
  inferredDueDates?: { month: number; year: number }[]
): string => {
  switch (step) {
    case OnboardingStep.NAME:
      return "Ask for their first name. You can also confirm whether they are a current dad, expecting dad, or both if it helps move faster.";
    case OnboardingStep.STATUS:
      return "Ask if they are a current dad, expecting dad, or both.";
    case OnboardingStep.CHILD_INFO: {
      if (inferredDueDates?.length) {
        const first = inferredDueDates[0];
        const monthName = getMonthNameLong(first.month);
        return `Confirm the inferred due date: ask if they meant ${monthName} ${first.year}.`;
      }
      if (childInfoMissing && latestUserMessage) {
        return "They gave ages or vague info. Ask for birth month and year (or due month/year) in a friendly, non-repetitive way.";
      }
      if (profile.dad_status === "both") {
        return "Ask for existing kids' birth month/year and the due month/year for the expecting child.";
      }
      if (profile.dad_status === "expecting") {
        return "Ask for the due month and year.";
      }
      return "Ask for birth month and year for each child. Invite them to list multiple.";
    }
    case OnboardingStep.INTERESTS:
      return "Ask for interests or hobbies for them or their kids. Allow 'none'.";
    case OnboardingStep.LOCATION: {
      const location = profile.location ?? inferredLocation;
      if (location) {
        const locationText = formatLocation(
          location.city,
          location.state_code,
          location.country_code
        );
        return `Confirm the inferred home location: ${locationText}. Ask if that's where they live.`;
      }
      return "Ask for their home city and state (where they live).";
    }
    case OnboardingStep.CONFIRM:
      return "Show the summary and ask if everything looks right. Invite corrections.";
    case OnboardingStep.COMPLETE:
      return "Let them know they’re all set, to sit tight while we find a local group, and that they’ll get an email once matched. Then invite questions or updates.";
    default:
      return "Ask the next most relevant onboarding question.";
  }
};

const isAgeOnlyResponse = (value?: string): boolean => {
  if (!value) return false;
  const text = value.toLowerCase();
  const agePattern =
    /\b(\d+)\s*(year|years|yr|yrs|month|months|mo|mos)\b/;
  const shortPattern =
    /\b(she|he|they|kid|child|daughter|son|baby)\s*(is|'s|’s|aged)\s*\d+\b/;
  return agePattern.test(text) || shortPattern.test(text);
};

const getLatestUserMessage = (history?: HistoryMessage[]): string | undefined => {
  if (!Array.isArray(history)) return undefined;
  for (let i = history.length - 1; i >= 0; i -= 1) {
    const msg = history[i];
    if (msg?.role === "user" && typeof msg.content === "string") {
      return msg.content;
    }
  }
  return undefined;
};

const inferNameFromHistory = (history?: HistoryMessage[]): string | undefined => {
  if (!Array.isArray(history)) return undefined;
  for (const msg of history) {
    if (msg?.role !== "user" || typeof msg.content !== "string") continue;
    const content = msg.content.trim();
    if (!content) continue;
    if (/\d/.test(content)) continue;
    if (content.split(/\s+/).length > 2) continue;
    if (/expecting|current|both|dad|kids|child/i.test(content)) continue;
    return normalizeName(content);
  }
  return undefined;
};

const toContents = (messages: HistoryMessage[]): { role: "user" | "model"; parts: { text: string }[] }[] => {
  return messages
    .filter((msg) => msg && (msg.role === "user" || msg.role === "agent"))
    .map((msg) => ({
      role: msg.role === "user" ? "user" : "model",
      parts: [{ text: msg.content }]
    }));
};

const getLastAssistantMessage = (messages: HistoryMessage[]): string | undefined => {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const msg = messages[i];
    if (msg?.role === "agent" && typeof msg.content === "string") {
      return msg.content;
    }
  }
  return undefined;
};

const getDedupedChildren = (
  existing: Child[],
  incoming: Child[],
  action?: "append" | "replace"
): Child[] => {
  if (action === "replace") {
    return incoming;
  }
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
    const normalizedStep = Object.values(OnboardingStep).includes(
      rawProfile.onboarding_step as OnboardingStep
    )
      ? (rawProfile.onboarding_step as OnboardingStep)
      : OnboardingStep.WELCOME;
    const profile: UserProfile = {
      ...rawProfile,
      onboarding_step: normalizedStep,
      children: Array.isArray(rawProfile.children) ? rawProfile.children : []
    };

    const latestUserMessage = getLatestUserMessage(history);
    if (!latestUserMessage) {
      throw new HttpsError("invalid-argument", "Latest user message missing");
    }

    const dbMessagesSnap = await admin
      .firestore()
      .collection("messages")
      .where("session_id", "==", sessionId)
      .orderBy("timestamp", "asc")
      .limit(CONFIG.validation.maxHistoryLength)
      .get();
    const dbMessages = dbMessagesSnap.docs.map((doc) => doc.data() as HistoryMessage);

    const contents = (() => {
      const fromDb = toContents(dbMessages);
      const lastDbMessage = dbMessages[dbMessages.length - 1];
      const shouldAppendLatest =
        !lastDbMessage ||
        lastDbMessage.role !== "user" ||
        lastDbMessage.content !== latestUserMessage;
      if (shouldAppendLatest) {
        fromDb.push({ role: "user", parts: [{ text: latestUserMessage }] });
      }
      const normalized = fromDb.length
        ? fromDb
        : [{ role: "user", parts: [{ text: latestUserMessage }] }];
      while (normalized.length && normalized[0].role === "model") {
        normalized.shift();
      }
      return normalized.length
        ? normalized
        : [{ role: "user", parts: [{ text: latestUserMessage }] }];
    })();

    const preHasName = !!profile.name;
    const preHasStatus = !!profile.dad_status;
    const preHasLocation =
      !!profile.location?.city && !!profile.location?.state_code;
    const preHasInterests = profile.interests !== undefined;
    const preHasChildren = profile.children?.length ? true : false;
    const preHasExpecting = profile.children?.some((child) => child.type === "expecting") ?? false;
    const preHasExisting = profile.children?.some((child) => child.type === "existing") ?? false;
    let preNeedsChildren = false;
    if (profile.dad_status === "both") {
      preNeedsChildren = !(preHasExpecting && preHasExisting);
    } else if (profile.dad_status === "expecting") {
      preNeedsChildren = !preHasExpecting && !preHasChildren;
    } else if (profile.dad_status === "current") {
      preNeedsChildren = !preHasExisting && !preHasChildren;
    } else {
      preNeedsChildren = !preHasChildren;
    }
    const expectedStep = !preHasName
      ? OnboardingStep.NAME
      : !preHasStatus
        ? OnboardingStep.STATUS
        : preNeedsChildren
          ? OnboardingStep.CHILD_INFO
          : !preHasInterests
            ? OnboardingStep.INTERESTS
            : !preHasLocation
              ? OnboardingStep.LOCATION
              : OnboardingStep.CONFIRM;

    const systemInstruction = [
      "You are the Dad Circles onboarding assistant. Be warm, friendly, and concise.",
      "Do not use markdown. Plain text only.",
      "Collect info in order: name, dad status, kids info, interests, home location confirmation, summary confirmation.",
      "Ask one question at a time unless the user already answered multiple items.",
      "If the user gives ages only (e.g. 'she is 2'), ask for birth month and year. Do not guess.",
      "For expecting kids, use the due month and year as birth_month and birth_year.",
      "If the user gives a due month without a year, record the month and mark the child as expecting; the system will confirm the year.",
      "If the user gives a relative due date (e.g. 'due in 2 months'), confirm the inferred month/year instead of guessing.",
      "If the user is both current and expecting, ask for existing kids' birth month/year and the due month/year.",
      "When asking about location, you are asking where they LIVE (their home city and state), not where they want to visit or travel.",
      "If location is inferred from postcode, ask the user to confirm their home city and state.",
      "Only mark onboarding complete after an explicit confirmation of the summary.",
      "Required for completion: name, dad status, at least one child with birth year, interests (can be empty), and home location (city + state where they live).",
      "Call record_profile_updates whenever you learn new info. Include all kids provided.",
      "If onboarding is already complete, answer questions and offer to update their details if needed.",
      "Avoid repeating the same sentence verbatim. If you need to re-ask, rephrase it.",
      "This response is used for data extraction; the final user-facing message will be generated separately.",
      `Today: ${new Date().toISOString().split("T")[0]}`,
      `Current step: ${profile.onboarding_step}`,
      `Next required step: ${expectedStep}`,
      `Current profile summary:\n${buildSummary(profile)}`
    ].join("\n");

    let functionCalls: any[] | undefined;
    try {
      const apiKey = geminiApiKey.value();
      if (!apiKey) {
        throw new HttpsError("failed-precondition", "Gemini API key not configured");
      }

      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: CONFIG.gemini.model,
        contents,
        config: {
          systemInstruction,
          temperature: CONFIG.gemini.temperature,
          maxOutputTokens: CONFIG.gemini.maxOutputTokens,
          tools: [{ functionDeclarations: [recordProfileUpdatesDeclaration] }],
          toolConfig: {
            functionCallingConfig: {
              mode: FunctionCallingConfigMode.AUTO
            }
          }
        }
      });
      functionCalls = response.functionCalls;
    } catch (error: any) {
      if (error instanceof HttpsError) {
        throw error;
      }
      logger.error("Gemini call failed", { sessionId, error: error?.message });
      throw new HttpsError("internal", "Gemini request failed");
    }

    let updates: Partial<UserProfile> = {};
    let childrenAction: "append" | "replace" | undefined;
    let profileConfirmed = false;
    let inferredDueDates: { month: number; year: number }[] | undefined;

    if (functionCalls && functionCalls.length) {
      for (const call of functionCalls) {
        if (call.name !== "record_profile_updates") {
          continue;
        }
        let args: any;
        try {
          args = typeof call.args === "string" ? JSON.parse(call.args) : call.args;
        } catch (error) {
          logger.warn("Failed to parse function call args", {
            sessionId,
            error: (error as Error)?.message
          });
          continue;
        }
        if (!args || typeof args !== "object") {
          continue;
        }
        const nextName = normalizeName(args.name);
        if (nextName) updates.name = nextName;
        if (args.dad_status) updates.dad_status = args.dad_status;
        const interests = normalizeInterests(args.interests);
        if (interests !== undefined) updates.interests = interests;
        const childNormalization = normalizeChildren(args.children);
        if (childNormalization.normalized) {
          updates.children = childNormalization.normalized;
        }
        if (childNormalization.inferredDueDates) {
          inferredDueDates = childNormalization.inferredDueDates;
          updates.children_complete = false;
        }
        if (typeof args.children_complete === "boolean") {
          updates.children_complete = args.children_complete;
        }
        const location = normalizeLocation(args.location);
        if (location) {
          updates.location = location;
        }
        if (args.children_action) {
          childrenAction = args.children_action;
        }
        if (args.profile_confirmed === true) profileConfirmed = true;
      }
    }

    let updatedProfile: UserProfile = {
      ...profile,
      ...updates
    };

    if (!updatedProfile.name) {
      const inferredName = inferNameFromHistory(history);
      if (inferredName) {
        updatedProfile.name = inferredName;
        updates.name = inferredName;
      }
    }

    if (updates.children) {
      updatedProfile.children = getDedupedChildren(
        profile.children || [],
        updates.children,
        childrenAction
      );
      updates.children = updatedProfile.children;
    }

    if (updates.interests) {
      if (updates.interests.length === 0) {
        updatedProfile.interests = [];
        updates.interests = [];
      } else {
        const existingInterests = profile.interests ?? [];
        const mergedInterests = Array.from(
          new Set([...existingInterests, ...updates.interests])
        );
        updatedProfile.interests = mergedInterests;
        updates.interests = mergedInterests;
      }
    }

    const hasName = !!updatedProfile.name;
    const hasStatus = !!updatedProfile.dad_status;
    const hasInterests = updatedProfile.interests !== undefined;

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const isExpecting = (child: Child): boolean => {
      if (child.type === "expecting") return true;
      if (child.type === "existing") return false;
      if (child.birth_year > currentYear) return true;
      if (child.birth_year === currentYear) {
        if (!child.birth_month) return false;
        return child.birth_month > currentMonth;
      }
      return false;
    };

    const hasExpectingChild = updatedProfile.children?.some(isExpecting) ?? false;
    const hasExistingChild = updatedProfile.children?.some((child) => !isExpecting(child)) ?? false;
    const hasChildren = updatedProfile.children?.length ? true : false;

    if (!updatedProfile.dad_status && hasChildren) {
      if (hasExpectingChild && hasExistingChild) {
        updatedProfile.dad_status = "both";
        updates.dad_status = "both";
      } else if (hasExpectingChild) {
        updatedProfile.dad_status = "expecting";
        updates.dad_status = "expecting";
      } else if (hasExistingChild) {
        updatedProfile.dad_status = "current";
        updates.dad_status = "current";
      }
    }

    if (!inferredDueDates && updatedProfile.dad_status === "expecting") {
      const hasYearInMessage = /\b(19|20)\d{2}\b/.test(latestUserMessage);
      const mentionsDue = /\bdue\b/i.test(latestUserMessage);
      const relative = parseRelativeMonthsFromText(latestUserMessage, now);
      if (relative && mentionsDue && !hasYearInMessage) {
        inferredDueDates = [{ month: relative.month, year: relative.year }];
      } else {
        const inferredMonth = parseMonthFromText(latestUserMessage);
        if (inferredMonth && mentionsDue && !hasYearInMessage) {
          const inferredYear = inferExpectingYear(inferredMonth, now);
          inferredDueDates = [{ month: inferredMonth, year: inferredYear }];
        }
      }
    }

    let needsChildren = false;
    if (updatedProfile.dad_status === "both") {
      needsChildren = !(hasExpectingChild && hasExistingChild);
    } else if (updatedProfile.dad_status === "expecting") {
      needsChildren = !hasExpectingChild;
    } else if (updatedProfile.dad_status === "current") {
      needsChildren = !hasExistingChild;
    } else {
      needsChildren = !hasChildren;
    }
    const needsDueDateConfirmation =
      !!inferredDueDates?.length &&
      profile.onboarding_step !== OnboardingStep.CONFIRM &&
      profile.onboarding_step !== OnboardingStep.COMPLETE;

    const readyForLocation = hasName && hasStatus && !needsChildren && hasInterests;
    let inferredLocation: UserLocation | null = null;
    if (readyForLocation && !updatedProfile.location && profile.postcode) {
      const locationInfo = await getLocationFromPostcode(profile.postcode);
      if (locationInfo) {
        inferredLocation = {
          city: locationInfo.city,
          state_code: locationInfo.stateCode,
          country_code: locationInfo.countryCode
        };
        updatedProfile.location = inferredLocation;
        updates.location = inferredLocation;
      }
    }

    const hasLocation =
      !!updatedProfile.location?.city && !!updatedProfile.location?.state_code;
    const userConfirmedLocation =
      profile.onboarding_step === OnboardingStep.LOCATION &&
      isAffirmative(latestUserMessage);
    const needsLocationConfirmation =
      readyForLocation &&
      !userConfirmedLocation &&
      profile.onboarding_step !== OnboardingStep.CONFIRM &&
      profile.onboarding_step !== OnboardingStep.COMPLETE;

    const allFieldsComplete =
      hasName &&
      hasStatus &&
      !needsChildren &&
      hasInterests &&
      hasLocation;

    const userConfirmedProfile =
      profileConfirmed ||
      (profile.onboarding_step === OnboardingStep.CONFIRM && isAffirmative(latestUserMessage));

    let nextStep: OnboardingStep = profile.onboarding_step;
    let shouldComplete = false;

    if (updatedProfile.onboarded) {
      nextStep = OnboardingStep.COMPLETE;
    } else if (!hasName) {
      nextStep = OnboardingStep.NAME;
    } else if (!hasStatus) {
      nextStep = OnboardingStep.STATUS;
    } else if (needsChildren || needsDueDateConfirmation) {
      nextStep = OnboardingStep.CHILD_INFO;
    } else if (!hasInterests) {
      nextStep = OnboardingStep.INTERESTS;
    } else if (needsLocationConfirmation) {
      nextStep = OnboardingStep.LOCATION;
    } else if (allFieldsComplete && userConfirmedProfile) {
      nextStep = OnboardingStep.COMPLETE;
      shouldComplete = true;
    } else {
      nextStep = OnboardingStep.CONFIRM;
    }

    if (shouldComplete) {
      updates.onboarded = true;
      updates.matching_eligible = true;
      if (updatedProfile.children_complete !== true) {
        updates.children_complete = true;
      }
      updatedProfile = { ...updatedProfile, ...updates };
    }

    const profileUpdatesForDb: Partial<UserProfile> = {
      ...updates,
      onboarding_step: nextStep,
      last_updated: FieldValue.serverTimestamp()
    };

    const profileUpdatesForClient: Partial<UserProfile> = {
      ...updates
    };

    const shouldWriteProfile =
      Object.keys(profileUpdatesForClient).length > 0 ||
      profile.onboarding_step !== nextStep ||
      (shouldComplete && !profile.onboarded);

    if (shouldWriteProfile) {
      await admin
        .firestore()
        .collection("profiles")
        .doc(sessionId)
        .set(profileUpdatesForDb, { merge: true });
    }

    const childInfoMissing =
      nextStep === OnboardingStep.CHILD_INFO &&
      (!updates.children || updates.children.length === 0) &&
      isAgeOnlyResponse(latestUserMessage);
    const nextQuestionHint = buildNextQuestionHint(
      nextStep,
      updatedProfile,
      inferredLocation,
      latestUserMessage,
      childInfoMissing,
      inferredDueDates
    );
    const lastAssistantMessage = getLastAssistantMessage(dbMessages);
    const locationText = updatedProfile.location
      ? formatLocation(
          updatedProfile.location.city,
          updatedProfile.location.state_code,
          updatedProfile.location.country_code
        )
      : inferredLocation
        ? formatLocation(
            inferredLocation.city,
            inferredLocation.state_code,
            inferredLocation.country_code
          )
        : undefined;

    let finalMessage = "";
    if (inferredDueDates?.length && nextStep === OnboardingStep.CHILD_INFO) {
      const first = inferredDueDates[0];
      const monthName = getMonthNameLong(first.month);
      finalMessage = `Just to confirm, did you mean ${monthName} ${first.year} for the due date?`;
    }

    if (!finalMessage) {
      try {
      const apiKey = geminiApiKey.value();
      if (!apiKey) {
        throw new HttpsError("failed-precondition", "Gemini API key not configured");
      }
      const ai = new GoogleGenAI({ apiKey });
      const messageInstruction = [
        "Generate the next message to the user.",
        "Plain text only. Be warm and concise.",
        "Ask exactly one clear question unless showing the confirmation summary.",
        "Do not repeat the same sentence verbatim; rephrase if re-asking.",
        "Always finish with complete sentences and end with punctuation.",
        "If the next step is CONFIRM, include the provided summary and end with a clear confirmation question.",
        `Today: ${new Date().toISOString().split("T")[0]}`,
        `Next step: ${nextStep}`,
        `Guidance: ${nextQuestionHint}`,
        lastAssistantMessage ? `Last assistant message: ${lastAssistantMessage}` : "",
        `Latest user message: ${latestUserMessage}`,
        locationText ? `Inferred location: ${locationText}` : "",
        nextStep === OnboardingStep.CONFIRM
          ? `Summary to present:\n${buildSummary(updatedProfile)}`
          : ""
      ]
        .filter(Boolean)
        .join("\n");

      const messageContents = [
        { role: "user" as const, parts: [{ text: latestUserMessage }] }
      ];
      const response = await ai.models.generateContent({
        model: CONFIG.gemini.model,
        contents: messageContents,
        config: {
          systemInstruction: messageInstruction,
          temperature: CONFIG.gemini.temperature,
          maxOutputTokens: CONFIG.gemini.maxOutputTokens
        }
      });
      const responseText =
        response.text ??
        response.candidates?.[0]?.content?.parts
          ?.map((part) => part.text ?? "")
          .join("");
      finalMessage = (responseText || "").trim();
      } catch (error: any) {
        logger.warn("Gemini message generation failed, falling back", {
          sessionId,
          error: error?.message
        });
      }
    }

    if (finalMessage && nextStep === OnboardingStep.CONFIRM) {
      const needsName = updatedProfile.name && !finalMessage.includes(updatedProfile.name);
      const needsLocation =
        locationText && !finalMessage.includes(locationText);
      const needsQuestion = !finalMessage.trim().endsWith("?");

      if (needsName || needsLocation || needsQuestion) {
        finalMessage = `Great, here's what I have:\n${buildSummary(updatedProfile)}\nDoes that look right?`;
      }
    }

    if (
      finalMessage &&
      nextStep !== OnboardingStep.CONFIRM &&
      nextStep !== OnboardingStep.COMPLETE
    ) {
      const trimmed = finalMessage.trim();
      if (trimmed && !/[?!.]$/.test(trimmed)) {
        finalMessage = `${trimmed}?`;
      }
    }

    if (!finalMessage) {
      finalMessage = buildFallbackMessage(nextStep, updatedProfile, inferredLocation);
    }

    if (shouldComplete) {
      finalMessage = COMPLETION_MESSAGE;
    }

    if (finalMessage && isLikelyTruncated(finalMessage)) {
      try {
        const apiKey = geminiApiKey.value();
        if (!apiKey) {
          throw new HttpsError("failed-precondition", "Gemini API key not configured");
        }
        const ai = new GoogleGenAI({ apiKey });
        const retryInstruction = [
          "Rewrite the assistant reply so it is complete and ends with punctuation.",
          "Keep it concise and on-topic.",
          "Plain text only.",
          `Next step: ${nextStep}`,
          nextStep === OnboardingStep.CONFIRM
            ? `Summary to present:\n${buildSummary(updatedProfile)}`
            : "",
          `Latest user message: ${latestUserMessage || ""}`
        ]
          .filter(Boolean)
          .join("\n");
        const retryResponse = await ai.models.generateContent({
          model: CONFIG.gemini.model,
          contents: [{ role: "user" as const, parts: [{ text: finalMessage }] }],
          config: {
            systemInstruction: retryInstruction,
            temperature: 0.2,
            maxOutputTokens: CONFIG.gemini.maxOutputTokens
          }
        });
        const retryText =
          retryResponse.text ??
          retryResponse.candidates?.[0]?.content?.parts
            ?.map((part) => part.text ?? "")
            .join("");
        if (retryText && !isLikelyTruncated(retryText)) {
          finalMessage = retryText.trim();
        }
      } catch (error: any) {
        logger.warn("Gemini retry for truncated message failed", {
          sessionId,
          error: error?.message
        });
      }
    }

    if (finalMessage && isLikelyTruncated(finalMessage)) {
      if (nextStep === OnboardingStep.COMPLETE) {
        finalMessage = COMPLETION_MESSAGE;
      } else {
        finalMessage = buildFallbackMessage(nextStep, updatedProfile, inferredLocation);
      }
    }

    logger.info("Gemini response generated", {
      sessionId,
      nextStep,
      updatedFields: Object.keys(profileUpdatesForClient),
      duration: Date.now() - startTime
    });

    return {
      message: finalMessage,
      profile_updates: profileUpdatesForClient,
      next_step: nextStep
    };
  }
);
