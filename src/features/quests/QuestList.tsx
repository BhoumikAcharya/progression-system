import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { MoreHorizontal } from 'lucide-react'
import { questDay } from '../../domain/scheduling/calendar'
import { questVisibility } from '../../domain/scheduling/quest-visibility'
import type { LocalDate, Schedule, StatEffects } from '../../domain/types'
import { supabaseClient } from '../../data/supabase'
import { EmptyState } from '../../components/ui'
interface QuestRow {
  id: string
  type: 'standard' | 'volatile' | 'routine'
  name: string
  version: number
  effects: StatEffects
  quest_schedule_periods: {
    id: string
    generation: number
    active_from: LocalDate
    active_through: LocalDate | null
    schedule_spec: Schedule
  }[]
  quest_outcomes: { id: string; label: string; effects: StatEffects; slot: number }[]
  routine_steps: { id: string; name: string; ordinal: number }[]
}
interface OccurrenceRow {
  id: string
  quest_id: string
  status: 'unreported' | 'partial' | 'completed'
  selected_outcome_id: string | null
}
interface ResultRow {
  source_id: string
  id: string
  stat_ledger_entries: { stat_key: string; effective_delta: number }[]
  xp_ledger_entries: { credit_delta: number; reason: string }[]
}
interface StepCompletionRow {
  occurrence_id: string
  step_id: string
}
interface ScheduledQuest {
  quest: QuestRow
  nextDue: LocalDate | null
}
export function QuestList() {
  const { pathname } = useLocation()
  const [quests, setQuests] = useState<QuestRow[]>([])
  const [scheduled, setScheduled] = useState<ScheduledQuest[]>([])
  const [occurrences, setOccurrences] = useState<OccurrenceRow[]>([])
  const [results, setResults] = useState<ResultRow[]>([])
  const [stepCompletions, setStepCompletions] = useState<StepCompletionRow[]>([])
  const [day, setDay] = useState<LocalDate | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [pending, setPending] = useState<string | null>(null)
  const [menu, setMenu] = useState<string | null>(null)
  const loadSequence = useRef(0)
  const configured = Boolean(
    import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  )
  const load = useCallback(async () => {
    if (!configured) {
      setLoading(false)
      return
    }
    const sequence = ++loadSequence.current
    setLoading(true)
    setError('')
    try {
      const db = supabaseClient()
      const { data: profile, error: profileError } = await db
        .from('profiles')
        .select('time_zone')
        .single()
      if (profileError || !profile) throw profileError ?? new Error('Profile unavailable')
      const currentDay = questDay(new Date(), profile.time_zone)
      const { error: reconcileError } = await db.rpc('reconcile_closed_quests')
      if (reconcileError) throw reconcileError
      const { data: definitions, error: definitionsError } = await db
        .from('quest_definitions')
        .select(
          'id,type,name,version,effects,quest_schedule_periods(id,generation,active_from,active_through,schedule_spec),quest_outcomes(id,label,effects,slot),routine_steps(id,name,ordinal)',
        )
        .eq('state', 'active')
        .order('created_at')
      if (definitionsError) throw definitionsError
      const classified = ((definitions ?? []) as unknown as QuestRow[]).map((quest) => ({
        quest,
        visibility: questVisibility(quest.quest_schedule_periods, currentDay),
      }))
      const due = classified.filter((row) => row.visibility.dueToday).map((row) => row.quest)
      const nextScheduled = classified
        .filter((row) => !row.visibility.dueToday)
        .map((row) => ({ quest: row.quest, nextDue: row.visibility.nextDue }))
      let nextOccurrences: OccurrenceRow[] = []
      let nextResults: ResultRow[] = []
      let nextStepCompletions: StepCompletionRow[] = []
      if (due.length) {
        const ids = due.map((q) => q.id)
        const { data: rows, error: occError } = await db
          .from('quest_occurrences')
          .select('id,quest_id,status,selected_outcome_id')
          .eq('scheduled_date', currentDay)
          .in('quest_id', ids)
        if (occError) throw occError
        const current = (rows ?? []) as OccurrenceRow[]
        nextOccurrences = current
        if (current.length) {
          const { data: completedSteps, error: stepsError } = await db
            .from('routine_step_completions')
            .select('occurrence_id,step_id')
            .in(
              'occurrence_id',
              current.map((o) => o.id),
            )
            .not('completed_at', 'is', null)
          if (stepsError) throw stepsError
          nextStepCompletions = (completedSteps ?? []) as StepCompletionRow[]
          const { data: awards, error: awardError } = await db
            .from('reward_source_events')
            .select(
              'id,source_id,stat_ledger_entries(stat_key,effective_delta),xp_ledger_entries(credit_delta,reason)',
            )
            .eq('source_type', 'quest')
            .eq('valid', true)
            .in(
              'source_id',
              current.map((o) => o.id),
            )
          if (awardError) throw awardError
          nextResults = (awards ?? []) as unknown as ResultRow[]
        }
      }
      if (sequence !== loadSequence.current) return
      setDay(currentDay)
      setQuests(due)
      setScheduled(nextScheduled)
      setOccurrences(nextOccurrences)
      setResults(nextResults)
      setStepCompletions(nextStepCompletions)
    } catch (cause) {
      if (sequence === loadSequence.current) {
        const message =
          cause &&
          typeof cause === 'object' &&
          'message' in cause &&
          typeof cause.message === 'string'
            ? cause.message
            : 'Could not load quests.'
        setQuests([])
        setScheduled([])
        setOccurrences([])
        setResults([])
        setStepCompletions([])
        setError(message)
      }
    } finally {
      if (sequence === loadSequence.current) setLoading(false)
    }
  }, [configured])
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load()
    }, 0)
    const focus = () => {
      void load()
    }
    window.addEventListener('focus', focus)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('focus', focus)
    }
  }, [load, pathname])
  async function record(quest: QuestRow, outcomeId: string | null) {
    if (!navigator.onLine) {
      setError('Offline. Nothing was recorded.')
      return
    }
    if (!day) return
    setPending(quest.id)
    setError('')
    try {
      const { error: saveError } = await supabaseClient().rpc('record_quest', {
        p_quest_id: quest.id,
        p_scheduled_date: day,
        p_outcome_id: outcomeId,
      })
      if (saveError) throw saveError
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not record quest. Retry safely.')
    } finally {
      setPending(null)
    }
  }
  async function recordStep(quest: QuestRow, stepId: string) {
    if (!navigator.onLine) {
      setError('Offline. Nothing was recorded.')
      return
    }
    if (!day) return
    setPending(quest.id)
    setError('')
    try {
      const { error: saveError } = await supabaseClient().rpc('record_routine_step', {
        p_quest_id: quest.id,
        p_scheduled_date: day,
        p_step_id: stepId,
      })
      if (saveError) throw saveError
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not record step. Retry safely.')
    } finally {
      setPending(null)
    }
  }
  async function changeState(quest: QuestRow, action: 'archive' | 'delete') {
    if (!navigator.onLine) {
      setError('Offline. Nothing was changed.')
      return
    }
    if (
      action === 'delete' &&
      !window.confirm(`Delete ${quest.name} from active management? Earned history stays.`)
    )
      return
    setPending(quest.id)
    setError('')
    try {
      const { error: saveError } = await supabaseClient().rpc('change_quest_state', {
        p_quest_id: quest.id,
        p_action: action,
        p_expected_version: quest.version,
      })
      if (saveError) throw saveError
      setMenu(null)
      await load()
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Could not update quest. Refresh and retry.',
      )
    } finally {
      setPending(null)
    }
  }
  if (!configured)
    return (
      <>
        <EmptyState title="A clear page.">
          No quests have been created. Your daily activities will appear here once quest recording
          is connected.
        </EmptyState>
        <Link className="text-link" to="/quests/new">
          Explore quest setup <span aria-hidden="true">›</span>
        </Link>
      </>
    )
  return (
    <div aria-live="polite">
      {loading && <p className="meta">Loading quests…</p>}
      {error && (
        <div className="form-error" role="alert">
          {error}{' '}
          <button className="outline-button" onClick={() => void load()}>
            Retry
          </button>
        </div>
      )}
      {!loading && quests.length === 0 && scheduled.length === 0 && !error && (
        <EmptyState title="A clear page.">
          No quests are due today. Create one or review another day in Calendar.
        </EmptyState>
      )}
      {!loading &&
        quests.map((quest) => {
          const occurrence = occurrences.find((o) => o.quest_id === quest.id)
          const done = occurrence?.status === 'completed'
          const result = results.find((r) => r.source_id === occurrence?.id)
          const xp =
            result?.xp_ledger_entries.find((e) => e.reason === 'current_award')?.credit_delta ?? 0
          const changes = result?.stat_ledger_entries
            .filter((e) => e.effective_delta !== 0)
            .map((e) => `${e.stat_key} ${e.effective_delta > 0 ? '+' : ''}${e.effective_delta}`)
            .join(' · ')
          const outcomes = [...quest.quest_outcomes].sort((a, b) => a.slot - b.slot)
          const selected = outcomes.find((o) => o.id === occurrence?.selected_outcome_id)
          const completedStepIds = new Set(
            stepCompletions
              .filter((row) => row.occurrence_id === occurrence?.id)
              .map((row) => row.step_id),
          )
          return (
            <article
              className={`quest-card ${done ? 'completed' : ''}`}
              key={quest.id}
              aria-label={quest.name}
            >
              <div className="quest-card-head">
                <div className="grow">
                  <h2>{quest.name}</h2>
                  <p className="meta">
                    {quest.type === 'volatile'
                      ? 'Volatile'
                      : quest.type === 'routine'
                        ? 'Routine'
                        : 'Standard'}{' '}
                    ·{' '}
                    {done
                      ? 'Recorded'
                      : occurrence?.status === 'partial'
                        ? 'In progress'
                        : 'Unreported'}
                  </p>
                </div>
                {quest.type === 'standard' && (
                  <button
                    className="quest-check"
                    aria-label={`Complete ${quest.name}`}
                    aria-pressed={done}
                    disabled={done || pending === quest.id}
                    onClick={() => void record(quest, null)}
                  >
                    {done ? '✓' : ''}
                  </button>
                )}
                <button
                  className="icon-button"
                  aria-label={`Options for ${quest.name}`}
                  aria-expanded={menu === quest.id}
                  onClick={() => setMenu(menu === quest.id ? null : quest.id)}
                >
                  <MoreHorizontal size={22} />
                </button>
              </div>
              {menu === quest.id && (
                <div className="hobby-actions">
                  <button
                    disabled={pending === quest.id}
                    onClick={() => void changeState(quest, 'archive')}
                  >
                    Archive
                  </button>
                  <button
                    disabled={pending === quest.id}
                    onClick={() => void changeState(quest, 'delete')}
                  >
                    Delete
                  </button>
                </div>
              )}
              {quest.type === 'volatile' && (
                <div className="volatile-options">
                  {outcomes.map((outcome) => (
                    <button
                      key={outcome.id}
                      aria-pressed={selected?.id === outcome.id}
                      disabled={done || pending === quest.id}
                      onClick={() => void record(quest, outcome.id)}
                    >
                      {outcome.label}
                    </button>
                  ))}
                </div>
              )}
              {quest.type === 'routine' && (
                <div className="routine-steps">
                  {[...quest.routine_steps]
                    .sort((a, b) => a.ordinal - b.ordinal)
                    .map((step) => {
                      const completed = completedStepIds.has(step.id)
                      return (
                        <button
                          key={step.id}
                          className="routine-step"
                          aria-pressed={completed}
                          disabled={completed || done || pending === quest.id}
                          onClick={() => void recordStep(quest, step.id)}
                        >
                          <span className="routine-step-mark" aria-hidden="true">
                            {completed ? '✓' : ''}
                          </span>
                          {step.name}
                        </button>
                      )
                    })}
                </div>
              )}
              {pending === quest.id && <p className="meta">Saving…</p>}
              {done && (
                <div className="quest-result">
                  <strong>System · {selected ? `${selected.label} recorded` : 'Completed'}</strong>
                  <p>
                    {changes || 'No stat change'} · +{xp} XP
                  </p>
                </div>
              )}
            </article>
          )
        })}
      {!loading && scheduled.length > 0 && (
        <section className="scheduled-quests" aria-label="Not due today">
          <h2>Not due today</h2>
          {scheduled.map(({ quest, nextDue }) => (
            <div className="scheduled-quest-row" key={quest.id}>
              <span className="grow">
                <strong>{quest.name}</strong>
                <small>{nextDue ? `Next due ${nextDue}` : 'Scheduled date has passed'}</small>
              </span>
              <button
                className="icon-button"
                aria-label={`Options for ${quest.name}`}
                aria-expanded={menu === quest.id}
                onClick={() => setMenu(menu === quest.id ? null : quest.id)}
              >
                <MoreHorizontal size={22} />
              </button>
              {menu === quest.id && (
                <div className="hobby-actions">
                  <button
                    disabled={pending === quest.id}
                    onClick={() => void changeState(quest, 'archive')}
                  >
                    Archive
                  </button>
                  <button
                    disabled={pending === quest.id}
                    onClick={() => void changeState(quest, 'delete')}
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          ))}
        </section>
      )}
    </div>
  )
}
