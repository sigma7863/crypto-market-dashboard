import { describe, expect, it } from "vitest";
import { loadWatchlist, persistToggledWatchlist, saveWatchlist, toggleWatchlist, WATCHLIST_STORAGE_KEY } from "./watchlistStorage";

function createStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
}

describe("watchlist storage", () => {
  it("loads valid unique asset ids and discards malformed entries", () => {
    const storage = createStorage({ [WATCHLIST_STORAGE_KEY]: '["bitcoin","bitcoin","ethereum","Bad ID",99]' });
    expect(loadWatchlist(storage)).toEqual(["bitcoin", "ethereum"]);
  });

  it("returns an empty list if browser storage contains malformed data", () => {
    expect(loadWatchlist(createStorage({ [WATCHLIST_STORAGE_KEY]: "not-json" }))).toEqual([]);
  });

  it("adds and removes an asset without duplicating ids", () => {
    expect(toggleWatchlist(["bitcoin"], "solana")).toEqual(["bitcoin", "solana"]);
    expect(toggleWatchlist(["bitcoin", "solana"], "bitcoin")).toEqual(["solana"]);
  });

  it("persists the toggled list in browser storage", () => {
    const storage = createStorage();
    expect(persistToggledWatchlist(["bitcoin"], "ethereum", storage)).toEqual(["bitcoin", "ethereum"]);
    expect(loadWatchlist(storage)).toEqual(["bitcoin", "ethereum"]);
    saveWatchlist(["solana"], storage);
    expect(loadWatchlist(storage)).toEqual(["solana"]);
  });
});
