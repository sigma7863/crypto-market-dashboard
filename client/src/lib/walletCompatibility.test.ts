import { describe, expect, it } from "vitest";
import { inspectWalletCompatibility, isWalletExtensionConflict } from "./walletCompatibility";

describe("wallet compatibility inspection", () => {
  it("does not report a provider when no wallet extension is present", () => {
    expect(inspectWalletCompatibility({})).toEqual({ status: "unavailable", providerCount: 0 });
  });

  it("reports a single provider without mutating it", () => {
    const host = { ethereum: { request: () => undefined } };
    expect(inspectWalletCompatibility(host)).toEqual({ status: "ready", providerCount: 1 });
    expect(host.ethereum).toBeDefined();
  });

  it("reports multiple injected providers as a conflict", () => {
    expect(inspectWalletCompatibility({ ethereum: { providers: [{}, {}] } })).toEqual({
      status: "conflict",
      providerCount: 2,
      reason: "multiple-providers",
    });
  });

  it("reports a protected provider getter as a conflict without throwing", () => {
    const host = {};
    Object.defineProperty(host, "ethereum", { get: () => { throw new Error("locked"); } });
    expect(inspectWalletCompatibility(host)).toEqual({
      status: "conflict",
      providerCount: 0,
      reason: "protected-provider",
    });
  });

  it("recognizes wallet provider errors raised by browser extensions", () => {
    expect(isWalletExtensionConflict({
      filename: "chrome-extension://example/inpage.js",
      message: "Cannot set property ethereum of #<Window> which has only a getter",
    } as ErrorEvent)).toBe(true);
  });
});
