import { useEffect, useState, type FormEvent } from 'react'
import { ChevronDown } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { StatEditor } from '../../components/StatEditor'
import { potentialXp, zeroStats } from '../../domain/progression/accounting'
import { accountDate } from '../../domain/scheduling/calendar'
import type { LocalDate, Schedule, StatEffects } from '../../domain/types'
import { supabaseClient } from '../../data/supabase'

interface StepDraft {
  id?: string
  name: string
  schedule: Schedule
  effects: StatEffects
}
const newStep = (): StepDraft => ({ name: '', schedule: { kind: 'DAILY' }, effects: zeroStats() })
const configured = Boolean(
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
)
function snapshot(name: string, description: string, steps: StepDraft[], effects: StatEffects) {
  return JSON.stringify({ name, description, steps, effects })
}
export function HobbyEditor({ onLeave }: { onLeave?: (type: string) => void }) {
  const navigate = useNavigate()
  const hobbyId = useParams().id
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [steps, setSteps] = useState<StepDraft[]>([newStep()])
  const [finishEffects, setFinishEffects] = useState<StatEffects>({ ...zeroStats(), INT: 5 })
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(Boolean(hobbyId))
  const [version, setVersion] = useState(1)
  const [savedSnapshot, setSavedSnapshot] = useState('')
  const [error, setError] = useState('')
  useEffect(() => {
    if (!hobbyId) return
    if (!configured) {
      const timer = window.setTimeout(() => {
        setError('Connect a private account to edit hobbies.')
        setLoading(false)
      }, 0)
      return () => window.clearTimeout(timer)
    }
    let active = true
    supabaseClient()
      .from('hobbies')
      .select(
        'name,description,version,finish_effects,hobby_steps(id,name,schedule_spec,effects,ordinal,state)',
      )
      .eq('id', hobbyId)
      .eq('state', 'active')
      .single()
      .then(({ data, error: loadError }) => {
        if (!active) return
        if (loadError || !data) {
          setError(loadError?.message ?? 'Hobby unavailable.')
          setLoading(false)
          return
        }
        setName(data.name)
        setDescription(data.description ?? '')
        setVersion(data.version)
        setFinishEffects(data.finish_effects as StatEffects)
        const loadedSteps = (
          (data.hobby_steps ?? []) as {
            id: string
            name: string
            schedule_spec: Schedule
            effects: StatEffects
            ordinal: number
            state: string
          }[]
        )
          .filter((step) => step.state === 'active')
          .sort((a, b) => a.ordinal - b.ordinal)
          .map((step) => ({
            id: step.id,
            name: step.name,
            schedule: step.schedule_spec,
            effects: step.effects,
          }))
        setSteps(loadedSteps)
        setSavedSnapshot(
          snapshot(
            data.name,
            data.description ?? '',
            loadedSteps,
            data.finish_effects as StatEffects,
          ),
        )
        setLoading(false)
      })
    return () => {
      active = false
    }
  }, [hobbyId])
  function changeStep(index: number, patch: Partial<StepDraft>) {
    setSteps((current) => current.map((step, i) => (i === index ? { ...step, ...patch } : step)))
  }
  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    if (!configured) {
      setError('Saving requires a connected private account. This hobby has not been saved.')
      return
    }
    if (!navigator.onLine) {
      setError('Offline. This hobby has not been saved.')
      return
    }
    if (
      steps.some(
        (step) =>
          !step.name.trim() ||
          (step.schedule.kind === 'WEEKDAYS' && !step.schedule.weekdays.length),
      )
    ) {
      setError('Name each subtask and select its scheduled days.')
      return
    }
    if (hobbyId && savedSnapshot) {
      const previous = JSON.parse(savedSnapshot) as { steps: StepDraft[] }
      const scheduleChanged = steps.some((step) => {
        const old = previous.steps.find((item) => item.id === step.id)
        return old && JSON.stringify(old.schedule) !== JSON.stringify(step.schedule)
      })
      if (
        scheduleChanged &&
        !window.confirm(
          'Changing a schedule updates pending dates from today. Recorded rewards remain in history. Continue?',
        )
      )
        return
    }
    setBusy(true)
    try {
      const { error: saveError } = await supabaseClient().rpc(
        hobbyId ? 'edit_hobby' : 'create_hobby',
        {
          ...(hobbyId ? { p_hobby_id: hobbyId, p_expected_version: version } : {}),
          p_name: name.trim(),
          p_description: description.trim() || null,
          p_finish_effects: finishEffects,
          p_steps: steps.map((step) => ({ ...step, name: step.name.trim() })),
        },
      )
      if (saveError) throw saveError
      navigate('/hobbies')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save hobby. Retry safely.')
    } finally {
      setBusy(false)
    }
  }
  async function finish() {
    if (!hobbyId) return
    if (snapshot(name, description, steps, finishEffects) !== savedSnapshot) {
      setError('Save your changes before finishing this hobby.')
      return
    }
    if (!window.confirm(`Finish ${name} and award its one-time bonus?`)) return
    if (!navigator.onLine) {
      setError('Offline. Nothing was changed.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const { error: saveError } = await supabaseClient().rpc('finish_hobby', {
        p_hobby_id: hobbyId,
        p_expected_version: version,
      })
      if (saveError) throw saveError
      navigate('/hub/hobby-archive')
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Could not finish hobby. Refresh and retry.',
      )
    } finally {
      setBusy(false)
    }
  }
  if (loading) return <p className="meta">Loading hobby…</p>
  return (
    <form className="quest-editor" aria-label="Hobby editor" onSubmit={submit}>
      <div className="editor-heading">
        <h2>{hobbyId ? 'Edit Hobby' : 'Add Hobby'}</h2>
        {!hobbyId && (
          <div className="quest-type-select">
            <select
              aria-label="Quest type"
              value="Hobby / Project"
              onChange={(event) => {
                if (
                  (name || description || steps.some((step) => step.name)) &&
                  !window.confirm('Discard this hobby draft?')
                )
                  return
                onLeave?.(event.target.value)
              }}
            >
              {['Standard', 'Volatile', 'Routine', 'Hobby / Project'].map((type) => (
                <option key={type}>{type}</option>
              ))}
            </select>
            <ChevronDown size={16} strokeWidth={1.75} aria-hidden="true" />
          </div>
        )}
      </div>
      <label className="editor-field">
        <span className="section-label">Hobby name</span>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Name your project"
          maxLength={200}
          required
        />
      </label>
      <label className="editor-field">
        <span className="section-label">Description · optional</span>
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={2}
          placeholder="Add a description"
        />
      </label>
      <div className="editor-field">
        <span className="section-label">Scheduled subtasks · each earns independently</span>
        {steps.map((step, index) => (
          <div className="hobby-step-editor" key={index}>
            <div className="routine-edit-row">
              <input
                aria-label={`Hobby subtask ${index + 1}`}
                value={step.name}
                onChange={(event) => changeStep(index, { name: event.target.value })}
                placeholder={`Subtask ${index + 1}`}
                required
                maxLength={200}
              />
              <button
                type="button"
                aria-label={`Remove hobby subtask ${index + 1}`}
                disabled={steps.length === 1}
                onClick={() => setSteps((current) => current.filter((_, i) => i !== index))}
              >
                ×
              </button>
              {hobbyId && (
                <>
                  <button
                    type="button"
                    aria-label={`Move subtask ${index + 1} up`}
                    disabled={index === 0}
                    onClick={() =>
                      setSteps((current) => {
                        const next = [...current]
                        ;[next[index - 1], next[index]] = [next[index]!, next[index - 1]!]
                        return next
                      })
                    }
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    aria-label={`Move subtask ${index + 1} down`}
                    disabled={index === steps.length - 1}
                    onClick={() =>
                      setSteps((current) => {
                        const next = [...current]
                        ;[next[index], next[index + 1]] = [next[index + 1]!, next[index]!]
                        return next
                      })
                    }
                  >
                    ↓
                  </button>
                </>
              )}
            </div>
            <label className="small-field">
              Schedule
              <select
                aria-label={`Schedule for subtask ${index + 1}`}
                value={step.schedule.kind}
                onChange={(event) => {
                  const kind = event.target.value
                  const schedule: Schedule =
                    kind === 'WEEKDAYS'
                      ? { kind, weekdays: [] }
                      : kind === 'MONTHLY'
                        ? { kind, day: 1 }
                        : kind === 'YEARLY'
                          ? { kind, month: 1, day: 1 }
                          : kind === 'ONCE'
                            ? { kind, date: accountDate(new Date(), 'Asia/Kolkata') }
                            : { kind: 'DAILY' }
                  changeStep(index, { schedule })
                }}
              >
                <option value="DAILY">Every Day</option>
                <option value="WEEKDAYS">Days</option>
                <option value="MONTHLY">Monthly</option>
                <option value="YEARLY">Yearly</option>
                <option value="ONCE">Once</option>
              </select>
            </label>
            {step.schedule.kind === 'WEEKDAYS' && (
              <div
                className="weekday-options"
                role="group"
                aria-label={`Days for subtask ${index + 1}`}
              >
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, i) => (
                  <button
                    type="button"
                    key={day}
                    aria-pressed={
                      step.schedule.kind === 'WEEKDAYS' && step.schedule.weekdays.includes(i + 1)
                    }
                    onClick={() => {
                      if (step.schedule.kind !== 'WEEKDAYS') return
                      const weekdays = step.schedule.weekdays.includes(i + 1)
                        ? step.schedule.weekdays.filter((n) => n !== i + 1)
                        : [...step.schedule.weekdays, i + 1].sort()
                      changeStep(index, { schedule: { kind: 'WEEKDAYS', weekdays } })
                    }}
                  >
                    {day}
                  </button>
                ))}
              </div>
            )}
            {(step.schedule.kind === 'MONTHLY' || step.schedule.kind === 'YEARLY') && (
              <div className="date-pair">
                {step.schedule.kind === 'YEARLY' && (
                  <label className="small-field">
                    Month
                    <input
                      type="number"
                      min={1}
                      max={12}
                      value={step.schedule.month}
                      onChange={(event) =>
                        step.schedule.kind === 'YEARLY' &&
                        changeStep(index, {
                          schedule: { ...step.schedule, month: Number(event.target.value) },
                        })
                      }
                    />
                  </label>
                )}
                <label className="small-field">
                  Day
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={step.schedule.day}
                    onChange={(event) =>
                      (step.schedule.kind === 'MONTHLY' || step.schedule.kind === 'YEARLY') &&
                      changeStep(index, {
                        schedule: { ...step.schedule, day: Number(event.target.value) },
                      })
                    }
                  />
                </label>
              </div>
            )}
            {step.schedule.kind === 'ONCE' && (
              <label className="small-field">
                Date
                <input
                  type="date"
                  value={step.schedule.date}
                  onChange={(event) =>
                    changeStep(index, {
                      schedule: { kind: 'ONCE', date: event.target.value as LocalDate },
                    })
                  }
                />
              </label>
            )}
            <p className="section-label">Subtask effects</p>
            <StatEditor
              effects={step.effects}
              onChange={(effects) => changeStep(index, { effects })}
            />
            <p className="meta">Potential +{potentialXp(step.effects)} XP per completion</p>
          </div>
        ))}
        <button
          type="button"
          className="text-link"
          onClick={() => setSteps((current) => [...current, newStep()])}
        >
          + Add subtask
        </button>
      </div>
      <div className="editor-field">
        <span className="section-label">One-time Finish reward</span>
        <StatEditor effects={finishEffects} onChange={setFinishEffects} />
        <p className="meta">Potential +{potentialXp(finishEffects)} XP when finished, once.</p>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {!configured && (
        <p className="editor-note">
          Local preview · connect your private Supabase account to save hobbies.
        </p>
      )}
      <button className="save-button" type="submit" disabled={busy}>
        {busy ? 'Saving…' : hobbyId ? 'Save Changes' : 'Save Hobby'}
      </button>
      {hobbyId && (
        <button className="text-link" type="button" disabled={busy} onClick={() => void finish()}>
          Finish Hobby
        </button>
      )}
      <button
        className="text-link"
        type="button"
        onClick={() => navigate(hobbyId ? '/hobbies' : '/quests')}
      >
        Back to {hobbyId ? 'hobbies' : 'quests'}
      </button>
    </form>
  )
}
