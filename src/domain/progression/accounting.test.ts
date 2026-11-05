import { describe, expect, it } from 'vitest'
import {
  applyEffects,
  cumulativeThreshold,
  dailySummary,
  levelState,
  replayLedger,
  zeroStats,
} from './accounting'
const effect = (changes: Partial<ReturnType<typeof zeroStats>>) => ({ ...zeroStats(), ...changes })
describe('authoritative accounting functions', () => {
  it('credits positive points only, including mixed outcomes', () => {
    expect(applyEffects(zeroStats(), effect({ STR: 2, VIT: 1 })).xpCredit).toBe(450)
    expect(applyEffects(effect({ VIT: 1, DIS: 1 }), effect({ VIT: -1, DIS: -1 })).xpCredit).toBe(0)
    expect(applyEffects(zeroStats(), effect({ STR: 2, VIT: -1 }))).toMatchObject({
      stats: effect({ STR: 2 }),
      effective: effect({ STR: 2 }),
      xpCredit: 300,
    })
  })
  it('records effective floor-limited penalties', () => {
    expect(applyEffects(zeroStats(), effect({ STR: -2 })).effective.STR).toBe(0)
    expect(applyEffects(effect({ STR: 1 }), effect({ STR: -2 })).effective.STR).toBe(-1)
  })
  it('uses cumulative thresholds and never revokes an unlocked level', () => {
    expect(cumulativeThreshold(8)).toBe(4435)
    expect(levelState(927, 7)).toMatchObject({
      highestLevelAchieved: 7,
      progressXp: 0,
      remainingXp: 3508,
    })
    expect(levelState(4434, 7).highestLevelAchieved).toBe(7)
    expect(levelState(4435, 7).highestLevelAchieved).toBe(8)
  })
  it('replays corrected history and downstream stat floors deterministically', () => {
    const day = '2026-11-04' as const
    const sources = [
      { id: 'a', activityDate: day, order: 1, rawEffects: effect({ STR: 2 }), valid: true },
      { id: 'b', activityDate: day, order: 2, rawEffects: effect({ STR: -2 }), valid: true },
      { id: 'c', activityDate: day, order: 3, rawEffects: effect({ INT: 1 }), valid: true },
    ]
    const before = replayLedger(sources)
    expect(before.correctedLifetimeXp).toBe(450)
    expect(dailySummary(before.entries, day)).toMatchObject({
      recorded: true,
      gained: 3,
      lost: -2,
      net: 1,
      xp: 450,
    })
    const after = replayLedger(sources.map((s) => (s.id === 'a' ? { ...s, valid: false } : s)))
    expect(after.entries.find((e) => e.id === 'b')?.effectiveEffects.STR).toBe(0)
    expect(after.stats).toEqual(effect({ INT: 1 }))
    expect(after.correctedLifetimeXp).toBe(150)
    expect(dailySummary(after.entries, day)).toMatchObject({
      recorded: true,
      gained: 1,
      lost: 0,
      net: 1,
      xp: 150,
    })
    expect(dailySummary([], day).recorded).toBe(false)
  })
  it('matches the canonical sample day with opening balances', () => {
    const day = '2026-11-04' as const
    const opening = {
      id: 'opening',
      activityDate: '2026-11-03' as const,
      order: 0,
      rawEffects: effect({ VIT: 1, DIS: 1, BNK: 1 }),
      valid: true,
    }
    const events = [
      effect({ STR: 2, VIT: 1 }),
      effect({ INT: 1 }),
      effect({ DIS: 2 }),
      effect({ BNK: -1 }),
    ].map((rawEffects, i) => ({
      id: String(i),
      activityDate: day,
      order: i,
      rawEffects,
      valid: true,
    }))
    const summary = dailySummary(replayLedger([opening, ...events]).entries, day)
    expect(summary).toMatchObject({
      gained: 6,
      lost: -1,
      net: 5,
      xp: 900,
      effects: effect({ STR: 2, INT: 1, VIT: 1, DIS: 2, BNK: -1 }),
    })
  })
})
