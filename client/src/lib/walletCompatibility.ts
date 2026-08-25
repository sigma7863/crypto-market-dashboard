export type WalletCompatibility = {
  status: "ready" | "unavailable" | "conflict";
  providerCount: number;
  reason?: "multiple-providers" | "protected-provider" | "extension-error";
};

type ProviderShape = {
  providers?: unknown;
};

/**
 * Reads wallet-provider state without assigning to window.ethereum or modifying any provider.
 */
export function inspectWalletCompatibility(host: unknown): WalletCompatibility {
  if (!host || (typeof host !== "object" && typeof host !== "function")) {
    return { status: "unavailable", providerCount: 0 };
  }

  try {
    const provider = (host as { ethereum?: ProviderShape }).ethereum;
    if (!provider) return { status: "unavailable", providerCount: 0 };

    const providers = Array.isArray(provider.providers) ? provider.providers : [provider];
    if (providers.length > 1) {
      return { status: "conflict", providerCount: providers.length, reason: "multiple-providers" };
    }

    return { status: "ready", providerCount: 1 };
  } catch {
    return { status: "conflict", providerCount: 0, reason: "protected-provider" };
  }
}

export function isWalletExtensionConflict(event: Pick<ErrorEvent, "filename" | "message">) {
  return event.filename?.startsWith("chrome-extension://")
    && /ethereum/i.test(event.message)
    && /(setter|getter|property|provider)/i.test(event.message);
}
