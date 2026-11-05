import type { Theme } from '../domain/types'
import { readPreference } from '../data/local-preferences'
export const THEME_KEY = 'progression.theme.v1'
export function parseTheme(value: string | null): Theme {
  return value === 'oled-black' ? value : 'inked-fantasy'
}
export function readTheme(): Theme {
  return parseTheme(readPreference(THEME_KEY))
}
export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', theme === 'oled-black' ? '#000000' : '#13110c')
}
