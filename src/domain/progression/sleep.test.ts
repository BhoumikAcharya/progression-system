import { expect, it } from 'vitest'
import { energyForDay, sleepEffect } from './sleep'
import { applyEffects, zeroStats } from './accounting'
it('attributes fixed sleep effect to night and Energy to next date', () => {
  const early = sleepEffect('EARLY')
  expect(early).toEqual({ effects: { ...zeroStats(), VIT: 1, DIS: 1 }, nextDayEnergy: 'Excellent' })
  expect(applyEffects(zeroStats(), early.effects).xpCredit).toBe(300)
  expect(sleepEffect('MIDDLE')).toEqual({ effects: zeroStats(), nextDayEnergy: 'Medium' })
  expect(sleepEffect('LATE').effects.DIS).toBe(-1)
  const record = {
    id: '1',
    ownerUserId: 'u',
    sleepNightDate: '2026-11-04' as const,
    category: 'EARLY' as const,
    version: 1,
  }
  expect(energyForDay([record], '2026-11-05')).toBe('Excellent')
  expect(energyForDay([record], '2026-11-04')).toBeNull()
})
