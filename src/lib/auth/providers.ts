type IdentityLike = {
  provider?: string | null;
};

type ProviderInput = {
  app_metadata?: Record<string, unknown> | null;
  identities?: IdentityLike[] | null;
};

function normalizeProvider(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim().toLowerCase() : null;
}

export function extractAuthProviders(input: ProviderInput) {
  const providers = new Set<string>();
  const appMetadata = input.app_metadata || {};

  const primaryProvider = normalizeProvider(appMetadata.provider);
  if (primaryProvider) providers.add(primaryProvider);

  const appProviders = appMetadata.providers;
  if (Array.isArray(appProviders)) {
    for (const provider of appProviders) {
      const normalized = normalizeProvider(provider);
      if (normalized) providers.add(normalized);
    }
  }

  if (Array.isArray(input.identities)) {
    for (const identity of input.identities) {
      const normalized = normalizeProvider(identity?.provider);
      if (normalized) providers.add(normalized);
    }
  }

  return Array.from(providers).sort((a, b) => a.localeCompare(b));
}

export function hasEmailPasswordProvider(providers: string[]) {
  return providers.includes("email");
}

export function shouldRequirePasswordSetup(providers: string[]) {
  return providers.includes("google") && !hasEmailPasswordProvider(providers);
}
