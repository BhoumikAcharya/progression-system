import { expect, it } from 'vitest'
import { accountDate, dueDates, dueOn, occurrenceKey, questDay, shiftDate } from './calendar'
it('uses 03:00 account-local quest rollover but plain account dates for sleep', () => {
  const before = new Date('2026-11-04T21:29:00Z'),
    after = new Date('2026-11-04T21:30:00Z')
  expect(questDay(before, 'Asia/Kolkata')).toBe('2026-11-04')
  expect(questDay(after, 'Asia/Kolkata')).toBe('2026-11-05')
  expect(accountDate(before, 'Asia/Kolkata')).toBe('2026-11-05')
  expect(questDay(new Date('2026-12-31T20:00:00Z'), 'Asia/Kolkata')).toBe('2026-12-31')
  expect(shiftDate('2026-12-31', 1)).toBe('2027-01-01')
})
it('uses actual weekdays and stable scheduled occurrence keys', () => {
  expect(dueOn({ kind: 'WEEKDAYS', weekdays: [1, 3, 5] }, '2026-11-04')).toBe(true)
  expect(dueDates({ kind: 'WEEKDAYS', weekdays: [1, 3, 5] }, '2026-11-02', '2026-11-06')).toEqual([
    '2026-11-02',
    '2026-11-04',
    '2026-11-06',
  ])
  expect(occurrenceKey('quest', '2026-11-04', 1)).toBe(occurrenceKey('quest', '2026-11-04', 1))
})
it('clamps monthly 31 and yearly Feb 29 only in shorter periods', () => {
  expect(dueOn({ kind: 'MONTHLY', day: 31 }, '2026-02-28')).toBe(true)
  expect(dueOn({ kind: 'MONTHLY', day: 31 }, '2026-04-30')).toBe(true)
  expect(dueOn({ kind: 'YEARLY', month: 2, day: 29 }, '2026-02-28')).toBe(true)
  expect(dueOn({ kind: 'YEARLY', month: 2, day: 29 }, '2028-02-29')).toBe(true)
  expect(dueOn({ kind: 'YEARLY', month: 2, day: 29 }, '2028-02-28')).toBe(false)
  expect(dueDates({ kind: 'ONCE', date: '2026-11-04' }, '2026-11-01', '2026-11-30')).toEqual([
    '2026-11-04',
  ])
})
it('respects DST by using named time zones rather than a fixed offset', () => {
  expect(questDay(new Date('2026-03-08T06:59:00Z'), 'America/New_York')).toBe('2026-03-07')
  expect(questDay(new Date('2026-03-08T07:00:00Z'), 'America/New_York')).toBe('2026-03-08')
})
