import type { LocalDate, Schedule } from '../types'
import { dueDates, occurrenceKey, shiftDate } from './calendar'
export interface SchedulePeriod {
  sourceId: string
  generation: number
  activeFrom: LocalDate
  activeThrough: LocalDate | null
  schedule: Schedule
}
export interface ClosedOccurrence {
  key: string
  scheduledDate: LocalDate
  state: 'unreported'
}
/** Pure discovery for server reconciliation. Database uniqueness makes repeated runs safe. */
export function closedUnreported(
  periods: readonly SchedulePeriod[],
  questDay: LocalDate,
  existingKeys: ReadonlySet<string>,
): ClosedOccurrence[] {
  const lastClosed = shiftDate(questDay, -1)
  return periods.flatMap((period) => {
    const through =
      period.activeThrough && period.activeThrough < lastClosed ? period.activeThrough : lastClosed
    return dueDates(period.schedule, period.activeFrom, through)
      .map((scheduledDate) => ({
        key: occurrenceKey(period.sourceId, scheduledDate, period.generation),
        scheduledDate,
        state: 'unreported' as const,
      }))
      .filter((occurrence) => !existingKeys.has(occurrence.key))
  })
}
