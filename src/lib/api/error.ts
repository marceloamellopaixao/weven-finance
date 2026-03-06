export function isAuthErrorMessage(message: string) {
  const normalized = message.toLowerCase();
  return (
    message === "missing_auth_token" ||
    normalized.includes("id token") ||
    normalized.includes("verifyidtoken") ||
    normalized.includes("auth/id-token") ||
    normalized.includes("decoding firebase id token") ||
    normalized.includes("argument \"token\"") ||
    normalized.includes("jwt")
  );
}

export function resolveApiErrorStatus(message: string) {
  if (message.startsWith("impersonation_")) return 403;
  if (isAuthErrorMessage(message)) return 401;
  return 500;
}
