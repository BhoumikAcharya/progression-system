import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { MoreHorizontal } from 'lucide-react'
import { EmptyState, PageHeader } from '../../components/ui'
import { supabaseClient } from '../../data/supabase'
import { describeError } from '../../data/errors'
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
const configured = Boolean(
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
)
const DEFAULT_ZONE = 'Asia/Kolkata'
function effectsText(effects: StatEffects | Partial<StatEffects>) {
  return Object.entries(effects)
    .filter(([, value]) => value !== 0)
    .map(([key, value]) => `${key} ${value > 0 ? '+' : ''}${value}`)
    .join(' · ')
}
export function HobbiesPage() {
  const [hobbies, setHobbies] = useState<HobbyRow[]>([])
  const [occurrences, setOccurrences] = useState<OccurrenceRow[]>([])
  const [zone, setZone] = useState(DEFAULT_ZONE)
  const [day, setDay] = useState<LocalDate>(() => questDay(new Date(), DEFAULT_ZONE))
  const [loading, setLoading] = useState(configured)
  const [loaded, setLoaded] = useState(!configured)
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [showDone, setShowDone] = useState<Record<string, boolean>>({})
  const load = useCallback(async () => {
    if (!configured) return
    setLoading(true)
    try {
      const db = supabaseClient()
      const { data: profile, error: profileError } = await db
        .from('profiles')
        .select('time_zone')
        .single()
      if (profileError || !profile) throw profileError ?? new Error('Profile unavailable')
      const { data, error: hobbyError } = await db
        .from('hobbies')
        .select(
          'id,name,description,version,finish_effects,hobby_steps(id,name,effects,ordinal,state,repeatable)',
        )
        .eq('state', 'active')
        .order('created_at')
      if (hobbyError) throw hobbyError
      const active = (data ?? []) as unknown as HobbyRow[]
      const ids = active.flatMap((hobby) => hobby.hobby_steps.map((step) => step.id))
      let nextOccurrences: OccurrenceRow[] = []
      if (ids.length) {
        const { data: rows, error: occurrenceError } = await db
          .from('hobby_occurrences')
          .select('id,step_id,scheduled_date,actual_activity_date,version')
          .in('step_id', ids)
          .not('completed_at', 'is', null)
        if (occurrenceError) throw occurrenceError
        nextOccurrences = (rows ?? []) as OccurrenceRow[]
      }
      setZone(profile.time_zone)
      setDay(questDay(new Date(), profile.time_zone))
      setHobbies(active)
      setOccurrences(nextOccurrences)
      setError('')
    } catch (cause) {
      // A failed refresh keeps the last known cards visible next to the error.
      setError(describeError(cause, 'Could not load hobbies.'))
    } finally {
      setLoading(false)
      setLoaded(true)
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
  const undo = (step: HobbyStep, occurrence: OccurrenceRow) => {
    if (!window.confirm(`Remove today’s completion of ${step.name}? Its award is withdrawn.`))
      return
    return write(
      step.id,
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
          const forStep = (step: HobbyStep) =>
            occurrences
              .filter((row) => row.step_id === step.id)
              .sort((a, b) => b.scheduled_date.localeCompare(a.scheduled_date))
          const open = steps.filter((step) => {
            const done = forStep(step)
            return step.repeatable ? !done.some((row) => row.scheduled_date === day) : !done.length
          })
          const finished = steps.filter((step) => !open.includes(step))
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
              {finished.length > 0 && (
                <>
                  <button
                    className="text-link"
                    aria-expanded={Boolean(showDone[hobby.id])}
                    onClick={() =>
                      setShowDone((current) => ({ ...current, [hobby.id]: !current[hobby.id] }))
                    }
                  >
                    {showDone[hobby.id] ? 'Hide' : 'Show'} {finished.length} done
                  </button>
                  {showDone[hobby.id] && (
                    <div className="hobby-task-list hobby-done-list">
                      {finished.map((step) => {
                        const latest = forStep(step)[0]
                        const today = latest?.scheduled_date === day
                        return (
                          <div className="hobby-task completed" key={step.id}>
                            <span className="hobby-task-main">
                              <span className="empty-checkbox is-checked" aria-hidden="true">
                                ✓
                              </span>
                              <span>
                                {step.name}
                                <small>
                                  {step.repeatable ? 'Done today' : 'Done'}
                                  {latest?.actual_activity_date
                                    ? ` · ${latest.actual_activity_date}`
                                    : ''}
                                </small>
                              </span>
                              <span className="meta">{effectsText(step.effects)}</span>
                            </span>
                            {today && latest && (
                              <button
                                className="text-link"
                                disabled={busy}
                                onClick={() => void undo(step, latest)}
                              >
                                Undo
                              </button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </>
              )}
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
