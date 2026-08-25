export const WATCHLIST_STORAGE_KEY = "atlas.crypto.watchlist.v1";

type StorageLike = Pick<Storage, "getItem" | "setItem">;

function uniqueCoinIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const validIds: string[] = [];
  for (const item of value) {
    if (typeof item === "string" && /^[a-z0-9-]+$/.test(item) && validIds.indexOf(item) === -1) {
      validIds.push(item);
    }
  }
  return validIds;
}

export function loadWatchlist(storage: Pick<Storage, "getItem"> | null | undefined): string[] {
  if (!storage) return [];
  try {
    return uniqueCoinIds(JSON.parse(storage.getItem(WATCHLIST_STORAGE_KEY) ?? "[]"));
  } catch {
    return [];
  }
}

export function saveWatchlist(coinIds: string[], storage: Pick<Storage, "setItem"> | null | undefined) {
  if (!storage) return;
  storage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(uniqueCoinIds(coinIds)));
}

export function toggleWatchlist(coinIds: string[], coinId: string) {
  const current = uniqueCoinIds(coinIds);
  return current.includes(coinId) ? current.filter(id => id !== coinId) : [...current, coinId];
}

export function persistToggledWatchlist(coinIds: string[], coinId: string, storage: StorageLike | null | undefined) {
  const next = toggleWatchlist(coinIds, coinId);
  saveWatchlist(next, storage);
  return next;
}
