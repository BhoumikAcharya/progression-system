import { describe, expect, it } from 'vitest'
import type { LocalDate, Schedule } from '../types'
import { questVisibility } from './quest-visibility'

const day = '2026-11-05' as LocalDate
const period = (schedule: Schedule, activeFrom: LocalDate = day) => [
  { active_from: activeFrom, active_through: null, schedule_spec: schedule },
]

describe('quest list visibility', () => {
  it('shows a newly saved daily quest on its current quest day', () => {
    expect(questVisibility(period({ kind: 'DAILY' }), day)).toEqual({
      dueToday: true,
      nextDue: day,
    })
  })
  it('keeps future one-time quests discoverable without treating them as due', () => {
    expect(questVisibility(period({ kind: 'ONCE', date: '2026-11-06' }), day)).toEqual({
      dueToday: false,
      nextDue: '2026-11-06',
    })
  })
  it('finds the next weekday, month, and year dates', () => {
    expect(questVisibility(period({ kind: 'WEEKDAYS', weekdays: [6] }), day).nextDue).toBe(
      '2026-11-07',
    )
    expect(questVisibility(period({ kind: 'MONTHLY', day: 31 }), day).nextDue).toBe('2026-11-30')
    expect(questVisibility(period({ kind: 'YEARLY', month: 2, day: 29 }), day).nextDue).toBe(
      '2027-02-28',
    )
  })
  it('does not show a quest before its active period', () => {
    expect(questVisibility(period({ kind: 'DAILY' }, '2026-11-08'), day)).toEqual({
      dueToday: false,
      nextDue: '2026-11-08',
    })
  })
  it('identifies a one-time schedule that already passed', () => {
    expect(questVisibility(period({ kind: 'ONCE', date: '2026-11-04' }), day)).toEqual({
      dueToday: false,
      nextDue: null,
    })
  })
})
