import { STAT_KEYS, type LocalDate, type StatEffects } from '../types'

export interface HistoryEvent {
  id: string
  source_type: 'quest' | 'hobby' | 'finish' | 'sleep'
  source_id: string
  scheduled_date: LocalDate | null
  activity_date: LocalDate
  config_snapshot: Record<string, unknown>
  raw_effects: Partial<StatEffects>
  streak_effects: Partial<StatEffects>
  stat_ledger_entries: { stat_key: string; effective_delta: number }[]
  xp_ledger_entries: { credit_delta: number; reason: string }[]
}
export interface DaySummary {
  recorded: boolean
  gained: number
  lost: number
  net: number
  xp: number
  quests: number
  stats: StatEffects
}
export function summarizeDay(events: readonly HistoryEvent[], day: LocalDate): DaySummary {
  const matches = events.filter((event) => event.activity_date === day)
  const stats = Object.fromEntries(STAT_KEYS.map((key) => [key, 0])) as StatEffects
  let gained = 0
  let lost = 0
  let xp = 0
  for (const event of matches) {
    for (const entry of event.stat_ledger_entries) {
      if (!STAT_KEYS.includes(entry.stat_key as (typeof STAT_KEYS)[number])) continue
      const key = entry.stat_key as (typeof STAT_KEYS)[number]
      stats[key] += entry.effective_delta
      gained += Math.max(0, entry.effective_delta)
      lost += Math.min(0, entry.effective_delta)
    }
    xp += event.xp_ledger_entries
      .filter((entry) => entry.reason === 'current_award')
      .reduce((sum, entry) => sum + Number(entry.credit_delta), 0)
  }
  return {
    recorded: matches.length > 0,
    gained,
    lost,
    net: gained + lost,
    xp,
    quests: matches.filter((event) => event.source_type === 'quest').length,
    stats,
  }
}
