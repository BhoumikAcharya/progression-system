import type { PlayerProfile } from '../domain/types'
export type WriteResult<T> =
  { status: 'saved'; data: T } | { status: 'offline' | 'conflict' | 'error'; message: string }
// TODO M2: Supabase Auth adapter and owner-checked versioned RPCs. No totals mutation API.
export interface ProfileRepository {
  load(): Promise<PlayerProfile>
  updatePreferences(
    preferences: Pick<PlayerProfile, 'displayName' | 'theme'>,
  ): Promise<WriteResult<PlayerProfile>>
}
export interface AuthSession {
  userId: string
}
export interface AuthRepository {
  getSession(): Promise<AuthSession | null>
  signIn(email: string, password: string): Promise<AuthSession>
  signOut(): Promise<void>
}
