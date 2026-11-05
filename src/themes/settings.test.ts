import { describe, expect, it } from 'vitest'
import { parseTheme, THEME_KEY } from './settings'
import { readPreference, writePreference, type PreferenceStore } from '../data/local-preferences'
describe('local appearance preference', () => {
  it('defaults new and invalid preferences to Inked Fantasy', () => {
    expect(parseTheme(null)).toBe('inked-fantasy')
    expect(parseTheme('unknown')).toBe('inked-fantasy')
    expect(parseTheme('oled-black')).toBe('oled-black')
  })
  it('round trips a theme through the replaceable preference store', () => {
    const values = new Map<string, string>()
    const storage: PreferenceStore = {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => {
        values.set(key, value)
      },
    }
    expect(writePreference(THEME_KEY, 'oled-black', storage)).toBe(true)
    expect(parseTheme(readPreference(THEME_KEY, storage))).toBe('oled-black')
  })
  it('handles denied browser storage without claiming persistence', () => {
    const storage: PreferenceStore = {
      getItem: () => {
        throw new Error('denied')
      },
      setItem: () => {
        throw new Error('denied')
      },
    }
    expect(readPreference(THEME_KEY, storage)).toBeNull()
    expect(writePreference(THEME_KEY, 'oled-black', storage)).toBe(false)
  })
})
