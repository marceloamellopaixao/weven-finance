type ExternalAlertLevel = "info" | "warning" | "error" | "critical";

type ExternalAlertInput = {
  source: string;
  title: string;
  message: string;
  level?: ExternalAlertLevel;
  meta?: Record<string, unknown>;
};

function getAlertWebhookUrl() {
  return (
    process.env.OBS_ALERT_WEBHOOK_URL ||
    process.env.SLACK_ALERT_WEBHOOK_URL ||
    process.env.DISCORD_ALERT_WEBHOOK_URL ||
    ""
  ).trim();
}

export async function sendExternalAlert(input: ExternalAlertInput) {
  const url = getAlertWebhookUrl();
  if (!url) return false;

  const payload = {
    source: input.source,
    title: input.title,
    message: input.message,
    level: input.level || "error",
    meta: input.meta || {},
    at: new Date().toISOString(),
    app: "weven-finance",
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
    return response.ok;
  } catch {
    return false;
  }
}

