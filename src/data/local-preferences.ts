export interface PreferenceStore {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}
/** Only non-sensitive preview preferences. Never store activity history or auth here. */
export function browserPreferences(): PreferenceStore | undefined {
  try {
    return window.localStorage
  } catch {
    return undefined
  }
}
export function readPreference(key: string, storage = browserPreferences()): string | null {
  try {
    return storage?.getItem(key) ?? null
  } catch {
    return null
  }
}
export function writePreference(
  key: string,
  value: string,
  storage = browserPreferences(),
): boolean {
  try {
    if (!storage) return false
    storage.setItem(key, value)
    return true
  } catch {
    return false
  }
}
