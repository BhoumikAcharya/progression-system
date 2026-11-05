import type { LocalDate, Schedule } from '../types'

export function parseLocalDate(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new RangeError('Invalid local date')
  const date = new Date(`${value}T12:00:00Z`)
  if (Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== value)
    throw new RangeError('Invalid local date')
  return date
}
export function localDate(date: Date): LocalDate {
  return date.toISOString().slice(0, 10) as LocalDate
}
export function shiftDate(value: LocalDate, days: number): LocalDate {
  const date = parseLocalDate(value)
  date.setUTCDate(date.getUTCDate() + days)
  return localDate(date)
}
export function accountDate(instant: Date, timeZone: string, cutoffHour = 0): LocalDate {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant)
  const part = (kind: string) => Number(parts.find((p) => p.type === kind)?.value)
  const day =
    `${part('year')}-${String(part('month')).padStart(2, '0')}-${String(part('day')).padStart(2, '0')}` as LocalDate
  return part('hour') < cutoffHour ? shiftDate(day, -1) : day
}
export function questDay(instant: Date, timeZone: string): LocalDate {
  return accountDate(instant, timeZone, 3)
}
export function dueOn(schedule: Schedule, date: LocalDate): boolean {
  const day = parseLocalDate(date)
  switch (schedule.kind) {
    case 'DAILY':
      return true
    case 'WEEKDAYS':
      return (
        schedule.weekdays.length > 0 && schedule.weekdays.includes(((day.getUTCDay() + 6) % 7) + 1)
      )
    case 'MONTHLY': {
      if (!Number.isInteger(schedule.day) || schedule.day < 1 || schedule.day > 31)
        throw new RangeError('Invalid month day')
      const last = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth() + 1, 0)).getUTCDate()
      return day.getUTCDate() === Math.min(schedule.day, last)
    }
    case 'YEARLY': {
      if (
        !Number.isInteger(schedule.month) ||
        schedule.month < 1 ||
        schedule.month > 12 ||
        !Number.isInteger(schedule.day) ||
        schedule.day < 1 ||
        schedule.day > 31
      )
        throw new RangeError('Invalid annual day')
      const last = new Date(Date.UTC(day.getUTCFullYear(), schedule.month, 0)).getUTCDate()
      return (
        day.getUTCMonth() + 1 === schedule.month &&
        day.getUTCDate() === Math.min(schedule.day, last)
      )
    }
    case 'ONCE':
      return schedule.date === date
  }
}
export function dueDates(schedule: Schedule, from: LocalDate, through: LocalDate): LocalDate[] {
  if (from > through) return []
  const result: LocalDate[] = []
  for (let date = from; date <= through; date = shiftDate(date, 1))
    if (dueOn(schedule, date)) result.push(date)
  return result
}
export function occurrenceKey(
  sourceId: string,
  scheduledDate: LocalDate,
  generation: number,
): string {
  if (!sourceId || !Number.isSafeInteger(generation) || generation < 1)
    throw new RangeError('Invalid occurrence identity')
  parseLocalDate(scheduledDate)
  return `${sourceId}:${generation}:${scheduledDate}`
}
