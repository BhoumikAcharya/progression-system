import { createClient, isAuthRetryableFetchError, type SupabaseClient } from '@supabase/supabase-js'
import type { AuthRepository, AuthSession, ProfileRepository, WriteResult } from './contracts'
import type { PlayerProfile } from '../domain/types'
let client: SupabaseClient | undefined
/** Browser publishable key only. No service role or local activity store. */
export function supabaseClient(): SupabaseClient {
  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) throw new Error('Supabase is not configured')
  return (client ??= createClient(url, key, {
    auth: { autoRefreshToken: true, persistSession: true },
  }))
}
/** True when a login check could not reach the server, so it says nothing about the login. */
export function sessionCheckInterrupted(cause: unknown): boolean {
  return isAuthRetryableFetchError(cause)
}
export class SupabaseAuthRepository implements AuthRepository {
  constructor(private readonly db: SupabaseClient = supabaseClient()) {}
  async getSession(): Promise<AuthSession | null> {
    const { data, error } = await this.db.auth.getUser()
    if (error && sessionCheckInterrupted(error)) throw error
    if (error) return null
    return data.user ? { userId: data.user.id } : null
  }
  async signIn(email: string, password: string): Promise<AuthSession> {
    const { data, error } = await this.db.auth.signInWithPassword({ email, password })
    if (error || !data.user) throw error ?? new Error('Sign-in did not return a user')
    return { userId: data.user.id }
  }
  async signOut(): Promise<void> {
    const { error } = await this.db.auth.signOut()
    if (error) throw error
  }
}
export class SupabaseProfileRepository implements ProfileRepository {
  constructor(private readonly db: SupabaseClient = supabaseClient()) {}
  async load(): Promise<PlayerProfile> {
    const { data, error } = await this.db
      .from('profiles')
      .select('display_name,time_zone,theme,stats,corrected_lifetime_xp,highest_level_achieved')
      .single()
    if (error || !data) throw error ?? new Error('Profile unavailable')
    return {
      displayName: data.display_name,
      timeZone: data.time_zone,
      theme: data.theme,
      stats: data.stats,
      correctedLifetimeXp: Number(data.corrected_lifetime_xp),
      highestLevelAchieved: data.highest_level_achieved,
      energy: null,
    }
  }
  async updatePreferences(
    preferences: Partial<Pick<PlayerProfile, 'displayName' | 'theme'>>,
  ): Promise<WriteResult<PlayerProfile>> {
    if (!navigator.onLine)
      return { status: 'offline', message: 'Offline. Preference was not saved to your account.' }
    const { data: auth, error: authError } = await this.db.auth.getUser()
    if (authError) return { status: 'error', message: authError.message }
    const user = auth.user
    if (!user) return { status: 'error', message: 'Sign in to save account preferences.' }
    const patch: { display_name?: string; theme?: PlayerProfile['theme'] } = {}
    if (preferences.displayName !== undefined) patch.display_name = preferences.displayName
    if (preferences.theme !== undefined) patch.theme = preferences.theme
    if (!Object.keys(patch).length)
      return { status: 'error', message: 'No profile change was supplied.' }
    const { data, error } = await this.db
      .from('profiles')
      .update(patch)
      .eq('user_id', user.id)
      .select('display_name,time_zone,theme,stats,corrected_lifetime_xp,highest_level_achieved')
      .single()
    if (error || !data)
      return { status: 'error', message: error?.message ?? 'Profile was not updated.' }
    return {
      status: 'saved',
      data: {
        displayName: data.display_name,
        timeZone: data.time_zone,
        theme: data.theme,
        stats: data.stats,
        correctedLifetimeXp: Number(data.corrected_lifetime_xp),
        highestLevelAchieved: data.highest_level_achieved,
        energy: null,
      },
    }
  }
}
