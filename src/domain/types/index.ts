export const STAT_KEYS = ['STR', 'INT', 'VIT', 'DIS', 'BNK'] as const
export type StatKey = (typeof STAT_KEYS)[number]
export type StatEffects = Record<StatKey, number>
export type Theme = 'inked-fantasy' | 'oled-black'
export type Energy = 'Excellent' | 'Medium' | 'Low' | null
/** Calendar DATE, not a UTC timestamp. Validate at the repository boundary. */
export type LocalDate = `${number}-${number}-${number}`
export interface PlayerProfile {
  displayName: string
  timeZone: string
  theme: Theme
  stats: StatEffects
  correctedLifetimeXp: number
  highestLevelAchieved: number
  energy: Energy
}
export type Schedule =
  | { kind: 'DAILY' }
  | { kind: 'WEEKDAYS'; weekdays: number[] }
  | { kind: 'MONTHLY'; day: number }
  | { kind: 'YEARLY'; month: number; day: number }
  | { kind: 'ONCE'; date: LocalDate }
export interface QuestBase {
  id: string
  ownerUserId: string
  name: string
  schedule: Schedule
  version: number
  state: 'active' | 'archived' | 'deleted'
}
export type Quest = QuestBase &
  (
    | { type: 'standard'; effects: StatEffects }
    | { type: 'volatile'; outcomes: [Outcome, Outcome] }
    | { type: 'routine'; steps: { id: string; name: string }[]; effects: StatEffects }
  )
export interface Outcome {
  id: string
  label: string
  effects: StatEffects
}
export interface Occurrence {
  id: string
  questId: string
  scheduledDate: LocalDate
  actualActivityDate: LocalDate | null
  status: 'unreported' | 'partial' | 'completed'
  selectedOutcomeId: string | null
  version: number
}
export interface Hobby {
  id: string
  ownerUserId: string
  name: string
  state: 'active' | 'archived' | 'finished' | 'deleted'
  finishEffects: StatEffects
  steps: { id: string; name: string; schedule: Schedule; effects: StatEffects }[]
  version: number
}
export interface SleepRecord {
  id: string
  ownerUserId: string
  sleepNightDate: LocalDate
  category: 'EARLY' | 'MIDDLE' | 'LATE'
  version: number
}
export interface TodoItem {
  id: string
  title: string
  done: boolean
  archived: boolean
  children: Omit<TodoItem, 'children'>[]
}
