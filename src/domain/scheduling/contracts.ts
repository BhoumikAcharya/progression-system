import type { LocalDate, Schedule } from '../types'
// TODO M2: DST-safe 03:00 quest-day, recurrence, stable occurrence keys and reconciliation.
export interface Scheduler {
  questDay(instant: Date, timeZone: string): LocalDate
  dueDates(schedule: Schedule, from: LocalDate, through: LocalDate, timeZone: string): LocalDate[]
}
