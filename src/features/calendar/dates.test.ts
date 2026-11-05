import { expect, it } from 'vitest'
import { accountCalendarDate, dateKey, monthCells } from './dates'
it('aligns Nov 4 2026 to Wednesday', () => {
  const cells = monthCells(new Date('2026-11-04T12:00:00Z'))
  expect(cells[3]?.getUTCDay()).toBe(3)
  expect(cells[3]?.getUTCDate()).toBe(4)
  expect(cells).toHaveLength(30)
})
it('preserves leading blanks and real leap-year month lengths', () => {
  const cells = monthCells(new Date('2024-02-01T12:00:00Z'))
  expect(cells.slice(0, 4)).toEqual([null, null, null, null])
  expect(cells.filter(Boolean)).toHaveLength(29)
})
it('uses the account calendar date without applying quest rollover to the calendar', () => {
  expect(dateKey(accountCalendarDate(new Date('2026-11-04T19:00:00Z')))).toBe('2026-11-05')
  expect(dateKey(accountCalendarDate(new Date('2026-12-31T20:00:00Z')))).toBe('2027-01-01')
})
