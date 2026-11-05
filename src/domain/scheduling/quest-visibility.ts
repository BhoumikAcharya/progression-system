import type { LocalDate, Schedule } from '../types'
import { dueOn, shiftDate } from './calendar'

export interface QuestPeriod {
  active_from: LocalDate
  active_through: LocalDate | null
  schedule_spec: Schedule
}

export function questVisibility(periods: QuestPeriod[], day: LocalDate) {
  const applicable = periods.filter(
    (period) =>
      period.active_from <= day && (!period.active_through || period.active_through >= day),
  )
  if (applicable.some((period) => dueOn(period.schedule_spec, day)))
    return { dueToday: true, nextDue: day }

  const horizon = shiftDate(day, 366)
  let nextDue: LocalDate | null = null
  for (const period of periods) {
    const from = period.active_from > day ? period.active_from : shiftDate(day, 1)
    const through =
      period.active_through && period.active_through < horizon ? period.active_through : horizon
    for (let candidate = from; candidate <= through; candidate = shiftDate(candidate, 1)) {
      if (dueOn(period.schedule_spec, candidate)) {
        if (!nextDue || candidate < nextDue) nextDue = candidate
        break
      }
    }
  }
  return { dueToday: false, nextDue }
}
