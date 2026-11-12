// User-facing errors (constitution V: never leak tech names to users). An error code maps to an i18n
// message key + hint key; the raw technical detail stays internal (logs / error tracker only).
import vi from "../messages/vi.json" with { type: "json" };
import en from "../messages/en.json" with { type: "json" };

export const ERROR_CODES = [
  "INPUT_INVALID",
  "SPEC_INVALID",
  "SLOT_TOO_LONG",
  "STYLE_UNAVAILABLE",
  "RENDER_FAILED",
  "RENDER_TIMEOUT",
  "QA_FAILED",
  "VOICE_FAILED",
  "AI_FAILED",
  "QUOTA_EXCEEDED",
  "PAYMENT_REQUIRED",
  "NOT_FOUND",
  "FORBIDDEN",
  "RATE_LIMITED",
  "INTERNAL",
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];
export type Locale = "vi" | "en";

type Messages = { errors: Record<ErrorCode, { message: string; hint: string }> };
const MESSAGES: Record<Locale, Messages> = { vi: vi as Messages, en: en as Messages };

export class UserFacingError extends Error {
  override readonly name = "UserFacingError";
  constructor(
    readonly code: ErrorCode,
    /** Internal detail for logs only (may contain library names, stack-ish info). Never sent to clients. */
    readonly internalDetail?: string,
    readonly params: Record<string, string | number> = {},
    readonly httpStatus: number = statusFor(code),
  ) {
    super(code);
  }

  /** Safe payload for API responses / UI. */
  toClient(locale: Locale = "vi"): { code: ErrorCode; message: string; hint: string } {
    const m = MESSAGES[locale].errors[this.code];
    const fill = (s: string) => s.replace(/\{(\w+)\}/g, (_, k: string) => String(this.params[k] ?? `{${k}}`));
    return { code: this.code, message: fill(m.message), hint: fill(m.hint) };
  }
}

function statusFor(code: ErrorCode): number {
  switch (code) {
    case "INPUT_INVALID":
    case "SPEC_INVALID":
    case "SLOT_TOO_LONG":
      return 400;
    case "PAYMENT_REQUIRED":
    case "QUOTA_EXCEEDED":
      return 402;
    case "FORBIDDEN":
      return 403;
    case "NOT_FOUND":
    case "STYLE_UNAVAILABLE":
      return 404;
    case "RATE_LIMITED":
      return 429;
    case "QA_FAILED":
      return 422;
    case "RENDER_TIMEOUT":
      return 504;
    default:
      return 500;
  }
}

/** Wrap any thrown value: known UserFacingErrors pass through, everything else becomes INTERNAL. */
export function toUserFacing(e: unknown, fallback: ErrorCode = "INTERNAL"): UserFacingError {
  if (e instanceof UserFacingError) return e;
  return new UserFacingError(fallback, e instanceof Error ? `${e.name}: ${e.message}` : String(e));
}

/** Words that must never appear in user-facing text (checked in tests and CI). */
export const FORBIDDEN_TECH_TERMS = [
  "hyperframes",
  "gsap",
  "ffmpeg",
  "puppeteer",
  "chrome",
  "chromium",
  "bullmq",
  "valkey",
  "redis",
  "seaweedfs",
  "drizzle",
  "postgres",
  "whisper",
  "openai",
  "anthropic",
  "claude",
  "fpt",
  "elevenlabs",
  "azure",
  "stack",
  "undefined",
  "null",
];
