import type { Energy, SleepRecord, StatEffects } from '../types'
import { zeroStats } from './accounting'
import { shiftDate } from '../scheduling/calendar'
export function sleepEffect(category: SleepRecord['category']): {
  effects: StatEffects
  nextDayEnergy: Exclude<Energy, null>
} {
  const effects = zeroStats()
  if (category === 'EARLY') {
    effects.VIT = 1
    effects.DIS = 1
    return { effects, nextDayEnergy: 'Excellent' }
  }
  if (category === 'MIDDLE') return { effects, nextDayEnergy: 'Medium' }
  effects.DIS = -1
  return { effects, nextDayEnergy: 'Low' }
}
export function energyForDay(
  records: readonly SleepRecord[],
  date: SleepRecord['sleepNightDate'],
): Energy {
  const previous = shiftDate(date, -1)
  const record = records.find((r) => r.sleepNightDate === previous)
  return record ? sleepEffect(record.category).nextDayEnergy : null
}
