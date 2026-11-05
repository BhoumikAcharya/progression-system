/** Calendar browsing only. Quest-day and sleep-night logic belongs to the M2 scheduler. */
export function accountCalendarDate(instant = new Date(), timeZone = 'Asia/Kolkata'): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant)
  const part = (key: string) => Number(parts.find((p) => p.type === key)?.value)
  return new Date(Date.UTC(part('year'), part('month') - 1, part('day'), 12))
}
export function addDays(date: Date, days: number) {
  const result = new Date(date)
  result.setUTCDate(result.getUTCDate() + days)
  return result
}
export function monthCells(date: Date): (Date | null)[] {
  const year = date.getUTCFullYear(),
    month = date.getUTCMonth()
  const first = new Date(Date.UTC(year, month, 1, 12))
  const count = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  return [
    ...Array<null>(first.getUTCDay()).fill(null),
    ...Array.from({ length: count }, (_, i) => new Date(Date.UTC(year, month, i + 1, 12))),
  ]
}
export function dateKey(date: Date) {
  return date.toISOString().slice(0, 10)
}
export function formatDate(date: Date, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat('en-GB', { ...options, timeZone: 'UTC' }).format(date)
}
