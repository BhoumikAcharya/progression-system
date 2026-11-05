import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  AuthApiError,
  AuthRetryableFetchError,
  AuthSessionMissingError,
  type SupabaseClient,
} from '@supabase/supabase-js'
import {
  SupabaseAuthRepository,
  SupabaseProfileRepository,
  sessionCheckInterrupted,
} from './supabase'

const profile = {
  display_name: 'Account A',
  time_zone: 'Asia/Kolkata',
  theme: 'oled-black',
  stats: { STR: 0, INT: 0, VIT: 0, DIS: 0, BNK: 0 },
  corrected_lifetime_xp: 0,
  highest_level_achieved: 1,
}
afterEach(() => vi.unstubAllGlobals())

describe('login checks', () => {
  const repository = (error: Error | null, user: { id: string } | null = null) =>
    new SupabaseAuthRepository({
      auth: { getUser: async () => ({ data: { user }, error }) },
    } as unknown as SupabaseClient)

  it('reports a dropped connection instead of treating it as a logout', async () => {
    const dropped = new AuthRetryableFetchError('Failed to fetch', 0)
    await expect(repository(dropped).getSession()).rejects.toBe(dropped)
    expect(sessionCheckInterrupted(dropped)).toBe(true)
  })
  it('still signs out when the server rejects the login or none is saved', async () => {
    await expect(
      repository(new AuthApiError('Invalid token', 403, 'bad_jwt')).getSession(),
    ).resolves.toBeNull()
    await expect(repository(new AuthSessionMissingError()).getSession()).resolves.toBeNull()
    expect(sessionCheckInterrupted(new AuthSessionMissingError())).toBe(false)
  })
  it('returns the account for a confirmed login', async () => {
    await expect(repository(null, { id: 'owner' }).getSession()).resolves.toEqual({
      userId: 'owner',
    })
  })
})

describe('account preference writes', () => {
  it('updates only the chosen field so a device cannot overwrite another preference', async () => {
    vi.stubGlobal('navigator', { onLine: true })
    const update = vi.fn().mockImplementation(() => chain)
    const chain = {
      eq: () => chain,
      select: () => chain,
      single: async () => ({ data: profile, error: null }),
    }
    const db = {
      auth: { getUser: async () => ({ data: { user: { id: 'owner' } }, error: null }) },
      from: (table: string) => {
        expect(table).toBe('profiles')
        return { update }
      },
    } as unknown as SupabaseClient
    const result = await new SupabaseProfileRepository(db).updatePreferences({
      theme: 'oled-black',
    })
    expect(result.status).toBe('saved')
    expect(update).toHaveBeenCalledWith({ theme: 'oled-black' })
    expect(update).not.toHaveBeenCalledWith(expect.objectContaining({ display_name: 'Account A' }))
  })
  it('refuses an offline account write', async () => {
    vi.stubGlobal('navigator', { onLine: false })
    const db = { auth: { getUser: vi.fn() } } as unknown as SupabaseClient
    const result = await new SupabaseProfileRepository(db).updatePreferences({
      displayName: 'New name',
    })
    expect(result.status).toBe('offline')
    expect(db.auth.getUser).not.toHaveBeenCalled()
  })
})
