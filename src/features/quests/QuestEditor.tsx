import { useRef, useState, type FormEvent } from 'react'
import { ChevronDown } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { type StatEffects } from '../../domain/types'
import { StatEditor } from '../../components/StatEditor'
import { potentialXp, zeroStats } from '../../domain/progression/accounting'
import { sessionCheckInterrupted, supabaseClient } from '../../data/supabase'
import { clearQuestCreationRequest, questCreationRequestId } from '../../data/create-request'
import { questDay } from '../../domain/scheduling/calendar'
import { Segments } from '../../components/ui'
import { HobbyEditor } from '../hobbies/HobbyEditor'
const types = ['Standard', 'Volatile', 'Routine', 'Hobby / Project'] as const
type EditorType = (typeof types)[number]
const schedules = ['Every Day', 'Days', 'Monthly', 'Yearly', 'Once'] as const
type ScheduleLabel = (typeof schedules)[number]
export function QuestEditor() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [type, setType] = useState<EditorType>(() =>
    params.get('type') === 'hobby' ? 'Hobby / Project' : 'Standard',
  )
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [schedule, setSchedule] = useState<ScheduleLabel>('Every Day')
  const [weekdays, setWeekdays] = useState<number[]>([])
  const [monthDay, setMonthDay] = useState(1)
  const [yearMonth, setYearMonth] = useState(1)
  const [onceDate, setOnceDate] = useState('')
  const [effects, setEffects] = useState(zeroStats)
  const [outcomes, setOutcomes] = useState([
    { label: 'Yes', effects: zeroStats() },
    { label: 'No', effects: zeroStats() },
  ])
  const [activeOutcome, setActiveOutcome] = useState(0)
  const [steps, setSteps] = useState<string[]>([''])
  const [busy, setBusy] = useState(false)
  const submitting = useRef(false)
  const [error, setError] = useState('')
  const configured = Boolean(
    import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  )
  const isHobby = type === 'Hobby / Project'
  const activeEffects = type === 'Volatile' ? outcomes[activeOutcome]!.effects : effects
  function setActiveEffects(value: StatEffects) {
    if (type !== 'Volatile') {
      setEffects(value)
      return
    }
    setOutcomes((current) =>
      current.map((o, i) => (i === activeOutcome ? { ...o, effects: value } : o)),
    )
  }
  function scheduleSpec() {
    if (schedule === 'Every Day') return { kind: 'DAILY' }
    if (schedule === 'Days') return { kind: 'WEEKDAYS', weekdays }
    if (schedule === 'Monthly') return { kind: 'MONTHLY', day: monthDay }
    if (schedule === 'Yearly') return { kind: 'YEARLY', month: yearMonth, day: monthDay }
    return { kind: 'ONCE', date: onceDate }
  }
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (submitting.current) return
    setError('')
    if (!configured) {
      setError('Saving requires a connected private account. This draft has not been saved.')
      return
    }
    if (!navigator.onLine) {
      setError('You are offline. This draft has not been saved.')
      return
    }
    if (schedule === 'Days' && weekdays.length === 0) {
      setError('Choose at least one weekday.')
      return
    }
    if (schedule === 'Once' && !onceDate) {
      setError('Choose a date.')
      return
    }
    if (type === 'Routine' && steps.some((s) => !s.trim())) {
      setError('Name every routine step.')
      return
    }
    submitting.current = true
    setBusy(true)
    try {
      const db = supabaseClient()
      const { data: user, error: authError } = await db.auth.getUser()
      if (authError && sessionCheckInterrupted(authError)) {
        setError('Could not reach the server. This draft has not been saved.')
        return
      }
      if (authError || !user.user) {
        navigate('/login?next=/quests/new')
        return
      }
      if (schedule === 'Once') {
        const { data: profile, error: profileError } = await db
          .from('profiles')
          .select('time_zone')
          .single()
        if (profileError || !profile) throw profileError ?? new Error('Profile unavailable')
        if (onceDate < questDay(new Date(), profile.time_zone)) {
          setError('Choose today or a future quest day for a one-time quest.')
          return
        }
      }
      const payload = {
        p_type: type.toLowerCase(),
        p_name: name.trim(),
        p_description: description.trim() || null,
        p_schedule: scheduleSpec(),
        p_effects: type === 'Volatile' ? {} : effects,
        p_outcomes: type === 'Volatile' ? outcomes : null,
        p_steps: type === 'Routine' ? steps.map((s) => s.trim()) : null,
      }
      const requestId = questCreationRequestId(payload)
      const { error: saveError } = await db.rpc('create_quest_once', {
        ...payload,
        p_request_id: requestId,
      })
      if (saveError) throw saveError
      clearQuestCreationRequest(requestId)
      navigate('/quests', { state: { questSaved: name.trim() } })
    } catch (e) {
      const message =
        e && typeof e === 'object' && 'message' in e && typeof e.message === 'string'
          ? e.message
          : 'Could not confirm the save. Retry safely with this draft.'
      setError(message)
    } finally {
      submitting.current = false
      setBusy(false)
    }
  }
  if (isHobby) return <HobbyEditor onLeave={(value) => setType(value as EditorType)} />
  return (
    <form className="quest-editor" aria-label="Quest editor" onSubmit={submit}>
      <div className="editor-heading">
        <h2>Add Quest</h2>
        <div className="quest-type-select">
          <select
            aria-label="Quest type"
            value={type}
            onChange={(event) => {
              setType(event.target.value as EditorType)
              setError('')
            }}
          >
            {types.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          <ChevronDown size={16} strokeWidth={1.75} aria-hidden="true" />
        </div>
      </div>
      {isHobby ? (
        <p className="editor-note">
          Hobby creation is scheduled for Milestone 4. You can review the layout here.
        </p>
      ) : null}
      <label className="editor-field">
        <span className="section-label">{isHobby ? 'Hobby name' : 'Quest name'}</span>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={isHobby ? 'Name your project' : 'Name your quest'}
          required
          maxLength={200}
        />
      </label>
      <label className="editor-field">
        <span className="section-label">Description · optional</span>
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Add a description"
          rows={2}
        />
      </label>
      <div className="editor-field">
        <span className="section-label">Schedule</span>
        <div className="schedule-options">
          {schedules.map((label) => (
            <button
              key={label}
              type="button"
              aria-pressed={schedule === label}
              onClick={() => setSchedule(label)}
            >
              {label}
            </button>
          ))}
        </div>
        {schedule === 'Days' && (
          <div className="weekday-options" role="group" aria-label="Weekdays">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((label, i) => (
              <button
                type="button"
                key={label}
                aria-pressed={weekdays.includes(i + 1)}
                onClick={() =>
                  setWeekdays((v) =>
                    v.includes(i + 1) ? v.filter((x) => x !== i + 1) : [...v, i + 1].sort(),
                  )
                }
              >
                {label}
              </button>
            ))}
          </div>
        )}
        {schedule === 'Monthly' && (
          <label className="small-field">
            Day of month{' '}
            <input
              type="number"
              min={1}
              max={31}
              value={monthDay}
              onChange={(e) => setMonthDay(Number(e.target.value))}
            />
          </label>
        )}
        {schedule === 'Yearly' && (
          <div className="date-pair">
            <label className="small-field">
              Month{' '}
              <input
                type="number"
                min={1}
                max={12}
                value={yearMonth}
                onChange={(e) => setYearMonth(Number(e.target.value))}
              />
            </label>
            <label className="small-field">
              Day{' '}
              <input
                type="number"
                min={1}
                max={31}
                value={monthDay}
                onChange={(e) => setMonthDay(Number(e.target.value))}
              />
            </label>
          </div>
        )}
        {schedule === 'Once' && (
          <label className="small-field">
            Date{' '}
            <input type="date" value={onceDate} onChange={(e) => setOnceDate(e.target.value)} />
          </label>
        )}
      </div>
      {type === 'Volatile' && (
        <div className="editor-field">
          <span className="section-label">Outcomes · configure each</span>
          <Segments
            label="Outcome to edit"
            options={['Yes', 'No']}
            value={activeOutcome === 0 ? 'Yes' : 'No'}
            onChange={(v) => setActiveOutcome(v === 'Yes' ? 0 : 1)}
          />
          <label className="small-field">
            Outcome label{' '}
            <input
              value={outcomes[activeOutcome]!.label}
              onChange={(e) =>
                setOutcomes((v) =>
                  v.map((o, i) => (i === activeOutcome ? { ...o, label: e.target.value } : o)),
                )
              }
              required
            />
          </label>
        </div>
      )}
      {type === 'Routine' && (
        <div className="editor-field">
          <span className="section-label">Routine steps · parent reward only</span>
          {steps.map((step, i) => (
            <div className="routine-edit-row" key={i}>
              <input
                aria-label={`Step ${i + 1}`}
                value={step}
                onChange={(e) => setSteps((v) => v.map((s, n) => (n === i ? e.target.value : s)))}
                placeholder={`Step ${i + 1}`}
                required
              />
              <button
                type="button"
                aria-label={`Remove step ${i + 1}`}
                disabled={steps.length === 1}
                onClick={() => setSteps((v) => v.filter((_, n) => n !== i))}
              >
                ×
              </button>
            </div>
          ))}
          <button type="button" className="text-link" onClick={() => setSteps((v) => [...v, ''])}>
            + Add step
          </button>
        </div>
      )}
      <div className="editor-field">
        <span className="section-label">
          {type === 'Routine'
            ? 'Parent reward'
            : type === 'Volatile'
              ? `Effects for “${outcomes[activeOutcome]!.label}”`
              : 'Stat effects'}
        </span>
        <StatEditor effects={activeEffects} onChange={setActiveEffects} />
      </div>
      <div className="xp-preview">
        <div>
          <span className="section-label">Potential XP</span>
          <p>
            {potentialXp(activeEffects) / 150} positive points × 150
            {type === 'Routine' ? ' · after all steps' : ''}
          </p>
        </div>
        <strong>+{potentialXp(activeEffects)} XP</strong>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {!configured && (
        <p className="editor-note">
          Local preview · connect your private Supabase account to save quests. Draft edits stay on
          this page only.
        </p>
      )}
      <button className="save-button" type="submit" disabled={busy || isHobby}>
        {busy ? 'Saving…' : isHobby ? 'Hobby saving comes in Milestone 4' : 'Save Quest'}
      </button>
      <button className="text-link" type="button" onClick={() => navigate('/quests')}>
        Back to quests
      </button>
    </form>
  )
}
