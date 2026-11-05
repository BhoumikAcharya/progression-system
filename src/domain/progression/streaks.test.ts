import { expect, it } from 'vitest'
import { projectStreaks, reconcileAwardedBonuses, type StreakSlot } from './streaks'
import { zeroStats } from './accounting'
const slot = (key: string, date: string, extra: Partial<StreakSlot> = {}): StreakSlot => ({
  key,
  scheduledDate: date as StreakSlot['scheduledDate'],
  outcomeId: null,
  completed: true,
  eligible: true,
  effects: { ...zeroStats(), STR: 2, DIS: -1 },
  generation: 1,
  ...extra,
})
it('rewards every third scheduled match in every configured sign', () => {
  const runs = projectStreaks([
    slot('1', '2026-11-02'),
    slot('2', '2026-11-04'),
    slot('3', '2026-11-06'),
    slot('4', '2026-11-09'),
    slot('5', '2026-11-11'),
    slot('6', '2026-11-13'),
  ])
  expect(runs.map((r) => r.streak)).toEqual([1, 2, 3, 4, 5, 6])
  expect(runs[2]?.bonus).toEqual({ ...zeroStats(), STR: 1, DIS: -1 })
  expect(runs[5]?.bonus).toEqual({ ...zeroStats(), STR: 1, DIS: -1 })
})
it('distinguishes a recorded volatile switch from an unreported slot', () => {
  const runs = projectStreaks([
    slot('1', '2026-11-01', { outcomeId: 'yes' }),
    slot('2', '2026-11-02', { outcomeId: 'yes' }),
    slot('3', '2026-11-03', { outcomeId: 'no' }),
    slot('4', '2026-11-04', { completed: false, outcomeId: null }),
    slot('5', '2026-11-05', { outcomeId: 'no' }),
  ])
  expect(runs.map((r) => r.streak)).toEqual([1, 2, 1, 0, 1])
})
it('does not generate retroactive bonuses on correction and withdraws dependent awards', () => {
  const slots = [
    slot('1', '2026-11-01'),
    slot('2', '2026-11-02', { completed: false }),
    slot('3', '2026-11-03', { bonusAwarded: true }),
  ]
  const corrected = reconcileAwardedBonuses(slots)
  expect(corrected[2]).toMatchObject({ streak: 1, withdrawBonus: true, bonus: zeroStats() })
})
it('resets at an archive or schedule generation boundary', () => {
  const runs = projectStreaks([
    slot('1', '2026-11-01'),
    slot('2', '2026-11-02'),
    slot('3', '2026-11-03', { generation: 2 }),
  ])
  expect(runs.map((r) => r.streak)).toEqual([1, 2, 1])
})
