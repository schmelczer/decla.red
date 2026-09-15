export function loadStoredValue(key: string): unknown {
  try {
    const stored = localStorage.getItem(key);
    return stored === null ? undefined : JSON.parse(stored);
  } catch {
    return undefined;
  }
}

export function saveStoredValue(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Preferences still apply for this visit when browser storage is unavailable.
  }
}
