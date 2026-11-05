import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { MoreHorizontal } from 'lucide-react'
import { EmptyState, PageHeader } from '../../components/ui'
import { supabaseClient } from '../../data/supabase'
import { dueDates, questDay, shiftDate } from '../../domain/scheduling/calendar'
import type { LocalDate, Schedule, StatEffects } from '../../domain/types'

interface HobbyStep {
  id: string
  name: string
  schedule_spec: Schedule
  effects: StatEffects
  ordinal: number
  state: string
  active_from: LocalDate
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
  step_id: string
  scheduled_date: LocalDate
}
interface RescheduleRow {
  step_id: string
  scheduled_date: LocalDate
  rescheduled_for: LocalDate
}
const configured = Boolean(
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
)
export function HobbiesPage() {
  const [hobbies, setHobbies] = useState<HobbyRow[]>([])
  const [occurrences, setOccurrences] = useState<OccurrenceRow[]>([])
  const [reschedules, setReschedules] = useState<RescheduleRow[]>([])
  const [day, setDay] = useState<LocalDate>(() => questDay(new Date(), 'Asia/Kolkata'))
  const [loading, setLoading] = useState(configured)
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [more, setMore] = useState<Record<string, number>>({})
  const [rescheduling, setRescheduling] = useState<string | null>(null)
  const [rescheduleDate, setRescheduleDate] = useState<LocalDate>(() =>
    questDay(new Date(), 'Asia/Kolkata'),
  )
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
      setDay(questDay(new Date(), profile.time_zone))
      const { data, error: hobbyError } = await db
        .from('hobbies')
        .select(
          'id,name,description,version,finish_effects,hobby_steps(id,name,schedule_spec,effects,ordinal,state,active_from)',
        )
        .eq('state', 'active')
        .order('created_at')
      if (hobbyError) throw hobbyError
      const active = (data ?? []) as unknown as HobbyRow[]
      const ids = active.flatMap((hobby) => hobby.hobby_steps.map((step) => step.id))
      let nextOccurrences: OccurrenceRow[] = []
      let nextReschedules: RescheduleRow[] = []
      if (ids.length) {
        const { data: rows, error: occurrenceError } = await db
          .from('hobby_occurrences')
          .select('step_id,scheduled_date')
          .in('step_id', ids)
          .not('completed_at', 'is', null)
        if (occurrenceError) throw occurrenceError
        nextOccurrences = (rows ?? []) as OccurrenceRow[]
        const { data: moved, error: moveError } = await db
          .from('hobby_reschedules')
          .select('step_id,scheduled_date,rescheduled_for')
          .in('step_id', ids)
        if (moveError) throw moveError
        nextReschedules = (moved ?? []) as RescheduleRow[]
      }
      setHobbies(active)
      setOccurrences(nextOccurrences)
      setReschedules(nextReschedules)
      setError('')
    } catch (cause) {
      setHobbies([])
      setOccurrences([])
      setReschedules([])
      setError(cause instanceof Error ? cause.message : 'Could not load hobbies.')
    } finally {
      setLoading(false)
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
  async function record(stepId: string, date: LocalDate) {
    if (!navigator.onLine) {
      setError('Offline. Nothing was recorded.')
      return
    }
    setPending(stepId)
    setError('')
    try {
      const { error: saveError } = await supabaseClient().rpc('record_hobby_step', {
        p_step_id: stepId,
        p_scheduled_date: date,
      })
      if (saveError) throw saveError
      await load()
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Could not record subtask. Refresh and retry.',
      )
    } finally {
      setPending(null)
    }
  }
  async function reschedule(stepId: string, scheduledDate: LocalDate) {
    if (!navigator.onLine) {
      setError('Offline. Nothing was changed.')
      return
    }
    setPending(stepId)
    setError('')
    try {
      const { error: saveError } = await supabaseClient().rpc('reschedule_hobby_step', {
        p_step_id: stepId,
        p_scheduled_date: scheduledDate,
        p_new_date: rescheduleDate,
      })
      if (saveError) throw saveError
      setRescheduling(null)
      await load()
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Could not reschedule subtask. Refresh and retry.',
      )
    } finally {
      setPending(null)
    }
  }
  async function change(hobby: HobbyRow, action: 'archive' | 'delete' | 'finish') {
    if (!navigator.onLine) {
      setError('Offline. Nothing was changed.')
      return
    }
    if (
      (action === 'delete' || action === 'finish') &&
      !window.confirm(
        action === 'finish'
          ? `Finish ${hobby.name} and award its one-time bonus?`
          : `Delete ${hobby.name} from active management? Earned history stays.`,
      )
    )
      return
    setPending(hobby.id)
    setError('')
    try {
      const db = supabaseClient()
      const { error: saveError } =
        action === 'finish'
          ? await db.rpc('finish_hobby', {
              p_hobby_id: hobby.id,
              p_expected_version: hobby.version,
            })
          : await db.rpc('change_hobby_state', {
              p_hobby_id: hobby.id,
              p_action: action,
              p_expected_version: hobby.version,
            })
      if (saveError) throw saveError
      await load()
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Could not update hobby. Refresh and retry.',
      )
    } finally {
      setPending(null)
    }
  }
  return (
    <>
      <PageHeader title="Hobbies" subtitle="Projects & long-running goals" />
      {error && (
        <p className="form-error" role="alert">
          {error}{' '}
          <button className="text-link" onClick={() => void load()}>
            Refresh
          </button>
        </p>
      )}
      {loading && <p className="meta">Loading hobbies…</p>}
      {!loading && hobbies.length === 0 && (
        <EmptyState title="Room for something meaningful.">
          No active hobbies yet. Create a Hobby / Project from Quests.
        </EmptyState>
      )}
      {!loading &&
        hobbies.map((hobby) => {
          const completed = new Set(
            occurrences
              .filter((row) => hobby.hobby_steps.some((step) => step.id === row.step_id))
              .map((row) => `${row.step_id}:${row.scheduled_date}`),
          )
          const pendingDates = hobby.hobby_steps
            .filter((step) => step.state === 'active')
            .flatMap((step) =>
              dueDates(step.schedule_spec, step.active_from, day)
                .filter((date) => !completed.has(`${step.id}:${date}`))
                .map((date) => ({
                  step,
                  date,
                  shownDate:
                    reschedules.find(
                      (row) => row.step_id === step.id && row.scheduled_date === date,
                    )?.rescheduled_for ?? date,
                })),
            )
            .filter((row) => row.shownDate <= day)
            .sort(
              (a, b) => b.shownDate.localeCompare(a.shownDate) || a.step.ordinal - b.step.ordinal,
            )
          const limit = more[hobby.id] ?? 20
          const futureDates = hobby.hobby_steps
            .filter((step) => step.state === 'active')
            .flatMap((step) => {
              const fromSchedule =
                step.schedule_spec.kind === 'ONCE' && step.schedule_spec.date > day
                  ? [step.schedule_spec.date]
                  : dueDates(step.schedule_spec, shiftDate(day, 1), shiftDate(day, 366)).slice(0, 1)
              const moved = reschedules
                .filter(
                  (row) =>
                    row.step_id === step.id &&
                    row.rescheduled_for > day &&
                    !completed.has(`${step.id}:${row.scheduled_date}`),
                )
                .map((row) => row.rescheduled_for)
              return [...fromSchedule, ...moved]
            })
            .sort()
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
                  <Link to={`/hobbies/${hobby.id}/edit`}>Edit</Link>
                  <button
                    disabled={pending === hobby.id}
                    onClick={() => void change(hobby, 'archive')}
                  >
                    Archive
                  </button>
                  <button
                    disabled={pending === hobby.id}
                    onClick={() => void change(hobby, 'finish')}
                  >
                    Finish
                  </button>
                  <button
                    disabled={pending === hobby.id}
                    onClick={() => void change(hobby, 'delete')}
                  >
                    Delete
                  </button>
                </div>
              )}
              {pendingDates.length ? (
                <div className="hobby-task-list">
                  {pendingDates.slice(0, limit).map(({ step, date, shownDate }) => {
                    const key = `${step.id}:${date}`
                    return (
                      <div className="hobby-task" key={key}>
                        <button
                          className="hobby-task-main"
                          disabled={Boolean(pending)}
                          onClick={() => void record(step.id, date)}
                        >
                          <span className="empty-checkbox" aria-hidden="true" />
                          <span>
                            {step.name}
                            <small>
                              {shownDate}
                              {shownDate < day && <em className="overdue-tag">Overdue</em>}
                              {shownDate !== date && ` · originally ${date}`}
                            </small>
                          </span>
                          <span className="meta">
                            {Object.entries(step.effects)
                              .filter(([, value]) => value !== 0)
                              .map(([key, value]) => `${key} ${value > 0 ? '+' : ''}${value}`)
                              .join(' · ')}
                          </span>
                        </button>
                        {shownDate < day && (
                          <button
                            className="text-link"
                            disabled={Boolean(pending)}
                            onClick={() => {
                              setRescheduling(rescheduling === key ? null : key)
                              setRescheduleDate(day)
                            }}
                          >
                            Reschedule
                          </button>
                        )}
                        {rescheduling === key && (
                          <div className="hobby-reschedule">
                            <label>
                              New date{' '}
                              <input
                                type="date"
                                min={day}
                                value={rescheduleDate}
                                onChange={(event) =>
                                  setRescheduleDate(event.target.value as LocalDate)
                                }
                              />
                            </label>
                            <button
                              className="outline-button"
                              disabled={Boolean(pending)}
                              onClick={() => void reschedule(step.id, date)}
                            >
                              Save date
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="meta">
                  {futureDates[0]
                    ? `Next scheduled task: ${futureDates[0]}.`
                    : 'All wrapped up for now. Schedule more tasks.'}
                </p>
              )}
              {pendingDates.length > limit && (
                <button
                  className="text-link"
                  onClick={() => setMore((current) => ({ ...current, [hobby.id]: limit + 20 }))}
                >
                  Show more overdue tasks
                </button>
              )}
              <p className="meta">
                Finish reward:{' '}
                {Object.entries(hobby.finish_effects)
                  .filter(([, value]) => value !== 0)
                  .map(([key, value]) => `${key} ${value > 0 ? '+' : ''}${value}`)
                  .join(' · ') || 'No stat effect'}
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
