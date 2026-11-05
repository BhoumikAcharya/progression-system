import { readPreference, writePreference } from './local-preferences'

const SLEEP_COLLAPSED_KEY = 'progression.sleep-collapsed.v1'

export function sleepCollapsedByDefault(): boolean {
  return readPreference(SLEEP_COLLAPSED_KEY) === 'true'
}

export function setSleepCollapsedByDefault(value: boolean): boolean {
  return writePreference(SLEEP_COLLAPSED_KEY, String(value))
}
