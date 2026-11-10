import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { MoreHorizontal } from 'lucide-react'
import { EmptyState, PageHeader } from '../../components/ui'
import { supabaseClient } from '../../data/supabase'
import { describeError } from '../../data/errors'
import { readPreference, writePreference } from '../../data/local-preferences'
import { questDay } from '../../domain/scheduling/calendar'
import type { LocalDate, StatEffects } from '../../domain/types'

interface HobbyStep {
  id: string
  name: string
  effects: StatEffects
  ordinal: number
  state: string
  repeatable: boolean
}
interface HobbyRow {
  id: string
  name: string
  description: string | null
  version: number
  finish_effects: StatEffects
  hobby_steps: HobbyStep[]
}
interface OccurrenceRow {
  id: string
  step_id: string
  scheduled_date: LocalDate
  actual_activity_date: LocalDate | null
  version: number
}
/** One valid award for a hobby task, kept even when the task was later deleted or edited. */
interface CompletionRow {
  id: string
  source_id: string
  activity_date: LocalDate
  config_snapshot: { hobby_id?: string; step_name?: string; step_id?: string }
  stat_ledger_entries: { stat_key: string; effective_delta: number }[]
  xp_ledger_entries: { credit_delta: number; reason: string }[]
}
const configured = Boolean(
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
)
const DEFAULT_ZONE = 'Asia/Kolkata'
const ZONE_KEY = 'progression.time-zone.v1'
function effectsText(effects: StatEffects | Partial<StatEffects>) {
  return Object.entries(effects)
    .filter(([, value]) => value !== 0)
    .map(([key, value]) => `${key} ${value > 0 ? '+' : ''}${value}`)
    .join(' · ')
}
function ledgerText(entries: CompletionRow['stat_ledger_entries']) {
  return (
    entries
      .filter((entry) => entry.effective_delta !== 0)
      .map(
        (entry) =>
          `${entry.stat_key} ${entry.effective_delta > 0 ? '+' : ''}${entry.effective_delta}`,
      )
      .join(' · ') || 'No stat change'
  )
}
export function HobbiesPage() {
  const [hobbies, setHobbies] = useState<HobbyRow[]>([])
  const [occurrences, setOccurrences] = useState<OccurrenceRow[]>([])
  const [completions, setCompletions] = useState<CompletionRow[]>([])
  const [zone, setZone] = useState(() => readPreference(ZONE_KEY) ?? DEFAULT_ZONE)
  const [day, setDay] = useState<LocalDate>(() =>
    questDay(new Date(), readPreference(ZONE_KEY) ?? DEFAULT_ZONE),
  )
  const [loading, setLoading] = useState(configured)
  const [loaded, setLoaded] = useState(!configured)
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [history, setHistory] = useState<Record<string, boolean>>({})
  const loadSequence = useRef(0)
  const load = useCallback(async () => {
    if (!configured) return
    const sequence = ++loadSequence.current
    setLoading(true)
    try {
      const db = supabaseClient()
      // One parallel round trip. Completed rows and awards are owner-scoped by RLS.
      const [profile, hobbyRows, occurrenceRows, awardRows] = await Promise.all([
        db.from('profiles').select('time_zone').single(),
        db
          .from('hobbies')
          .select(
            'id,name,description,version,finish_effects,hobby_steps(id,name,effects,ordinal,state,repeatable)',
          )
          .eq('state', 'active')
          .order('created_at'),
        db
          .from('hobby_occurrences')
          .select('id,step_id,scheduled_date,actual_activity_date,version')
          .not('completed_at', 'is', null),
        db
          .from('reward_source_events')
          .select(
            'id,source_id,activity_date,config_snapshot,stat_ledger_entries(stat_key,effective_delta),xp_ledger_entries(credit_delta,reason)',
          )
          .eq('source_type', 'hobby')
          .eq('valid', true)
          .order('activity_date', { ascending: false })
          .order('recorded_at', { ascending: false }),
      ])
      for (const result of [profile, hobbyRows, occurrenceRows, awardRows])
        if (result.error) throw result.error
      if (!profile.data) throw new Error('Profile unavailable')
      if (sequence !== loadSequence.current) return
      writePreference(ZONE_KEY, profile.data.time_zone)
      setZone(profile.data.time_zone)
      setDay(questDay(new Date(), profile.data.time_zone))
      setHobbies((hobbyRows.data ?? []) as unknown as HobbyRow[])
      setOccurrences((occurrenceRows.data ?? []) as OccurrenceRow[])
      setCompletions((awardRows.data ?? []) as unknown as CompletionRow[])
      setError('')
    } catch (cause) {
      // A failed refresh keeps the last known cards visible next to the error.
      if (sequence === loadSequence.current)
        setError(describeError(cause, 'Could not load hobbies.'))
    } finally {
      if (sequence === loadSequence.current) {
        setLoading(false)
        setLoaded(true)
      }
    }
  }, [])
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    const focus = () => void load()
    window.addEventListener('focus', focus)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('focus', focus)
    }
  }, [load])
  // Repeatable tasks reset at the 03:00 rollover, so re-read the day while the tab stays open.
  useEffect(() => {
    const interval = window.setInterval(() => {
      if (questDay(new Date(), zone) !== day) void load()
    }, 60_000)
    return () => window.clearInterval(interval)
  }, [day, zone, load])
  async function write(id: string, action: () => PromiseLike<{ error: unknown }>, failure: string) {
    if (!navigator.onLine) {
      setError('Offline. Nothing was changed.')
      return
    }
    setPending(id)
    setError('')
    try {
      const { error: saveError } = await action()
      if (saveError) throw saveError
      await load()
    } catch (cause) {
      setError(describeError(cause, failure))
    } finally {
      setPending(null)
    }
  }
  const complete = (step: HobbyStep) =>
    write(
      step.id,
      () => supabaseClient().rpc('complete_hobby_task', { p_step_id: step.id }),
      'Could not record the task. Refresh and retry.',
    )
  const undo = (label: string, occurrence: OccurrenceRow) => {
    if (!window.confirm(`Remove today’s completion of ${label}? Its award is withdrawn.`)) return
    return write(
      occurrence.step_id,
      () =>
        supabaseClient().rpc('correct_hobby_occurrence', {
          p_occurrence_id: occurrence.id,
          p_expected_version: occurrence.version,
          p_new_activity_date: null,
          p_new_effects: null,
          p_remove: true,
        }),
      'Could not remove the completion. Refresh and retry.',
    )
  }
  const change = (hobby: HobbyRow, action: 'archive' | 'delete' | 'finish') => {
    if (
      (action === 'delete' || action === 'finish') &&
      !window.confirm(
        action === 'finish'
          ? `Finish ${hobby.name} and award its one-time bonus?`
          : `Delete ${hobby.name} from active management? Earned history stays.`,
      )
    )
      return
    return write(
      hobby.id,
      () =>
        action === 'finish'
          ? supabaseClient().rpc('finish_hobby', {
              p_hobby_id: hobby.id,
              p_expected_version: hobby.version,
            })
          : supabaseClient().rpc('change_hobby_state', {
              p_hobby_id: hobby.id,
              p_action: action,
              p_expected_version: hobby.version,
            }),
      'Could not update hobby. Refresh and retry.',
    )
  }
  return (
    <>
      <PageHeader title="Hobbies" subtitle="Projects & long-running goals · no deadlines" />
      {error && (
        <p className="form-error" role="alert">
          {error}{' '}
          <button className="text-link" onClick={() => void load()}>
            Refresh
          </button>
        </p>
      )}
      {loading && !loaded && <p className="meta">Loading hobbies…</p>}
      {loading && loaded && (
        <p className="meta" role="status">
          Refreshing…
        </p>
      )}
      {loaded && hobbies.length === 0 && !error && (
        <EmptyState title="Room for something meaningful.">
          No active hobbies yet. Create a Hobby / Project from Quests.
        </EmptyState>
      )}
      {loaded &&
        hobbies.map((hobby) => {
          const steps = [...hobby.hobby_steps]
            .filter((step) => step.state === 'active')
            .sort((a, b) => a.ordinal - b.ordinal)
          const stepIds = new Set(hobby.hobby_steps.map((step) => step.id))
          const forStep = (step: HobbyStep) =>
            occurrences
              .filter((row) => row.step_id === step.id)
              .sort((a, b) => b.scheduled_date.localeCompare(a.scheduled_date))
          const open = steps.filter((step) => {
            const done = forStep(step)
            return step.repeatable ? !done.some((row) => row.scheduled_date === day) : !done.length
          })
          const completed = completions.filter(
            (row) =>
              row.config_snapshot.hobby_id === hobby.id ||
              (row.config_snapshot.step_id ? stepIds.has(row.config_snapshot.step_id) : false),
          )
          const busy = Boolean(pending)
          return (
            <article className="hobby-card" key={hobby.id} aria-label={hobby.name}>
              <div className="hobby-head">
                <div>
                  <h2>{hobby.name}</h2>
                  {hobby.description && <p className="meta">{hobby.description}</p>}
                </div>
                <button
                  className="icon-button"
                  aria-label={`Options for ${hobby.name}`}
                  aria-expanded={expanded === hobby.id}
                  onClick={() => setExpanded(expanded === hobby.id ? null : hobby.id)}
                >
                  <MoreHorizontal size={22} />
                </button>
              </div>
              {expanded === hobby.id && (
                <div className="hobby-actions">
                  <Link to={`/hobbies/${hobby.id}/edit`}>Edit tasks</Link>
                  <button disabled={busy} onClick={() => void change(hobby, 'archive')}>
                    Archive
                  </button>
                  <button disabled={busy} onClick={() => void change(hobby, 'finish')}>
                    Finish
                  </button>
                  <button disabled={busy} onClick={() => void change(hobby, 'delete')}>
                    Delete
                  </button>
                </div>
              )}
              {open.length ? (
                <div className="hobby-task-list">
                  {open.map((step) => {
                    const times = forStep(step).length
                    return (
                      <div className="hobby-task" key={step.id}>
                        <button
                          className="hobby-task-main"
                          aria-label={`Complete ${step.name}`}
                          disabled={busy}
                          onClick={() => void complete(step)}
                        >
                          <span className="empty-checkbox" aria-hidden="true" />
                          <span>
                            {step.name}
                            {step.repeatable && (
                              <small>
                                Repeatable · once per day
                                {times ? ` · done ${times} ${times === 1 ? 'time' : 'times'}` : ''}
                              </small>
                            )}
                          </span>
                          <span className="meta">
                            {effectsText(step.effects) || 'No stat effect'}
                          </span>
                        </button>
                        {pending === step.id && <p className="meta">Saving…</p>}
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="meta">
                  {steps.length
                    ? 'All wrapped up for now. Add more tasks or finish the hobby.'
                    : 'No tasks yet. Add some from Edit tasks.'}
                </p>
              )}
              <details
                className="hobby-history"
                open={Boolean(history[hobby.id])}
                onToggle={(event) =>
                  setHistory((current) => ({
                    ...current,
                    [hobby.id]: (event.target as HTMLDetailsElement).open,
                  }))
                }
              >
                <summary>Completed ({completed.length})</summary>
                {completed.length ? (
                  <div className="hobby-task-list hobby-done-list">
                    {completed.map((row) => {
                      const occurrence = occurrences.find((o) => o.id === row.source_id)
                      const today = occurrence?.scheduled_date === day
                      const label = row.config_snapshot.step_name ?? 'Task'
                      const xp = row.xp_ledger_entries
                        .filter((entry) => entry.reason === 'current_award')
                        .reduce((sum, entry) => sum + Number(entry.credit_delta), 0)
                      return (
                        <div className="hobby-task completed" key={row.id}>
                          <span className="hobby-task-main">
                            <span className="empty-checkbox is-checked" aria-hidden="true">
                              ✓
                            </span>
                            <span>
                              {label}
                              <small>
                                <time dateTime={row.activity_date}>{row.activity_date}</time>
                                {today ? ' · today' : ''}
                              </small>
                            </span>
                            <span className="meta">
                              {ledgerText(row.stat_ledger_entries)} · +{xp} XP
                            </span>
                          </span>
                          {today && occurrence && (
                            <button
                              className="text-link"
                              disabled={busy}
                              onClick={() => void undo(label, occurrence)}
                            >
                              Undo
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="meta">Nothing completed yet.</p>
                )}
              </details>
              <p className="meta">
                Finish reward: {effectsText(hobby.finish_effects) || 'No stat effect'}
              </p>
            </article>
          )
        })}
      <Link className="text-link" to="/quests/new?type=hobby">
        + Add Hobby / Project <span aria-hidden="true">›</span>
      </Link>
    </>
  )
}
