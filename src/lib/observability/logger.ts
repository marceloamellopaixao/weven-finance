import * as Sentry from "@sentry/nextjs";

type LogLevel = "info" | "warn" | "error";

type LogPayload = {
  message: string;
  requestId?: string;
  route?: string;
  method?: string;
  uid?: string;
  meta?: Record<string, unknown>;
};

function write(level: LogLevel, payload: LogPayload) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    message: payload.message,
    requestId: payload.requestId || null,
    route: payload.route || null,
    method: payload.method || null,
    uid: payload.uid || null,
    meta: payload.meta || null,
  };

  const line = JSON.stringify(entry);
  if (level === "error") {
    const maybeError = payload.meta?.error;
    if (maybeError instanceof Error) {
      Sentry.captureException(maybeError, {
        tags: { route: payload.route || "unknown", method: payload.method || "unknown" },
        extra: payload.meta || {},
      });
    } else if (typeof maybeError === "string") {
      Sentry.captureMessage(maybeError, {
        level: "error",
        tags: { route: payload.route || "unknown", method: payload.method || "unknown" },
        extra: payload.meta || {},
      });
    }
    console.error(line);
    return;
  }
  if (level === "warn") {
    console.warn(line);
    return;
  }
  console.log(line);
}

export const apiLogger = {
  info: (payload: LogPayload) => write("info", payload),
  warn: (payload: LogPayload) => write("warn", payload),
  error: (payload: LogPayload) => write("error", payload),
};
