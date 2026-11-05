import type { LocalDate, StatEffects } from '../domain/types'
import type { HistoryEvent } from '../domain/history/summary'
import { supabaseClient } from './supabase'

export interface HistoryOccurrence {
  id: string
  quest_id: string
  scheduled_date: LocalDate
  actual_activity_date: LocalDate | null
  status: 'unreported' | 'partial' | 'completed'
  selected_outcome_id: string | null
  version: number
}
export interface HistoryQuest {
  id: string
  name: string
  type: 'standard' | 'volatile' | 'routine'
  effects: StatEffects
  quest_outcomes: { id: string; label: string; effects: StatEffects }[]
  routine_steps: { id: string; name: string; ordinal: number }[]
}
export interface HistorySleep {
  sleep_night_date: LocalDate
  category: 'EARLY' | 'MIDDLE' | 'LATE'
  version: number
}
export interface HistoryHobbyOccurrence {
  id: string
  step_id: string
  scheduled_date: LocalDate
  actual_activity_date: LocalDate | null
  completed_at: string | null
  version: number
}
export interface HistoryFinishAward {
  id: string
  hobby_id: string
  actual_activity_date: LocalDate
  effects_snapshot: Partial<StatEffects>
  version: number
}
export interface HistoryBundle {
  timeZone: string
  events: HistoryEvent[]
  occurrences: HistoryOccurrence[]
  quests: HistoryQuest[]
  sleep: HistorySleep[]
  hobbyOccurrences: HistoryHobbyOccurrence[]
  finishAwards: HistoryFinishAward[]
}
export async function loadHistory(from: LocalDate, through: LocalDate): Promise<HistoryBundle> {
  const db = supabaseClient()
  const [eventsResult, occurrencesResult, sleepResult, profileResult] = await Promise.all([
    db
      .from('reward_source_events')
      .select(
        'id,source_type,source_id,scheduled_date,activity_date,config_snapshot,raw_effects,streak_effects,stat_ledger_entries(stat_key,effective_delta),xp_ledger_entries(credit_delta,reason)',
      )
      .eq('valid', true)
      .gte('activity_date', from)
      .lte('activity_date', through),
    db
      .from('quest_occurrences')
      .select('id,quest_id,scheduled_date,actual_activity_date,status,selected_outcome_id,version')
      .gte('scheduled_date', from)
      .lte('scheduled_date', through),
    db
      .from('sleep_records')
      .select('sleep_night_date,category,version')
      .gte('sleep_night_date', from)
      .lte('sleep_night_date', through),
    db.from('profiles').select('time_zone').single(),
  ])
  if (eventsResult.error) throw eventsResult.error
  if (occurrencesResult.error) throw occurrencesResult.error
  if (sleepResult.error) throw sleepResult.error
  if (profileResult.error || !profileResult.data)
    throw profileResult.error ?? new Error('Profile unavailable')
  const events = (eventsResult.data ?? []) as unknown as HistoryEvent[]
  const occurrences = (occurrencesResult.data ?? []) as HistoryOccurrence[]
  const missingIds = events
    .filter((event) => event.source_type === 'quest')
    .map((event) => event.source_id)
    .filter((id) => !occurrences.some((occ) => occ.id === id))
  if (missingIds.length) {
    const { data, error } = await db
      .from('quest_occurrences')
      .select('id,quest_id,scheduled_date,actual_activity_date,status,selected_outcome_id,version')
      .in('id', missingIds)
    if (error) throw error
    occurrences.push(...((data ?? []) as HistoryOccurrence[]))
  }
  const questIds = [...new Set(occurrences.map((occ) => occ.quest_id))]
  let quests: HistoryQuest[] = []
  if (questIds.length) {
    const { data, error } = await db
      .from('quest_definitions')
      .select(
        'id,name,type,effects,quest_outcomes(id,label,effects),routine_steps(id,name,ordinal)',
      )
      .in('id', questIds)
    if (error) throw error
    quests = (data ?? []) as unknown as HistoryQuest[]
  }
  const hobbyIds = events
    .filter((event) => event.source_type === 'hobby')
    .map((event) => event.source_id)
  let hobbyOccurrences: HistoryHobbyOccurrence[] = []
  if (hobbyIds.length) {
    const { data, error } = await db
      .from('hobby_occurrences')
      .select('id,step_id,scheduled_date,actual_activity_date,completed_at,version')
      .in('id', hobbyIds)
    if (error) throw error
    hobbyOccurrences = (data ?? []) as HistoryHobbyOccurrence[]
  }
  const finishIds = events
    .filter((event) => event.source_type === 'finish')
    .map((event) => event.source_id)
  let finishAwards: HistoryFinishAward[] = []
  if (finishIds.length) {
    const { data, error } = await db
      .from('hobby_finish_awards')
      .select('id,hobby_id,actual_activity_date,effects_snapshot,version')
      .in('id', finishIds)
    if (error) throw error
    finishAwards = (data ?? []) as HistoryFinishAward[]
  }
  return {
    timeZone: profileResult.data.time_zone,
    events,
    occurrences,
    quests,
    sleep: (sleepResult.data ?? []) as HistorySleep[],
    hobbyOccurrences,
    finishAwards,
  }
}

export function questFor(bundle: HistoryBundle, questId: string): HistoryQuest | undefined {
  return bundle.quests.find((quest) => quest.id === questId)
}
export function outcomeFor(quest: HistoryQuest | undefined, outcomeId: string | null) {
  return quest?.quest_outcomes.find((outcome) => outcome.id === outcomeId)
}
