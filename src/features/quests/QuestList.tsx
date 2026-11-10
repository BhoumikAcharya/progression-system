import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { MoreHorizontal } from 'lucide-react'
import { dueDates, questDay, shiftDate } from '../../domain/scheduling/calendar'
import { questVisibility } from '../../domain/scheduling/quest-visibility'
import type { LocalDate, Schedule, StatEffects } from '../../domain/types'
import { supabaseClient } from '../../data/supabase'
import { describeError } from '../../data/errors'
import { readPreference, writePreference } from '../../data/local-preferences'
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
  version: number
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
interface StreakRow {
  quest_id: string
  outcome_id: string | null
  generation: number
  current_length: number
  last_scheduled_date: LocalDate | null
}
interface ScheduledQuest {
  quest: QuestRow
  nextDue: LocalDate | null
}
const DEFAULT_ZONE = 'Asia/Kolkata'
const ZONE_KEY = 'progression.time-zone.v1'
const RECONCILED_KEY = 'progression.reconciled-day.v1'
const ROLLOVER_CHECK_MS = 60_000
/** Per-tab store for the reconciled day. Falls back to nothing when storage is blocked. */
function sessionPreferences() {
  try {
    return window.sessionStorage
  } catch {
    return undefined
  }
}

/** Current period for a quest on the given day, newest generation first. */
function currentPeriod(quest: QuestRow, day: LocalDate) {
  return [...quest.quest_schedule_periods]
    .sort((a, b) => b.generation - a.generation)
    .find(
      (period) =>
        period.active_from <= day && (!period.active_through || period.active_through >= day),
    )
}
/** Live only while no scheduled day between the last completion and today was missed. */
function liveStreak(quest: QuestRow, streak: StreakRow | undefined, day: LocalDate): number {
  if (!streak || streak.current_length === 0 || !streak.last_scheduled_date) return 0
  const period = currentPeriod(quest, day)
  if (!period || period.generation !== streak.generation) return 0
  if (streak.last_scheduled_date >= day) return streak.current_length
  const missed = dueDates(
    period.schedule_spec,
    shiftDate(streak.last_scheduled_date, 1),
    shiftDate(day, -1),
  )
  return missed.length ? 0 : streak.current_length
}
export function QuestList() {
  const { pathname } = useLocation()
  const [quests, setQuests] = useState<QuestRow[]>([])
  const [scheduled, setScheduled] = useState<ScheduledQuest[]>([])
  const [occurrences, setOccurrences] = useState<OccurrenceRow[]>([])
  const [results, setResults] = useState<ResultRow[]>([])
  const [stepCompletions, setStepCompletions] = useState<StepCompletionRow[]>([])
  const [streaks, setStreaks] = useState<StreakRow[]>([])
  const [zone, setZone] = useState(DEFAULT_ZONE)
  const [day, setDay] = useState<LocalDate | null>(null)
  const [loading, setLoading] = useState(true)
  // Set after the first load answers. Later refreshes keep the current cards on screen.
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [pending, setPending] = useState<string | null>(null)
  const [menu, setMenu] = useState<string | null>(null)
  const loadSequence = useRef(0)
  const configured = Boolean(
    import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  )
  const load = useCallback(async () => {
    if (!configured) {
      setLoading(false)
      setLoaded(true)
      return
    }
    const sequence = ++loadSequence.current
    setLoading(true)
    setError('')
    try {
      const db = supabaseClient()
      // The account zone is cached so the day is known before the first byte arrives.
      const cachedZone = readPreference(ZONE_KEY) ?? DEFAULT_ZONE
      const currentDay = questDay(new Date(), cachedZone)
      // Closed days are reconciled once per quest day per tab, not on every refresh.
      if (readPreference(RECONCILED_KEY, sessionPreferences()) !== currentDay) {
        const { error: reconcileError } = await db.rpc('reconcile_closed_quests')
        if (reconcileError) throw reconcileError
        writePreference(RECONCILED_KEY, currentDay, sessionPreferences())
      }
      // Everything the page needs in one parallel round trip.
      const [profile, definitions, occurrenceRows, stepRows, awardRows, streakRows] =
        await Promise.all([
          db.from('profiles').select('time_zone').single(),
          db
            .from('quest_definitions')
            .select(
              'id,type,name,version,effects,quest_schedule_periods(id,generation,active_from,active_through,schedule_spec),quest_outcomes(id,label,effects,slot),routine_steps(id,name,ordinal)',
            )
            .eq('state', 'active')
            .order('created_at'),
          db
            .from('quest_occurrences')
            .select('id,quest_id,status,selected_outcome_id,version')
            .eq('scheduled_date', currentDay),
          db
            .from('routine_step_completions')
            .select('occurrence_id,step_id,quest_occurrences!inner(scheduled_date)')
            .eq('quest_occurrences.scheduled_date', currentDay)
            .not('completed_at', 'is', null),
          db
            .from('reward_source_events')
            .select(
              'id,source_id,stat_ledger_entries(stat_key,effective_delta),xp_ledger_entries(credit_delta,reason)',
            )
            .eq('source_type', 'quest')
            .eq('scheduled_date', currentDay)
            .eq('valid', true),
          db
            .from('streak_states')
            .select('quest_id,outcome_id,generation,current_length,last_scheduled_date'),
        ])
      for (const result of [profile, definitions, occurrenceRows, stepRows, awardRows, streakRows])
        if (result.error) throw result.error
      if (!profile.data) throw new Error('Profile unavailable')
      if (
        profile.data.time_zone !== cachedZone &&
        writePreference(ZONE_KEY, profile.data.time_zone)
      ) {
        // First load on this device, or the account zone changed: redo with the right day.
        // Only when the zone could be stored, so a blocked storage cannot loop.
        if (sequence === loadSequence.current) {
          loadSequence.current--
          await load()
        }
        return
      }
      const classified = ((definitions.data ?? []) as unknown as QuestRow[]).map((quest) => ({
        quest,
        visibility: questVisibility(quest.quest_schedule_periods, currentDay),
      }))
      if (sequence !== loadSequence.current) return
      setZone(profile.data.time_zone)
      setDay(currentDay)
      setQuests(classified.filter((row) => row.visibility.dueToday).map((row) => row.quest))
      setScheduled(
        classified
          .filter((row) => !row.visibility.dueToday)
          .map((row) => ({ quest: row.quest, nextDue: row.visibility.nextDue })),
      )
      setOccurrences((occurrenceRows.data ?? []) as OccurrenceRow[])
      setStepCompletions((stepRows.data ?? []) as unknown as StepCompletionRow[])
      setResults((awardRows.data ?? []) as unknown as ResultRow[])
      setStreaks((streakRows.data ?? []) as StreakRow[])
    } catch (cause) {
      // A failed refresh keeps the last known cards visible next to the error.
      if (sequence === loadSequence.current)
        setError(describeError(cause, 'Could not load quests.'))
    } finally {
      if (sequence === loadSequence.current) {
        setLoading(false)
        setLoaded(true)
      }
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
  // The 03:00 rollover happens whether or not the tab is open. Re-read the day while it is.
  useEffect(() => {
    if (!day) return
    const interval = window.setInterval(() => {
      if (questDay(new Date(), zone) !== day) {
        setNotice('A new quest day has started. The list has been refreshed.')
        void load()
      }
    }, ROLLOVER_CHECK_MS)
    return () => window.clearInterval(interval)
  }, [day, zone, load])

  /** Refuses to write against a quest day that has already closed. */
  function dayIsCurrent(): boolean {
    if (!day) return false
    if (questDay(new Date(), zone) === day) return true
    setNotice('A new quest day has started. The list has been refreshed.')
    void load()
    return false
  }
  async function write(
    questId: string,
    action: () => PromiseLike<{ error: unknown }>,
    failure: string,
  ) {
    if (!navigator.onLine) {
      setError('Offline. Nothing was recorded.')
      return
    }
    if (!dayIsCurrent()) return
    setPending(questId)
    setError('')
    setNotice('')
    try {
      const { error: saveError } = await action()
      if (saveError) throw saveError
      setMenu(null)
      await load()
    } catch (cause) {
      setError(describeError(cause, failure))
      const code = String((cause as { message?: unknown } | null)?.message ?? '')
      if (/ROUTINE_NOT_CURRENT|QUEST_NOT_DUE|FUTURE_OCCURRENCE/.test(code)) void load()
    } finally {
      setPending(null)
    }
  }
  const db = () => supabaseClient()
  const record = (quest: QuestRow, outcomeId: string | null) =>
    write(
      quest.id,
      () =>
        db().rpc('record_quest', {
          p_quest_id: quest.id,
          p_scheduled_date: day,
          p_outcome_id: outcomeId,
        }),
      'Could not record quest. Retry safely.',
    )
  const recordLate = (quest: QuestRow, scheduledDate: LocalDate) =>
    write(
      quest.id,
      () =>
        db().rpc('record_quest', {
          p_quest_id: quest.id,
          p_scheduled_date: scheduledDate,
          p_outcome_id: null,
          p_activity_date: day,
        }),
      'Could not record this quest. Retry safely.',
    )
  const changeOutcome = (quest: QuestRow, occurrence: OccurrenceRow, outcomeId: string) =>
    write(
      quest.id,
      () =>
        db().rpc('correct_quest_occurrence', {
          p_occurrence_id: occurrence.id,
          p_expected_version: occurrence.version,
          p_new_outcome_id: outcomeId,
          p_new_activity_date: day,
        }),
      'Could not change the outcome. Refresh and retry.',
    )
  const removeCompletion = (quest: QuestRow, occurrence: OccurrenceRow) => {
    const prompt = `Remove today’s completion of ${quest.name}? Its award is withdrawn.`
    if (!window.confirm(prompt)) return
    return write(
      quest.id,
      () =>
        db().rpc('remove_quest_completion', {
          p_occurrence_id: occurrence.id,
          p_expected_version: occurrence.version,
        }),
      'Could not remove the completion. Refresh and retry.',
    )
  }
  const recordStep = (quest: QuestRow, stepId: string) =>
    write(
      quest.id,
      () =>
        db().rpc('record_routine_step', {
          p_quest_id: quest.id,
          p_scheduled_date: day,
          p_step_id: stepId,
        }),
      'Could not record step. Retry safely.',
    )
  const untickStep = (quest: QuestRow, stepId: string) =>
    write(
      quest.id,
      () =>
        db().rpc('unrecord_routine_step', {
          p_quest_id: quest.id,
          p_scheduled_date: day,
          p_step_id: stepId,
        }),
      'Could not un-tick the step. Retry safely.',
    )
  const changeState = (quest: QuestRow, action: 'archive' | 'delete') => {
    if (
      action === 'delete' &&
      !window.confirm(`Delete ${quest.name} from active management? Earned history stays.`)
    )
      return
    return write(
      quest.id,
      () =>
        db().rpc('change_quest_state', {
          p_quest_id: quest.id,
          p_action: action,
          p_expected_version: quest.version,
        }),
      'Could not update quest. Refresh and retry.',
    )
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
  const initialLoading = loading && !loaded
  const showList = loaded
  return (
    <div>
      {initialLoading && <p className="meta">Loading quests…</p>}
      {loading && loaded && (
        <p className="meta" role="status">
          Refreshing…
        </p>
      )}
      {notice && !loading && (
        <p className="save-notice" role="status">
          {notice}
        </p>
      )}
      {error && (
        <div className="form-error" role="alert">
          {error}{' '}
          <button className="outline-button" onClick={() => void load()}>
            Retry
          </button>
        </div>
      )}
      {showList && quests.length === 0 && scheduled.length === 0 && !error && (
        <EmptyState title="A clear page.">
          No quests are due today. Create one or review another day in Calendar.
        </EmptyState>
      )}
      {showList &&
        quests.map((quest) => {
          const occurrence = occurrences.find((o) => o.quest_id === quest.id)
          const done = occurrence?.status === 'completed'
          const busy = pending === quest.id
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
          const streakRow = streaks.find((row) => row.quest_id === quest.id)
          const streak = day ? liveStreak(quest, streakRow, day) : 0
          const streakOutcome =
            quest.type === 'volatile'
              ? outcomes.find((o) => o.id === streakRow?.outcome_id)?.label
              : undefined
          const streakText =
            streak > 0
              ? `Streak ${streak}${streakOutcome ? ` · ${streakOutcome}` : ''}${
                  streak % 3 === 0
                    ? ' · bonus earned'
                    : ` · bonus at ${streak + 3 - (streak % 3)}`
                }`
              : ''
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
                    {streakText ? ` · ${streakText}` : ''}
                  </p>
                </div>
                {quest.type === 'standard' && (
                  <button
                    className="quest-check"
                    aria-label={
                      done ? `Remove completion of ${quest.name}` : `Complete ${quest.name}`
                    }
                    aria-pressed={done}
                    disabled={busy}
                    onClick={() =>
                      done && occurrence
                        ? void removeCompletion(quest, occurrence)
                        : void record(quest, null)
                    }
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
                  {done && occurrence && (
                    <button
                      disabled={busy}
                      onClick={() => void removeCompletion(quest, occurrence)}
                    >
                      Remove today’s completion
                    </button>
                  )}
                  <button disabled={busy} onClick={() => void changeState(quest, 'archive')}>
                    Archive
                  </button>
                  <button disabled={busy} onClick={() => void changeState(quest, 'delete')}>
                    Delete
                  </button>
                </div>
              )}
              {quest.type === 'volatile' && (
                <div className="volatile-options">
                  {outcomes.map((outcome) => {
                    const isSelected = selected?.id === outcome.id
                    return (
                      <button
                        key={outcome.id}
                        aria-pressed={isSelected}
                        aria-label={
                          done
                            ? isSelected
                              ? `${outcome.label} recorded. Remove completion`
                              : `Change outcome to ${outcome.label}`
                            : `Record ${outcome.label}`
                        }
                        disabled={busy}
                        onClick={() =>
                          !done || !occurrence
                            ? void record(quest, outcome.id)
                            : isSelected
                              ? void removeCompletion(quest, occurrence)
                              : void changeOutcome(quest, occurrence, outcome.id)
                        }
                      >
                        {outcome.label}
                      </button>
                    )
                  })}
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
                          aria-label={completed ? `Un-tick ${step.name}` : `Tick ${step.name}`}
                          disabled={done || busy}
                          onClick={() =>
                            completed
                              ? void untickStep(quest, step.id)
                              : void recordStep(quest, step.id)
                          }
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
              {busy && <p className="meta">Saving…</p>}
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
      {showList && scheduled.length > 0 && (
        <section className="scheduled-quests" aria-label="Not due today">
          <h2>Not due today</h2>
          {scheduled.map(({ quest, nextDue }) => {
            const period = [...quest.quest_schedule_periods].sort(
              (a, b) => b.generation - a.generation,
            )[0]
            const missedOnce =
              !nextDue && period?.schedule_spec.kind === 'ONCE' ? period.schedule_spec.date : null
            const busy = pending === quest.id
            return (
              <div className="scheduled-quest-row" key={quest.id}>
                <span className="grow">
                  <strong>{quest.name}</strong>
                  <small>
                    {nextDue
                      ? `Next due ${nextDue}`
                      : missedOnce
                        ? `Was due ${missedOnce} · not recorded`
                        : 'Scheduled date has passed'}
                  </small>
                </span>
                {missedOnce && quest.type === 'standard' && (
                  <button
                    className="outline-button"
                    disabled={busy}
                    onClick={() => void recordLate(quest, missedOnce)}
                  >
                    Record late
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
                {menu === quest.id && (
                  <div className="hobby-actions">
                    {missedOnce && quest.type !== 'standard' && (
                      <Link to="/calendar">Record it from Calendar</Link>
                    )}
                    <button disabled={busy} onClick={() => void changeState(quest, 'archive')}>
                      Archive
                    </button>
                    <button disabled={busy} onClick={() => void changeState(quest, 'delete')}>
                      Delete
                    </button>
                  </div>
                )}
                {busy && <p className="meta">Saving…</p>}
              </div>
            )
          })}
        </section>
      )}
    </div>
  )
}
