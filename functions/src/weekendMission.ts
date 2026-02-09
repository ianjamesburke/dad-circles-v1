import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { defineSecret } from "firebase-functions/params";
import { GoogleGenAI } from "@google/genai";
import { promises as fs } from "fs";
import * as path from "path";
import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { logger } from "./logger";
import { getLocationFromPostcode, formatLocation } from "./utils/location";
import { RateLimiter } from "./rateLimiter";
import { CONFIG } from "./config";

const geminiApiKey = defineSecret("GEMINI_API_KEY");
const MISSION_JOBS_COLLECTION = "mission_jobs";
const DEFAULT_MISSION_DURATION_HOURS = 2;

type MissionLifeStage = "expecting" | "newborn" | "infant" | "toddler";
type MissionBudget = "free" | "under_20" | "under_50" | "flexible";
type MissionEnvironment = "indoors" | "outdoors" | "either";
type MissionEventCategory = "local_dad_meetup" | "with_kids" | "without_kids";

interface MissionConstraints {
  budget: MissionBudget;
  environment: MissionEnvironment;
  notes?: string;
}

interface MissionRequest {
  postcode: string;
  life_stage: MissionLifeStage;
  interests: string[];
  constraints: MissionConstraints;
}

interface EventCandidate {
  title: string;
  date_time: string;
  category: MissionEventCategory;
  location_name: string;
  address: string;
  price: string;
  url: string;
  start_iso: string;
  end_iso: string;
  source?: string;
}

interface EventSelection extends EventCandidate {
  why_it_fits: string;
  safety_note: string;
}

interface MissionPlan {
  title: string;
  summary: string;
  agenda: Array<{ time: string; activity: string }>;
  icebreakers: string[];
  backup_plan: string;
  safety_constraints: string[];
  fit_reasoning: string[];
}

interface MissionReport {
  title: string;
  summary: string;
  local_context: string;
  official_meetup_plan: {
    should_launch: boolean;
    rationale: string;
    suggested_format: string;
    attendee_threshold: string;
  };
}

interface ReasoningSelection {
  url: string;
  category: MissionEventCategory;
  why_it_fits: string;
  safety_note: string;
}

interface ReasoningOutput {
  report: MissionReport;
  mission: MissionPlan;
  selections: ReasoningSelection[];
}

interface InternalMissionOutput {
  report: MissionReport;
  mission: MissionPlan;
  ideas: EventSelection[];
}

interface MissionCalendar {
  title: string;
  description: string;
  location: string;
}

const RESEARCH_SCHEMA = {
  type: "object",
  properties: {
    events: {
      type: "array",
      minItems: 3,
      maxItems: 5,
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          date_time: { type: "string" },
          category: {
            type: "string",
            enum: ["local_dad_meetup", "with_kids", "without_kids"]
          },
          location_name: { type: "string" },
          price: { type: "string" },
          url: { type: "string" },
          start_iso: { type: "string" },
          end_iso: { type: "string" }
        },
        required: [
          "title",
          "date_time",
          "category",
          "location_name",
          "price",
          "url",
          "start_iso",
          "end_iso"
        ]
      }
    }
  },
  required: ["events"],
  additionalProperties: false
};

const REASONING_SCHEMA = {
  type: "object",
  properties: {
    report: {
      type: "object",
      properties: {
        title: { type: "string" },
        summary: { type: "string" },
        local_context: { type: "string" },
        official_meetup_plan: {
          type: "object",
          properties: {
            should_launch: { type: "boolean" },
            rationale: { type: "string" },
            suggested_format: { type: "string" },
            attendee_threshold: { type: "string" }
          },
          required: [
            "should_launch",
            "rationale",
            "suggested_format",
            "attendee_threshold"
          ],
          additionalProperties: false
        }
      },
      required: ["title", "summary", "local_context", "official_meetup_plan"],
      additionalProperties: false
    },
    selections: {
      type: "array",
      minItems: 3,
      maxItems: 9,
      items: {
        type: "object",
        properties: {
          url: { type: "string" },
          category: {
            type: "string",
            enum: ["local_dad_meetup", "with_kids", "without_kids"]
          },
          why_it_fits: { type: "string" },
          safety_note: { type: "string" }
        },
        required: [
          "url",
          "category",
          "why_it_fits",
          "safety_note"
        ]
      }
    },
    mission: {
      type: "object",
      properties: {
        title: { type: "string" },
        summary: { type: "string" },
        agenda: {
          type: "array",
          minItems: 3,
          maxItems: 6,
          items: {
            type: "object",
            properties: {
              time: { type: "string" },
              activity: { type: "string" }
            },
            required: ["time", "activity"]
          }
        },
        icebreakers: {
          type: "array",
          minItems: 2,
          maxItems: 5,
          items: { type: "string" }
        },
        backup_plan: { type: "string" },
        safety_constraints: {
          type: "array",
          minItems: 2,
          maxItems: 6,
          items: { type: "string" }
        },
        fit_reasoning: {
          type: "array",
          minItems: 2,
          maxItems: 5,
          items: { type: "string" }
        }
      },
      required: [
        "title",
        "summary",
        "agenda",
        "icebreakers",
        "backup_plan",
        "safety_constraints",
        "fit_reasoning"
      ],
      additionalProperties: false
    }
  },
  required: ["report", "selections", "mission"],
  additionalProperties: false
};

const INTERNAL_RESEARCH_SCHEMA = {
  type: "object",
  properties: {
    report: REASONING_SCHEMA.properties.report,
    mission: REASONING_SCHEMA.properties.mission,
    ideas: {
      type: "array",
      minItems: 6,
      maxItems: 6,
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          date_time: { type: "string" },
          category: {
            type: "string",
            enum: ["local_dad_meetup", "with_kids", "without_kids"]
          },
          location_name: { type: "string" },
          address: { type: "string" },
          price: { type: "string" },
          url: { type: "string" },
          start_iso: { type: "string" },
          end_iso: { type: "string" },
          why_it_fits: { type: "string" },
          safety_note: { type: "string" },
          source: { type: "string" }
        },
        required: [
          "title",
          "date_time",
          "category",
          "location_name",
          "address",
          "price",
          "url",
          "start_iso",
          "end_iso",
          "why_it_fits",
          "safety_note"
        ]
      }
    }
  },
  required: ["report", "mission", "ideas"],
  additionalProperties: false
};

const LIFE_STAGE_LABELS: Record<MissionLifeStage, string> = {
  expecting: "Expecting dads",
  newborn: "Newborn dads",
  infant: "Infant dads",
  toddler: "Toddler dads"
};

const BUDGET_LABELS: Record<MissionBudget, string> = {
  free: "Free only",
  under_20: "Under $20 per adult",
  under_50: "Under $50 per adult",
  flexible: "Flexible budget"
};

const ENVIRONMENT_LABELS: Record<MissionEnvironment, string> = {
  indoors: "Indoors",
  outdoors: "Outdoors",
  either: "Either indoors or outdoors"
};

const getUpcomingSaturday = (now: Date = new Date()): Date => {
  const date = new Date(now);
  let diff = (6 - date.getDay() + 7) % 7;
  if (diff === 0) {
    diff = 7;
  }
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
};

const getDefaultMissionWindow = () => {
  const base = getUpcomingSaturday();
  const start = new Date(base);
  start.setHours(10, 0, 0, 0);
  const end = new Date(start);
  end.setHours(start.getHours() + DEFAULT_MISSION_DURATION_HOURS);
  return { start, end };
};

const formatEventDay = (date: Date): string =>
  date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric"
  });

const parseIsoDate = (value: string): Date | null => {
  const parsed = new Date(value);
  if (!value || Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
};

const getEventTimeWindow = (
  event: Pick<EventCandidate, "start_iso" | "end_iso">,
  index: number
): { start: Date; end: Date } => {
  const startFromIso = parseIsoDate(event.start_iso);
  const endFromIso = parseIsoDate(event.end_iso);
  if (startFromIso && endFromIso && endFromIso.getTime() > startFromIso.getTime()) {
    return { start: startFromIso, end: endFromIso };
  }

  const base = getUpcomingSaturday();
  const start = new Date(base);
  start.setHours(10 + index * 2, 0, 0, 0);
  const end = new Date(start);
  end.setHours(start.getHours() + DEFAULT_MISSION_DURATION_HOURS);
  return { start, end };
};

const normalizePostcode = (postcode: string): string => postcode.trim().replace(/\s+/g, "");

const cleanInterests = (interests: string[]): string[] => {
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const interest of interests) {
    const item = String(interest || "").trim();
    if (!item) continue;
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push(item);
    if (normalized.length >= 8) break;
  }
  return normalized;
};

const clampText = (value: string, maxLen: number): string => {
  const normalized = String(value || "").trim().replace(/\s+/g, " ");
  if (normalized.length <= maxLen) return normalized;
  return normalized.slice(0, Math.max(0, maxLen - 1)).trimEnd() + "…";
};

const sanitizeResearchUrl = (value: string): string => {
  const raw = String(value || "").trim();
  if (!/^https?:\/\//i.test(raw)) return "";
  try {
    const parsed = new URL(raw);
    parsed.hash = "";
    // Remove huge tracking query strings that blow token budget.
    parsed.search = "";
    return parsed.toString();
  } catch {
    return raw.slice(0, 220);
  }
};

const extractUrls = (text: string, max: number): string[] => {
  const seen = new Set<string>();
  const matches = text.match(/https?:\/\/[^\s)]+/g) || [];
  const urls: string[] = [];

  for (const match of matches) {
    const sanitized = sanitizeResearchUrl(match);
    if (!sanitized || seen.has(sanitized)) continue;
    seen.add(sanitized);
    urls.push(sanitized);
    if (urls.length >= max) break;
  }

  return urls;
};

const resolveResearchDocPath = async (): Promise<string> => {
  const configured = String(CONFIG.mission.internalResearchDocumentPath || "").trim();
  if (!configured) {
    throw new HttpsError("failed-precondition", "Internal research document path is not configured.");
  }

  const candidates = path.isAbsolute(configured)
    ? [configured]
    : [
      path.resolve(process.cwd(), configured),
      path.resolve(process.cwd(), "..", configured),
      path.resolve(__dirname, "..", "..", configured),
      path.resolve(__dirname, "..", "..", "..", configured)
    ];

  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // Continue checking remaining candidates.
    }
  }

  throw new HttpsError("failed-precondition", `Internal research document not found: ${configured}`);
};

const readInternalResearchDocument = async (): Promise<string> => {
  const absolutePath = await resolveResearchDocPath();
  try {
    const content = await fs.readFile(absolutePath, "utf8");
    const normalized = String(content || "").trim();
    if (!normalized) {
      throw new HttpsError("failed-precondition", `Internal research document is empty: ${absolutePath}`);
    }
    return normalized;
  } catch (error: any) {
    logger.error("Weekend mission internal research read failed", {
      path: absolutePath,
      error: error?.message
    });
    throw new HttpsError("failed-precondition", "Internal research document is unavailable.");
  }
};

const normalizeJsonText = (raw: string): string => {
  let normalized = raw.trim();
  if (normalized.startsWith("```")) {
    normalized = normalized
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
  }
  return normalized;
};

const sleep = async (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const parseGeminiError = (error: any): { status?: number; code?: string; message: string } => {
  const rawMessage = String(error?.message || "");
  const directStatus = Number(error?.status ?? error?.code ?? 0) || undefined;
  const directCode = typeof error?.status === "string" ? error.status : undefined;

  try {
    const parsed = JSON.parse(rawMessage);
    const nested = parsed?.error || {};
    const status = Number(nested.code || directStatus || 0) || undefined;
    const code = String(nested.status || directCode || "").trim() || undefined;
    const message = String(nested.message || rawMessage);
    return { status, code, message };
  } catch {
    return { status: directStatus, code: directCode, message: rawMessage };
  }
};

const isInvalidArgumentError = (error: any): boolean => {
  const parsed = parseGeminiError(error);
  return parsed.status === 400 || parsed.code === "INVALID_ARGUMENT";
};

const isHighDemand503Error = (error: any): boolean => {
  const parsed = parseGeminiError(error);
  const message = parsed.message.toLowerCase();
  return parsed.status === 503 || parsed.code === "UNAVAILABLE" || message.includes("high demand");
};

const isModelUnavailableError = (error: any): boolean => {
  const parsed = parseGeminiError(error);
  const message = parsed.message.toLowerCase();
  return parsed.status === 404 || message.includes("not found") || message.includes("unknown model");
};

const getResponseText = (response: any): string => {
  if (typeof response?.text === "string" && response.text.trim()) {
    return response.text;
  }

  const parts = response?.candidates?.[0]?.content?.parts;
  if (Array.isArray(parts)) {
    const text = parts
      .map((part: any) => (typeof part?.text === "string" ? part.text : ""))
      .join("")
      .trim();
    if (text) {
      return text;
    }
  }

  return "";
};

const isRetryableGeminiError = (error: any): boolean => {
  const parsed = parseGeminiError(error);
  const status = Number(parsed.status ?? 0);
  if (status === 429 || status >= 500) return true;
  const message = parsed.message.toLowerCase();
  return message.includes("rate limit") || message.includes("unavailable") || message.includes("timeout");
};

const callGeminiWithRetry = async (
  ai: GoogleGenAI,
  params: Parameters<GoogleGenAI["models"]["generateContent"]>[0],
  label: string,
  maxAttempts: number = 3
) => {
  let attempt = 0;
  let lastError: any;

  while (attempt < maxAttempts) {
    attempt += 1;
    try {
      return await ai.models.generateContent(params);
    } catch (error: any) {
      lastError = error;
      if (isInvalidArgumentError(error) || isHighDemand503Error(error)) {
        throw error;
      }
      if (!isRetryableGeminiError(error) || attempt >= maxAttempts) {
        throw error;
      }
      const delayMs = Math.min(3000, 350 * (2 ** (attempt - 1)));
      const parsed = parseGeminiError(error);
      logger.warn("Weekend mission Gemini retry", {
        label,
        attempt,
        maxAttempts,
        delayMs,
        status: parsed.status,
        code: parsed.code,
        message: parsed.message
      });
      await sleep(delayMs);
    }
  }

  throw lastError || new Error(`${label}: Gemini request failed`);
};

const generateWithModelFallback = async (
  ai: GoogleGenAI,
  options: {
    label: string;
    models: readonly string[];
    timeoutMs: number;
    buildParams: (model: string) => Parameters<GoogleGenAI["models"]["generateContent"]>[0];
  }
) => {
  let lastError: any;
  for (const model of options.models) {
    try {
      return await withTimeout(
        callGeminiWithRetry(ai, options.buildParams(model), `${options.label}:${model}`),
        options.timeoutMs,
        `${options.label}:${model}`
      );
    } catch (error: any) {
      lastError = error;
      const parsed = parseGeminiError(error);
      logger.warn("Weekend mission Gemini model failed", {
        label: options.label,
        model,
        status: parsed.status,
        code: parsed.code,
        message: parsed.message
      });
    }
  }
  throw lastError || new Error(`${options.label}: all model attempts failed`);
};

const resolveAvailableModels = async (
  ai: GoogleGenAI,
  label: "research" | "reasoning",
  candidates: readonly string[],
  timeoutMs: number
): Promise<string[]> => {
  const available: string[] = [];

  for (const model of candidates) {
    try {
      await withTimeout(ai.models.get({ model }), Math.min(5000, timeoutMs), `${label}_model_check:${model}`);
      available.push(model);
    } catch (error: any) {
      const parsed = parseGeminiError(error);
      if (isModelUnavailableError(error) || isInvalidArgumentError(error)) {
        logger.warn("Weekend mission model excluded during preflight", {
          label,
          model,
          status: parsed.status,
          code: parsed.code,
          message: parsed.message
        });
        continue;
      }

      // Keep transiently failing models in rotation.
      logger.warn("Weekend mission model preflight transient error", {
        label,
        model,
        status: parsed.status,
        code: parsed.code,
        message: parsed.message
      });
      available.push(model);
    }
  }

  return available;
};

const parseStructuredResponse = <T>(response: any, label: string): T => {
  const rawText = getResponseText(response);
  const text = normalizeJsonText(rawText);
  const candidate = response?.candidates?.[0];
  const finishReason = candidate?.finishReason;
  const finishMessage = candidate?.finishMessage;
  const tokenCount = candidate?.tokenCount;

  if (!text) {
    throw new Error(`${label}: Empty structured response`);
  }

  try {
    return JSON.parse(text) as T;
  } catch (error: any) {
    logger.error("Weekend mission JSON parse failed", {
      label,
      error: error?.message,
      finishReason,
      finishMessage,
      tokenCount,
      preview: text.slice(0, 400)
    });
    if (finishReason === "MAX_TOKENS") {
      throw new Error(`${label}: Structured response exceeded maxOutputTokens`);
    }
    throw new Error(`${label}: Invalid JSON response`);
  }
};

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> => {
  if (timeoutMs <= 0) {
    throw new Error(`${label}: No time budget remaining`);
  }

  let timeoutId: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${label}: Timed out after ${timeoutMs}ms`)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};

const escapeIcsText = (value: string): string =>
  value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");

const toIcsDateTime = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  const second = String(date.getSeconds()).padStart(2, "0");
  return `${year}${month}${day}T${hour}${minute}${second}`;
};

const toUtcIcsDateTime = (date: Date): string => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hour = String(date.getUTCHours()).padStart(2, "0");
  const minute = String(date.getUTCMinutes()).padStart(2, "0");
  const second = String(date.getUTCSeconds()).padStart(2, "0");
  return `${year}${month}${day}T${hour}${minute}${second}Z`;
};

const createIcsInvite = (
  calendar: MissionCalendar,
  start: Date,
  end: Date
): { filename: string; ics: string } => {
  const uid = `mission-${start.getTime()}@dadcircles.com`;
  const stamp = toUtcIcsDateTime(new Date());
  const dtStart = toUtcIcsDateTime(start);
  const dtEnd = toUtcIcsDateTime(end);
  const datePart = toIcsDateTime(start).slice(0, 8);

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "CALSCALE:GREGORIAN",
    "PRODID:-//DadCircles//Weekend Mission//EN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${escapeIcsText(calendar.title)}`,
    `LOCATION:${escapeIcsText(calendar.location)}`,
    `DESCRIPTION:${escapeIcsText(calendar.description)}`,
    "END:VEVENT",
    "END:VCALENDAR"
  ];

  return {
    filename: `dad-circles-weekend-mission-${datePart}.ics`,
    ics: `${lines.join("\r\n")}\r\n`
  };
};

const getIpAddress = (request: any): string => {
  const raw = request?.rawRequest;
  const ip = raw?.ip || raw?.headers?.["x-forwarded-for"] || "unknown";
  return String(ip).split(",")[0].trim();
};

const normalizeMissionRequest = (data: MissionRequest | undefined): MissionRequest => {
  if (!data || typeof data !== "object") {
    throw new HttpsError("invalid-argument", "Request data is required");
  }

  const postcode = normalizePostcode(String(data.postcode || ""));
  const lifeStage = data.life_stage;
  const interests = cleanInterests(Array.isArray(data.interests) ? data.interests : []);

  const constraints = data.constraints || ({} as MissionConstraints);
  const budget = constraints.budget;
  const environment = constraints.environment;
  const notes = String(constraints.notes || "").trim();

  if (!/^\d{4,5}$/.test(postcode)) {
    throw new HttpsError("invalid-argument", "Please enter a valid US or AU postcode.");
  }

  if (!lifeStage || !(lifeStage in LIFE_STAGE_LABELS)) {
    throw new HttpsError("invalid-argument", "life_stage must be one of expecting/newborn/infant/toddler.");
  }

  if (!budget || !(budget in BUDGET_LABELS)) {
    throw new HttpsError("invalid-argument", "constraints.budget is invalid.");
  }

  if (!environment || !(environment in ENVIRONMENT_LABELS)) {
    throw new HttpsError("invalid-argument", "constraints.environment is invalid.");
  }

  if (notes.length > 500) {
    throw new HttpsError("invalid-argument", "constraints.notes must be 500 characters or less.");
  }

  return {
    postcode,
    life_stage: lifeStage,
    interests,
    constraints: {
      budget,
      environment,
      ...(notes ? { notes } : {})
    }
  };
};

const normalizeInternalIdeas = (
  ideas: EventSelection[],
  locationText: string
): EventSelection[] => {
  const categoryOrder: MissionEventCategory[] = [
    "local_dad_meetup",
    "with_kids",
    "without_kids"
  ];
  const byCategory = new Map<MissionEventCategory, EventSelection[]>();

  // Initialize empty arrays for each category
  for (const category of categoryOrder) {
    byCategory.set(category, []);
  }

  // Collect up to 2 events per category
  for (const raw of ideas || []) {
    const url = sanitizeResearchUrl(raw?.url || "");
    if (!url) continue;
    const category = categoryOrder.includes(raw.category) ? raw.category : "with_kids";
    const categoryEvents = byCategory.get(category)!;
    
    // Only add if we don't have 2 events for this category yet
    if (categoryEvents.length < 2) {
      categoryEvents.push({
        title: clampText(raw?.title || "Local dad activity", 120),
        date_time: clampText(raw?.date_time || "Weekend option", 120),
        category,
        location_name: clampText(raw?.location_name || locationText, 100),
        address: clampText(raw?.address || raw?.location_name || locationText, 160),
        price: clampText(raw?.price || "Varies", 40),
        url,
        start_iso: String(raw?.start_iso || "").trim(),
        end_iso: String(raw?.end_iso || "").trim(),
        source: clampText(raw?.source || "", 120),
        why_it_fits: clampText(raw?.why_it_fits || "Matches this group's constraints and interests.", 220),
        safety_note: clampText(raw?.safety_note || "Confirm details before leaving and use public meetup points.", 220)
      });
    }
  }

  const normalized: EventSelection[] = [];
  
  // Add events from each category, ensuring we have at least 2 per category
  for (const category of categoryOrder) {
    const categoryEvents = byCategory.get(category)!;
    
    // Add existing events
    normalized.push(...categoryEvents);
    
    // Fill in fallbacks if we don't have 2 events for this category
    while (categoryEvents.length < 2) {
      const fallbackIndex = categoryEvents.length + 1;
      normalized.push({
        title: category === "local_dad_meetup" 
          ? `Local dad meetup option ${fallbackIndex}` 
          : category === "with_kids" 
          ? `Kid-friendly activity ${fallbackIndex}` 
          : `Dad-only activity ${fallbackIndex}`,
        date_time: "Weekend slot (confirm with source)",
        category,
        location_name: locationText,
        address: locationText,
        price: "Varies",
        url: "https://www.google.com/search?q=ann+arbor+dad+activities",
        start_iso: "",
        end_iso: "",
        why_it_fits: "Good fit for this life stage and weekend constraints.",
        safety_note: "Use public spaces and confirm schedule before arrival.",
        source: "internal_research_fallback"
      });
      categoryEvents.push(normalized[normalized.length - 1]);
    }
  }

  return normalized.slice(0, CONFIG.mission.internalIdeaCount);
};

const buildMissionResponse = (
  params: {
    location: { city: string; stateCode: string; countryCode: string };
    postcode: string;
    locationText: string;
    dayLabel: string;
    report: MissionReport;
    mission: MissionPlan;
    events: EventSelection[];
  }
) => {
  const { start, end } = getDefaultMissionWindow();
  const withInvites = params.events.map((event, index) => {
    const eventWindow = getEventTimeWindow(event, index);
    return {
      ...event,
      calendar_invite: createIcsInvite(
        {
          title: event.title,
          description: `${event.date_time}\n${event.why_it_fits}\n${event.url}`,
          location: event.location_name || params.locationText
        },
        eventWindow.start,
        eventWindow.end
      )
    };
  });

  const sections = {
    local_dad_meetups: withInvites.filter((event) => event.category === "local_dad_meetup"),
    things_to_do_with_kids: withInvites.filter((event) => event.category === "with_kids"),
    things_to_do_without_kids: withInvites.filter((event) => event.category === "without_kids")
  };

  const firstEvent = withInvites[0];
  const invite = createIcsInvite(
    {
      title: params.mission.title,
      description: `${params.mission.summary}\n\nFirst option: ${firstEvent.title} (${firstEvent.url})`,
      location: firstEvent.location_name || params.locationText
    },
    start,
    end
  );

  const emailBody = [
    "Hey team,",
    "",
    `Here is our Weekend Mission for ${params.dayLabel}:`,
    `${params.mission.title}`,
    "",
    params.mission.summary,
    "",
    "Agenda:",
    ...params.mission.agenda.map((item) => `- ${item.time}: ${item.activity}`),
    "",
    "Top options:",
    ...withInvites.slice(0, 3).map(
      (event, index) => `${index + 1}. ${event.title} (${event.price}) - ${event.url}\n   Why: ${event.why_it_fits}`
    ),
    "",
    "Safety checks:",
    ...params.mission.safety_constraints.map((item) => `- ${item}`),
    "",
    "Reply-all with your vote and we'll lock it in.",
    "",
    "- DadCircles"
  ].join("\n");

  return {
    location: {
      city: params.location.city,
      state_code: params.location.stateCode,
      country_code: params.location.countryCode,
      postcode: params.postcode
    },
    events: withInvites,
    sections,
    report: params.report,
    mission: params.mission,
    email: {
      subject: `DadCircles Weekend Mission: ${params.mission.title}`,
      body: emailBody
    },
    calendar_invite: invite,
    generated_at: new Date().toISOString()
  };
};

const runInternalResearchMissionGeneration = async (params: {
  ai: GoogleGenAI;
  input: MissionRequest;
  location: { city: string; stateCode: string; countryCode: string };
  locationText: string;
  dayLabel: string;
  timeRemainingMs: () => number;
}) => {
  const researchDoc = await readInternalResearchDocument();
  const topSources = extractUrls(researchDoc, 20);

  const prompt = [
    "You are the DadCircles mission curator.",
    "Use the internal research document as your primary source of ideas.",
    "Personalize to the input profile and constraints.",
    "Still use Google Search grounding to verify freshness and prefer live URLs.",
    "Return exactly 6 ideas total: 2 per category (local_dad_meetup, with_kids, without_kids).",
    "Each category should have 2 distinct, high-quality options that offer variety.",
    "Each idea should be practical, local-feeling, and include cost, logistics, why_it_fits, and safety_note.",
    "Keep response concise and structured.",
    `Location: ${params.locationText}`,
    `Postcode: ${params.input.postcode}`,
    `Target group: ${LIFE_STAGE_LABELS[params.input.life_stage]}`,
    `Interests: ${params.input.interests.length ? params.input.interests.join(", ") : "General social connection"}`,
    `Target weekend: ${params.dayLabel} onward`,
    `Budget: ${BUDGET_LABELS[params.input.constraints.budget]}`,
    `Environment preference: ${ENVIRONMENT_LABELS[params.input.constraints.environment]}`,
    params.input.constraints.notes ? `Additional constraints: ${params.input.constraints.notes}` : "",
    topSources.length
      ? `Reference links found in research document:\n${topSources.map((url) => `- ${url}`).join("\n")}`
      : "",
    "Internal research document:",
    researchDoc.slice(0, 45000)
  ]
    .filter(Boolean)
    .join("\n\n");

  const response = await generateWithModelFallback(params.ai, {
    label: "internal_research",
    models: CONFIG.mission.internalModels,
    timeoutMs: Math.min(CONFIG.mission.researchTimeoutMs, Math.max(6000, params.timeRemainingMs() - 8000)),
    buildParams: (model) => ({
      model,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        maxOutputTokens: CONFIG.mission.researchMaxOutputTokens,
        responseMimeType: "application/json",
        responseJsonSchema: INTERNAL_RESEARCH_SCHEMA,
        tools: [{ googleSearch: {} }]
      }
    })
  }).catch(async (error: any) => {
    if (!isInvalidArgumentError(error)) {
      throw error;
    }

    logger.warn("Weekend mission internal research fallback without schema", {
      status: parseGeminiError(error).status,
      code: parseGeminiError(error).code
    });

    return generateWithModelFallback(params.ai, {
      label: "internal_research_fallback",
      models: CONFIG.mission.internalModels,
      timeoutMs: Math.min(CONFIG.mission.researchTimeoutMs, Math.max(6000, params.timeRemainingMs() - 8000)),
      buildParams: (model) => ({
        model,
        contents: [{ role: "user", parts: [{ text: `${prompt}\n\nReturn only JSON.` }] }],
        config: {
          maxOutputTokens: CONFIG.mission.researchMaxOutputTokens,
          tools: [{ googleSearch: {} }]
        }
      })
    });
  });

  const structured = parseStructuredResponse<InternalMissionOutput>(response, "internal_research");
  const selectedEvents = normalizeInternalIdeas(structured.ideas || [], params.locationText);
  if (selectedEvents.length < 6) {
    throw new HttpsError("failed-precondition", "Unable to build 6 internal research ideas (2 per category).");
  }

  return buildMissionResponse({
    location: params.location,
    postcode: params.input.postcode,
    locationText: params.locationText,
    dayLabel: params.dayLabel,
    report: structured.report,
    mission: structured.mission,
    events: selectedEvents
  });
};

const runMissionGeneration = async (
  input: MissionRequest,
  options: { applyRateLimit: boolean; ipAddress?: string }
) => {
  const startedAt = Date.now();
  const timeRemainingMs = (): number => CONFIG.mission.requestBudgetMs - (Date.now() - startedAt);

  const postcode = input.postcode;
  const lifeStage = input.life_stage;
  const interests = input.interests;
  const budget = input.constraints.budget;
  const environment = input.constraints.environment;
  const notes = String(input.constraints.notes || "").trim();

  if (options.applyRateLimit) {
    const rateLimitIdentifier = `${options.ipAddress || "unknown"}:${postcode}`;
    const rateLimitCheck = await RateLimiter.checkWeekendMissionRequest(rateLimitIdentifier);
    if (!rateLimitCheck.allowed) {
      throw new HttpsError("resource-exhausted", rateLimitCheck.reason || "Too many requests.");
    }
  }

  const location = await getLocationFromPostcode(postcode);
  if (!location) {
    throw new HttpsError("invalid-argument", "We couldn't resolve that postcode. Please double-check it.");
  }

  const locationText = formatLocation(location.city, location.stateCode, location.countryCode);
  const { start, end } = getDefaultMissionWindow();
  const dayLabel = formatEventDay(start);

  const apiKey = geminiApiKey.value();
  if (!apiKey) {
    throw new HttpsError("failed-precondition", "Gemini API key is not configured");
  }

  const ai = new GoogleGenAI({ apiKey });

  if (CONFIG.mission.useInternalResearchDocument) {
    const result = await runInternalResearchMissionGeneration({
      ai,
      input,
      location: {
        city: location.city,
        stateCode: location.stateCode,
        countryCode: location.countryCode
      },
      locationText,
      dayLabel,
      timeRemainingMs
    });

    logger.info("Weekend mission generated (internal research)", {
      postcode,
      location: locationText,
      lifeStage,
      durationMs: Date.now() - startedAt,
      eventCount: result.events.length,
      sourcePath: CONFIG.mission.internalResearchDocumentPath
    });

    return result;
  }

  const researchModels = await resolveAvailableModels(
    ai,
    "research",
    CONFIG.mission.researchModels,
    Math.max(5000, Math.min(20000, timeRemainingMs() - 20000))
  );
  const reasoningModels = await resolveAvailableModels(
    ai,
    "reasoning",
    CONFIG.mission.reasoningModels,
    Math.max(5000, Math.min(20000, timeRemainingMs() - 12000))
  );

  if (researchModels.length === 0 || reasoningModels.length === 0) {
    throw new HttpsError(
      "failed-precondition",
      "No compatible Gemini mission models are available right now. Please retry shortly."
    );
  }

  const researchDiscoveryPrompt = [
    "You are an events researcher for DadCircles.",
    "Use Google Search grounding to find real, public options only.",
    "Do not invent venues, dates, or links.",
    "Prioritize these recurring anchors when available: Home Depot Kids Workshops, Lowe's Kids Workshops, library storytimes, parent-child maker sessions, and dad groups.",
    "Return concise research notes with clear source links and specific date/time details.",
    "Each option must include: title, category (local_dad_meetup | with_kids | without_kids), location name, street/city text, price text, start/end timestamps with timezone if available, and source URL.",
    "Find 3-5 realistic options across the upcoming weekend and near-future recurring schedules.",
    `Location: ${locationText}`,
    `Postcode: ${postcode}`,
    `Target group: ${LIFE_STAGE_LABELS[lifeStage]}`,
    `Interests: ${interests.length ? interests.join(", ") : "General social connection"}`,
    `Target weekend: ${dayLabel} onward`,
    `Budget: ${BUDGET_LABELS[budget]}`,
    `Environment preference: ${ENVIRONMENT_LABELS[environment]}`,
    notes ? `Additional constraints: ${notes}` : ""
  ]
    .filter(Boolean)
    .join("\n");

  const researchDiscoveryResponse = await generateWithModelFallback(ai, {
    label: "research_discovery",
    models: researchModels,
    timeoutMs: Math.min(CONFIG.mission.researchTimeoutMs, Math.max(6000, timeRemainingMs() - 20000)),
    buildParams: (model) => ({
      model,
      contents: [{ role: "user", parts: [{ text: researchDiscoveryPrompt }] }],
      config: {
        maxOutputTokens: CONFIG.mission.researchMaxOutputTokens,
        tools: [{ googleSearch: {} }]
      }
    })
  });

  const researchDiscoveryText = getResponseText(researchDiscoveryResponse).trim();
  if (!researchDiscoveryText) {
    throw new HttpsError("failed-precondition", "Grounded research returned an empty result.");
  }

  const researchStructuringPrompt = [
    "Convert these grounded research notes into strict JSON.",
    "Only include options that have real source URLs.",
    "Use category values exactly: local_dad_meetup, with_kids, without_kids.",
    "Return exactly 3-5 events total, and keep each text field concise.",
    "Ensure at least one event exists in each category.",
    "Use direct publisher URLs where possible and omit tracking parameters.",
    "Normalize start_iso and end_iso to ISO-8601. If source lacks precise times, infer a plausible local time and note uncertainty in date_time text.",
    "Return only JSON and no prose.",
    "Grounded notes:",
    researchDiscoveryText
  ].join("\n\n");

  const researchStructuredResponse = await generateWithModelFallback(ai, {
    label: "research_structured",
    models: researchModels,
    timeoutMs: Math.min(CONFIG.mission.researchTimeoutMs, Math.max(6000, timeRemainingMs() - 12000)),
    buildParams: (model) => ({
      model,
      contents: [{ role: "user", parts: [{ text: researchStructuringPrompt }] }],
      config: {
        maxOutputTokens: CONFIG.mission.researchMaxOutputTokens,
        responseMimeType: "application/json",
        responseJsonSchema: RESEARCH_SCHEMA
      }
    })
  }).catch(async (error: any) => {
    if (!isInvalidArgumentError(error)) {
      throw error;
    }

    logger.warn("Weekend mission research structuring fallback without schema", {
      status: parseGeminiError(error).status,
      code: parseGeminiError(error).code
    });

    return generateWithModelFallback(ai, {
      label: "research_structured_fallback",
      models: researchModels,
      timeoutMs: Math.min(CONFIG.mission.researchTimeoutMs, Math.max(6000, timeRemainingMs() - 10000)),
      buildParams: (model) => ({
        model,
        contents: [{ role: "user", parts: [{ text: `${researchStructuringPrompt}\n\nReturn only JSON.` }] }],
        config: {
          maxOutputTokens: CONFIG.mission.researchMaxOutputTokens
        }
      })
    });
  });
  let research: { events: EventCandidate[] };
  try {
    research = parseStructuredResponse<{ events: EventCandidate[] }>(researchStructuredResponse, "research");
  } catch (error: any) {
    if (!String(error?.message || "").includes("exceeded maxOutputTokens")) {
      throw error;
    }

    const recoveryPrompt = [
      researchStructuringPrompt,
      "Recovery mode: response was truncated previously.",
      "Output must be compact JSON only.",
      "Cap output to exactly 3 events (one per category).",
      "Keep date_time and title very short."
    ].join("\n\n");

    const recoveryResponse = await generateWithModelFallback(ai, {
      label: "research_structured_recovery",
      models: researchModels,
      timeoutMs: Math.min(CONFIG.mission.researchTimeoutMs, Math.max(6000, timeRemainingMs() - 10000)),
      buildParams: (model) => ({
        model,
        contents: [{ role: "user", parts: [{ text: recoveryPrompt }] }],
        config: {
          maxOutputTokens: Math.max(CONFIG.mission.researchMaxOutputTokens, 16384),
          responseMimeType: "application/json",
          responseJsonSchema: RESEARCH_SCHEMA
        }
      })
    });

    research = parseStructuredResponse<{ events: EventCandidate[] }>(recoveryResponse, "research_recovery");
  }

  const researchEvents = (research.events || [])
    .map((event) => {
      const url = sanitizeResearchUrl(event?.url || "");
      return {
        title: clampText(event?.title || "", 120),
        date_time: clampText(event?.date_time || "", 120),
        category: event?.category,
        location_name: clampText(event?.location_name || "", 100),
        address: clampText(event?.address || event?.location_name || locationText, 160),
        price: clampText(event?.price || "Varies", 40),
        url,
        start_iso: String(event?.start_iso || "").trim(),
        end_iso: String(event?.end_iso || "").trim(),
        source: clampText(event?.source || "", 120)
      } as EventCandidate;
    })
    .filter((event) =>
      !!event?.title &&
      !!event?.url &&
      /^https?:\/\//i.test(event.url) &&
      !!event?.category &&
      !!event?.start_iso &&
      !!event?.end_iso
    );

  if (researchEvents.length < 3) {
    throw new HttpsError(
      "failed-precondition",
      "Not enough grounded events were found. Try broadening constraints or another postcode."
    );
  }

  const categoryCounts = {
    local_dad_meetup: researchEvents.filter((event) => event.category === "local_dad_meetup").length,
    with_kids: researchEvents.filter((event) => event.category === "with_kids").length,
    without_kids: researchEvents.filter((event) => event.category === "without_kids").length
  };

  if (categoryCounts.local_dad_meetup === 0 || categoryCounts.with_kids === 0 || categoryCounts.without_kids === 0) {
    throw new HttpsError(
      "failed-precondition",
      "Not enough balanced event coverage was found. Try broadening constraints or another postcode."
    );
  }

  const reasoningPrompt = [
    "You are a community planner for DadCircles.",
    "Use the candidate event set to produce the best local dad mission plan.",
    "Return a practical mission agenda and selected event URLs from the provided candidate list only.",
    "Output selections only with url, category, why_it_fits, and safety_note.",
    "Use strong reasoning on logistics, convenience, and safety for dads with young kids.",
    "Provide practical safety notes and contingency planning.",
    "For official meetup planning, recommend launching only when there are enough active dads to make attendance realistic.",
    "Be concise and information-dense.",
    `Location: ${locationText}`,
    `Target group: ${LIFE_STAGE_LABELS[lifeStage]}`,
    `Interests: ${interests.length ? interests.join(", ") : "General social connection"}`,
    `Target weekend: ${dayLabel} onward`,
    `Budget: ${BUDGET_LABELS[budget]}`,
    `Environment preference: ${ENVIRONMENT_LABELS[environment]}`,
    notes ? `Additional constraints: ${notes}` : "",
    "Ensure selections include at least one event from each category.",
    "Candidate events JSON:",
    JSON.stringify({ events: researchEvents })
  ]
    .filter(Boolean)
    .join("\n");

  const runReasoning = async (
    maxOutputTokens: number,
    label: string
  ) => {
    return generateWithModelFallback(ai, {
      label,
      models: reasoningModels,
      timeoutMs: Math.min(CONFIG.mission.reasoningTimeoutMs, Math.max(5000, timeRemainingMs() - 4000)),
      buildParams: (model) => ({
        model,
        contents: [{ role: "user", parts: [{ text: reasoningPrompt }] }],
        config: {
          maxOutputTokens,
          responseMimeType: "application/json",
          responseJsonSchema: REASONING_SCHEMA
        }
      })
    });
  };

  const reasoningResponse = await runReasoning(
    CONFIG.mission.reasoningMaxOutputTokens,
    "reasoning"
  ).catch(async (error: any) => {
    if (!isInvalidArgumentError(error)) {
      throw error;
    }

    logger.warn("Weekend mission reasoning fallback without schema", {
      status: parseGeminiError(error).status,
      code: parseGeminiError(error).code
    });

    return generateWithModelFallback(ai, {
      label: "reasoning_fallback",
      models: reasoningModels,
      timeoutMs: Math.min(CONFIG.mission.reasoningTimeoutMs, Math.max(5000, timeRemainingMs() - 4000)),
      buildParams: (model) => ({
        model,
        contents: [{ role: "user", parts: [{ text: `${reasoningPrompt}\n\nReturn only JSON.` }] }],
        config: {
          maxOutputTokens: CONFIG.mission.reasoningMaxOutputTokens
        }
      })
    });
  });
  const reasoning = parseStructuredResponse<ReasoningOutput>(
    reasoningResponse,
    "reasoning"
  );

  const researchByUrl = new Map<string, EventCandidate>();
  for (const event of researchEvents) {
    if (event?.url && !researchByUrl.has(event.url)) {
      researchByUrl.set(event.url, event);
    }
  }

  const dedupedByUrl = new Map<string, EventSelection>();
  for (const selection of reasoning.selections || []) {
    if (!selection?.url || dedupedByUrl.has(selection.url)) continue;
    const baseEvent = researchByUrl.get(selection.url);
    if (!baseEvent) continue;

    dedupedByUrl.set(selection.url, {
      ...baseEvent,
      why_it_fits: selection.why_it_fits,
      safety_note: selection.safety_note
    });
  }

  const categoryFallbackText: Record<MissionEventCategory, { why: string; safety: string }> = {
    local_dad_meetup: {
      why: "Good fit for local dad-to-dad connection and easy first meetup logistics.",
      safety: "Confirm host details and meetup point before arrival."
    },
    with_kids: {
      why: "Kid-friendly format with practical pacing for younger families.",
      safety: "Confirm stroller access, shade, and restroom availability ahead of time."
    },
    without_kids: {
      why: "Low-friction adult-only option for social connection and planning.",
      safety: "Use public venues and confirm transport/parking in advance."
    }
  };

  for (const event of researchEvents) {
    if (dedupedByUrl.size >= 9) break;
    if (!event?.url || dedupedByUrl.has(event.url)) continue;
    const fallback = categoryFallbackText[event.category];
    dedupedByUrl.set(event.url, {
      ...event,
      why_it_fits: fallback.why,
      safety_note: fallback.safety
    });
  }

  const selectedEvents = Array.from(dedupedByUrl.values()).slice(0, 9);
  if (selectedEvents.length < 3) {
    throw new HttpsError("failed-precondition", "Unable to build a 3-event plan.");
  }

  const withInvites = selectedEvents.map((event, index) => {
    const eventWindow = getEventTimeWindow(event, index);
    return {
      ...event,
      calendar_invite: createIcsInvite(
        {
          title: event.title,
          description: `${event.date_time}\n${event.why_it_fits}\n${event.url}`,
          location: event.location_name || locationText
        },
        eventWindow.start,
        eventWindow.end
      )
    };
  });

  const sections = {
    local_dad_meetups: withInvites
      .filter((event) => event.category === "local_dad_meetup")
      .slice(0, 4),
    things_to_do_with_kids: withInvites
      .filter((event) => event.category === "with_kids")
      .slice(0, 4),
    things_to_do_without_kids: withInvites
      .filter((event) => event.category === "without_kids")
      .slice(0, 4)
  };

  if (
    sections.local_dad_meetups.length === 0 ||
    sections.things_to_do_with_kids.length === 0 ||
    sections.things_to_do_without_kids.length === 0
  ) {
    throw new HttpsError("failed-precondition", "Unable to build all report sections.");
  }

  const firstEvent = withInvites[0];
  if (!reasoning?.mission?.title || !reasoning?.mission?.summary || !reasoning?.report?.title) {
    throw new HttpsError("failed-precondition", "Missing mission/report fields in reasoning response.");
  }

  const calendar: MissionCalendar = {
    title: reasoning.mission.title,
    description: `${reasoning.mission.summary}\n\nFirst option: ${firstEvent.title} (${firstEvent.url})`,
    location: firstEvent.location_name || locationText
  };

  const invite = createIcsInvite(calendar, start, end);

  const emailBody = [
    "Hey team,",
    "",
    `Here is our Weekend Mission for ${dayLabel}:`,
    `${reasoning.mission.title}`,
    "",
    reasoning.mission.summary,
    "",
    "Agenda:",
    ...reasoning.mission.agenda.map((item) => `- ${item.time}: ${item.activity}`),
    "",
    "Top options:",
    ...withInvites.slice(0, 3).map(
      (event, index) => `${index + 1}. ${event.title} (${event.price}) - ${event.url}\n   Why: ${event.why_it_fits}`
    ),
    "",
    "Safety checks:",
    ...reasoning.mission.safety_constraints.map((item) => `- ${item}`),
    "",
    "Reply-all with your vote and we'll lock it in.",
    "",
    "- DadCircles"
  ].join("\n");

  logger.info("Weekend mission generated", {
    postcode,
    location: locationText,
    lifeStage,
    durationMs: Date.now() - startedAt,
    eventCount: withInvites.length
  });

  return {
    location: {
      city: location.city,
      state_code: location.stateCode,
      country_code: location.countryCode,
      postcode
    },
    events: withInvites,
    sections,
    report: reasoning.report,
    mission: reasoning.mission,
    email: {
      subject: `DadCircles Weekend Mission: ${reasoning.mission.title}`,
      body: emailBody
    },
    calendar_invite: invite,
    generated_at: new Date().toISOString()
  };
};

export const generateWeekendMission = onCall(
  {
    cors: true,
    timeoutSeconds: CONFIG.mission.timeout,
    secrets: [geminiApiKey]
  },
  async (request) => {
    const missionRequest = normalizeMissionRequest(request.data as MissionRequest | undefined);
    const ipAddress = getIpAddress(request as any);
    try {
      return await runMissionGeneration(missionRequest, {
        applyRateLimit: true,
        ipAddress
      });
    } catch (error: any) {
      if (error instanceof HttpsError) {
        throw error;
      }

      logger.error("Weekend mission generation failed", {
        postcode: missionRequest.postcode,
        lifeStage: missionRequest.life_stage,
        error: error?.message
      });
      throw new HttpsError("internal", "Could not generate a mission right now. Please try again.");
    }
  }
);

export const createWeekendMissionJob = onCall(
  {
    cors: true,
    timeoutSeconds: 60
  },
  async (request) => {
    const missionRequest = normalizeMissionRequest(request.data as MissionRequest | undefined);
    const ipAddress = getIpAddress(request as any);
    const rateLimitIdentifier = `${ipAddress}:${missionRequest.postcode}`;
    const rateLimitCheck = await RateLimiter.checkWeekendMissionRequest(rateLimitIdentifier);
    if (!rateLimitCheck.allowed) {
      throw new HttpsError("resource-exhausted", rateLimitCheck.reason || "Too many requests.");
    }

    const jobRef = admin.firestore().collection(MISSION_JOBS_COLLECTION).doc();
    await jobRef.set({
      status: "queued",
      request: missionRequest,
      created_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp()
    });

    return {
      job_id: jobRef.id,
      status: "queued"
    };
  }
);

export const getWeekendMissionJob = onCall(
  {
    cors: true,
    timeoutSeconds: 30
  },
  async (request) => {
    const jobId = String(request.data?.job_id || "").trim();
    if (!jobId) {
      throw new HttpsError("invalid-argument", "job_id is required");
    }

    const doc = await admin.firestore().collection(MISSION_JOBS_COLLECTION).doc(jobId).get();
    if (!doc.exists) {
      throw new HttpsError("not-found", "Mission job not found");
    }

    const data = doc.data() || {};
    return {
      job_id: jobId,
      status: data.status || "queued",
      result: data.result,
      error: data.error
    };
  }
);

export const processWeekendMissionJob = onDocumentCreated(
  {
    document: `${MISSION_JOBS_COLLECTION}/{jobId}`,
    region: "us-central1",
    timeoutSeconds: CONFIG.mission.timeout,
    secrets: [geminiApiKey]
  },
  async (event) => {
    const jobId = event.params.jobId;
    const snap = event.data;
    if (!snap) return;

    const data = snap.data() || {};
    if (data.status !== "queued" || !data.request) return;

    const ref = snap.ref;
    await ref.update({
      status: "running",
      started_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp()
    });

    try {
      const missionRequest = normalizeMissionRequest(data.request as MissionRequest);
      const result = await runMissionGeneration(missionRequest, { applyRateLimit: false });
      await ref.update({
        status: "succeeded",
        result,
        updated_at: FieldValue.serverTimestamp(),
        completed_at: FieldValue.serverTimestamp()
      });
    } catch (error: any) {
      logger.error("Weekend mission job failed", {
        jobId,
        error: error?.message
      });
      await ref.update({
        status: "failed",
        error: error?.message || "Mission generation failed",
        updated_at: FieldValue.serverTimestamp(),
        completed_at: FieldValue.serverTimestamp()
      });
    }
  }
);
