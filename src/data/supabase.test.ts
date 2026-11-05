import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { SupabaseProfileRepository } from './supabase'

const profile = {
  display_name: 'Account A',
  time_zone: 'Asia/Kolkata',
  theme: 'oled-black',
  stats: { STR: 0, INT: 0, VIT: 0, DIS: 0, BNK: 0 },
  corrected_lifetime_xp: 0,
  highest_level_achieved: 1,
}
afterEach(() => vi.unstubAllGlobals())

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
