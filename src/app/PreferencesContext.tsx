import { createContext, useContext } from 'react'
import type { Theme } from '../domain/types'
export interface Preferences {
  theme: Theme
  setTheme: (theme: Theme) => void
  name: string
  setName: (name: string) => void
  refreshAccount: () => Promise<void>
  clearAccount: () => void
  storageError: boolean
}
export const PreferencesContext = createContext<Preferences | null>(null)
export function usePreferences() {
  const context = useContext(PreferencesContext)
  if (!context) throw new Error('Preferences provider missing')
  return context
}
