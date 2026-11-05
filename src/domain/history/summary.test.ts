import { describe, expect, it } from 'vitest'
import { summarizeDay, type HistoryEvent } from './summary'
import type { LocalDate } from '../types'
const day = '2026-11-04' as LocalDate
function event(
  source_type: HistoryEvent['source_type'],
  entries: [string, number][],
  xp: number,
): HistoryEvent {
  return {
    id: crypto.randomUUID(),
    source_type,
    source_id: crypto.randomUUID(),
    scheduled_date: day,
    activity_date: day,
    config_snapshot: {},
    raw_effects: {},
    streak_effects: {},
    stat_ledger_entries: entries.map(([stat_key, effective_delta]) => ({
      stat_key,
      effective_delta,
    })),
    xp_ledger_entries: [{ credit_delta: xp, reason: 'current_award' }],
  }
}
describe('history day summary', () => {
  it('preserves no record versus recorded zero', () => {
    expect(summarizeDay([], day).recorded).toBe(false)
    const zero = summarizeDay([event('quest', [], 0)], day)
    expect(zero.recorded).toBe(true)
    expect(zero.net).toBe(0)
    expect(zero.quests).toBe(1)
  })
  it('matches the consistent Nov 4 fixture', () => {
    const events = [
      event(
        'quest',
        [
          ['STR', 2],
          ['VIT', 1],
        ],
        450,
      ),
      event('quest', [['INT', 1]], 150),
      event('quest', [['DIS', 2]], 300),
      event('quest', [['BNK', -1]], 0),
    ]
    expect(summarizeDay(events, day)).toMatchObject({
      recorded: true,
      gained: 6,
      lost: -1,
      net: 5,
      xp: 900,
      quests: 4,
      stats: { STR: 2, INT: 1, VIT: 1, DIS: 2, BNK: -1 },
    })
  })
})
