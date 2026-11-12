// Structured logging (pino) and an error-tracking adapter. Secrets are redacted by path; provider
// keys must never reach logs (constitution VII).
import pino, { type Logger } from "pino";

export const REDACT_PATHS = [
  "*.apiKey",
  "*.api_key",
  "*.authorization",
  "*.Authorization",
  "*.password",
  "*.secret",
  "*.token",
  "headers.authorization",
  "headers.cookie",
  "req.headers.authorization",
  "req.headers.cookie",
];

export function createLogger(
  name: string,
  opts: { level?: string; destination?: pino.DestinationStream } = {},
): Logger {
  return pino(
    {
      name,
      level: opts.level ?? process.env.LOG_LEVEL ?? "info",
      redact: { paths: REDACT_PATHS, censor: "[redacted]" },
      base: { service: name },
      timestamp: pino.stdTimeFunctions.isoTime,
    },
    opts.destination,
  );
}

export interface ErrorContext {
  workspaceId?: string;
  projectId?: string;
  jobId?: string;
  step?: string;
  [k: string]: unknown;
}

/** Vendor-neutral error tracker; a hosted tracker (e.g. Sentry/GlitchTip) can implement this later. */
export interface ErrorTracker {
  capture(error: unknown, ctx?: ErrorContext): void;
}

export function logErrorTracker(logger: Logger): ErrorTracker {
  return {
    capture(error, ctx = {}) {
      const err =
        error instanceof Error
          ? { name: error.name, message: error.message, stack: error.stack }
          : { message: String(error) };
      logger.error({ err, ...ctx }, "unhandled error");
    },
  };
}
