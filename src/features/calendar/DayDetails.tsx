import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { STAT_KEYS, type LocalDate } from '../../domain/types'
import { accountDate, questDay } from '../../domain/scheduling/calendar'
import { summarizeDay, type HistoryEvent } from '../../domain/history/summary'
import {
  questFor,
  type HistoryBundle,
  type HistoryFinishAward,
  type HistoryHobbyOccurrence,
  type HistoryOccurrence,
  type HistoryQuest,
} from '../../data/history'
import { supabaseClient } from '../../data/supabase'
import { StatEditor } from '../../components/StatEditor'
import { zeroStats } from '../../domain/progression/accounting'

function eventTitle(event: HistoryEvent) {
  const snapshot = event.config_snapshot
  const title = snapshot.quest_name ?? snapshot.step_name ?? snapshot.hobby_name
  if (event.source_type === 'sleep') return 'Sleep · ' + String(snapshot.category ?? 'recorded')
  return `${String(title ?? event.source_type)}${snapshot.outcome_label ? ` · ${String(snapshot.outcome_label)}` : ''}`
}
function effectText(event: HistoryEvent) {
  return (
    event.stat_ledger_entries
      .filter((entry) => entry.effective_delta !== 0)
      .map(
        (entry) =>
          `${entry.stat_key} ${entry.effective_delta > 0 ? '+' : ''}${entry.effective_delta}`,
      )
      .join(' · ') || 'Recorded zero stat change'
  )
}
function HistoricalQuestEditor({
  occurrence,
  quest,
  timeZone,
  onChanged,
}: {
  occurrence: HistoryOccurrence
  quest: HistoryQuest
  timeZone: string
  onChanged: () => void
}) {
  const [outcomeId, setOutcomeId] = useState(occurrence.selected_outcome_id ?? '')
  const [activityDate, setActivityDate] = useState<LocalDate>(
    occurrence.actual_activity_date ?? occurrence.scheduled_date,
  )
  const [steps, setSteps] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const historical = occurrence.scheduled_date < questDay(new Date(), timeZone)
  async function save(event: FormEvent) {
    event.preventDefault()
    if (!navigator.onLine) {
      setError('Offline. Nothing was changed.')
      return
    }
    if (quest.type === 'volatile' && !outcomeId) {
      setError('Choose an outcome.')
      return
    }
    if (
      quest.type === 'routine' &&
      occurrence.status !== 'completed' &&
      steps.length !== quest.routine_steps.length
    ) {
      setError('Confirm every routine step before awarding the parent.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const db = supabaseClient()
      const { error: saveError } =
        occurrence.status === 'completed'
          ? await db.rpc('correct_quest_occurrence', {
              p_occurrence_id: occurrence.id,
              p_expected_version: occurrence.version,
              p_new_outcome_id: outcomeId || null,
              p_new_activity_date: activityDate,
            })
          : quest.type === 'routine'
            ? await db.rpc('record_historical_routine', {
                p_quest_id: quest.id,
                p_scheduled_date: occurrence.scheduled_date,
                p_activity_date: activityDate,
                p_step_ids: steps,
              })
            : await db.rpc('record_quest', {
                p_quest_id: quest.id,
                p_scheduled_date: occurrence.scheduled_date,
                p_outcome_id: outcomeId || null,
                p_activity_date: activityDate,
              })
      if (saveError) throw saveError
      onChanged()
    } catch (cause) {
      const code = typeof cause === 'object' && cause && 'code' in cause ? String(cause.code) : ''
      setError(
        code === '40001'
          ? 'Conflict: this entry changed on another device. Refresh and review it.'
          : cause instanceof Error
            ? cause.message
            : 'Could not save correction. Retry safely.',
      )
    } finally {
      setBusy(false)
    }
  }
  async function remove() {
    if (
      !window.confirm(
        `Remove the recorded completion for ${quest.name}? Its award and dependent bonuses will be corrected.`,
      )
    )
      return
    if (!navigator.onLine) {
      setError('Offline. Nothing was changed.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const { error: saveError } = await supabaseClient().rpc('remove_quest_completion', {
        p_occurrence_id: occurrence.id,
        p_expected_version: occurrence.version,
      })
      if (saveError) throw saveError
      onChanged()
    } catch (cause) {
      const code = typeof cause === 'object' && cause && 'code' in cause ? String(cause.code) : ''
      setError(
        code === '40001'
          ? 'Conflict: this entry changed on another device. Refresh and review it.'
          : cause instanceof Error
            ? cause.message
            : 'Could not remove completion.',
      )
    } finally {
      setBusy(false)
    }
  }
  return (
    <form className="history-editor" onSubmit={(event) => void save(event)}>
      <p>
        <strong>{quest.name}</strong> ·{' '}
        {occurrence.status === 'completed'
          ? 'Recorded'
          : occurrence.status === 'partial'
            ? 'Partial'
            : 'Unreported'}{' '}
        · scheduled {occurrence.scheduled_date}
      </p>
      {quest.type === 'volatile' && (
        <label>
          Outcome
          <select
            aria-label={`Outcome for ${quest.name}`}
            value={outcomeId}
            onChange={(event) => setOutcomeId(event.target.value)}
            required
          >
            <option value="">Select outcome</option>
            {quest.quest_outcomes.map((outcome) => (
              <option key={outcome.id} value={outcome.id}>
                {outcome.label}
              </option>
            ))}
          </select>
        </label>
      )}
      {quest.type === 'routine' && occurrence.status !== 'completed' && (
        <div className="history-steps">
          <p>Confirm completed steps</p>
          {[...quest.routine_steps]
            .sort((a, b) => a.ordinal - b.ordinal)
            .map((step) => (
              <label key={step.id}>
                <input
                  type="checkbox"
                  checked={steps.includes(step.id)}
                  onChange={(event) =>
                    setSteps((current) =>
                      event.target.checked
                        ? [...current, step.id]
                        : current.filter((id) => id !== step.id),
                    )
                  }
                />
                {step.name}
              </label>
            ))}
        </div>
      )}
      <label>
        Actual activity date
        <input
          type="date"
          value={activityDate}
          max={accountDate(new Date(), timeZone)}
          onChange={(event) => {
            if (event.target.value) setActivityDate(event.target.value as LocalDate)
          }}
          required
        />
      </label>
      {error && (
        <p className="form-error" role="alert">
          {error}{' '}
          <button type="button" className="text-link" onClick={onChanged}>
            Refresh
          </button>
        </p>
      )}
      {!historical && quest.type === 'routine' && occurrence.status !== 'completed' ? (
        <p className="meta">
          Record today’s routine steps from <Link to="/quests">Quests</Link>.
        </p>
      ) : historical || occurrence.status !== 'completed' ? (
        <button className="outline-button" type="submit" disabled={busy}>
          {busy
            ? 'Saving…'
            : occurrence.status === 'completed'
              ? 'Save correction'
              : 'Record completion'}
        </button>
      ) : (
        <p className="meta">
          Today’s recorded choice can be removed, then recorded again from Quests.
        </p>
      )}
      {occurrence.status === 'completed' && (
        <button className="text-link" type="button" disabled={busy} onClick={() => void remove()}>
          Remove completion
        </button>
      )}
    </form>
  )
}
function HistoricalHobbyEditor({
  occurrence,
  event,
  timeZone,
  onChanged,
}: {
  occurrence: HistoryHobbyOccurrence
  event: HistoryEvent
  timeZone: string
  onChanged: () => void
}) {
  const [activityDate, setActivityDate] = useState<LocalDate>(
    occurrence.actual_activity_date ?? occurrence.scheduled_date,
  )
  const [effects, setEffects] = useState(() => ({ ...zeroStats(), ...event.raw_effects }))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function write(remove: boolean) {
    if (!navigator.onLine) {
      setError('Offline. Nothing was changed.')
      return
    }
    if (remove && !window.confirm(`Remove ${eventTitle(event)}? Its reward will be corrected.`))
      return
    setBusy(true)
    setError('')
    try {
      const { error: saveError } = await supabaseClient().rpc('correct_hobby_occurrence', {
        p_occurrence_id: occurrence.id,
        p_expected_version: occurrence.version,
        p_new_activity_date: remove ? null : activityDate,
        p_new_effects: remove ? null : effects,
        p_remove: remove,
      })
      if (saveError) throw saveError
      onChanged()
    } catch (cause) {
      const code = typeof cause === 'object' && cause && 'code' in cause ? String(cause.code) : ''
      setError(
        code === '40001'
          ? 'Conflict: this entry changed on another device. Refresh and review it.'
          : cause instanceof Error
            ? cause.message
            : 'Could not correct hobby entry.',
      )
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="history-editor">
      <p>
        <strong>{eventTitle(event)}</strong> · scheduled {occurrence.scheduled_date}
      </p>
      <label>
        Actual activity date
        <input
          type="date"
          value={activityDate}
          max={accountDate(new Date(), timeZone)}
          onChange={(e) => {
            if (e.target.value) setActivityDate(e.target.value as LocalDate)
          }}
        />
      </label>
      <p className="section-label">Correct stat effects</p>
      <StatEditor effects={effects} onChange={setEffects} />
      {error && (
        <p className="form-error" role="alert">
          {error}{' '}
          <button className="text-link" onClick={onChanged}>
            Refresh
          </button>
        </p>
      )}
      <button className="outline-button" disabled={busy} onClick={() => void write(false)}>
        {busy ? 'Saving…' : 'Save correction'}
      </button>
      <button className="text-link" disabled={busy} onClick={() => void write(true)}>
        Remove completion
      </button>
    </div>
  )
}
function HistoricalFinishEditor({
  award,
  event,
  timeZone,
  onChanged,
}: {
  award: HistoryFinishAward
  event: HistoryEvent
  timeZone: string
  onChanged: () => void
}) {
  const [activityDate, setActivityDate] = useState<LocalDate>(award.actual_activity_date)
  const [effects, setEffects] = useState(() => ({ ...zeroStats(), ...event.raw_effects }))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function save() {
    if (!navigator.onLine) {
      setError('Offline. Nothing was changed.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const { error: saveError } = await supabaseClient().rpc('correct_hobby_finish', {
        p_award_id: award.id,
        p_expected_version: award.version,
        p_new_activity_date: activityDate,
        p_new_effects: effects,
      })
      if (saveError) throw saveError
      onChanged()
    } catch (cause) {
      const code = typeof cause === 'object' && cause && 'code' in cause ? String(cause.code) : ''
      setError(
        code === '40001'
          ? 'Conflict: this award changed on another device. Refresh and review it.'
          : cause instanceof Error
            ? cause.message
            : 'Could not correct Finish award.',
      )
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="history-editor">
      <p>
        <strong>{eventTitle(event)}</strong> · one-time Finish reward
      </p>
      <label>
        Actual activity date
        <input
          type="date"
          value={activityDate}
          max={accountDate(new Date(), timeZone)}
          onChange={(e) => {
            if (e.target.value) setActivityDate(e.target.value as LocalDate)
          }}
        />
      </label>
      <p className="section-label">Correct Finish effects</p>
      <StatEditor effects={effects} onChange={setEffects} />
      {error && (
        <p className="form-error" role="alert">
          {error}{' '}
          <button className="text-link" onClick={onChanged}>
            Refresh
          </button>
        </p>
      )}
      <button className="outline-button" disabled={busy} onClick={() => void save()}>
        {busy ? 'Saving…' : 'Save correction'}
      </button>
    </div>
  )
}
export function DayDetails({
  day,
  history,
  onChanged,
}: {
  day: LocalDate
  history: HistoryBundle
  onChanged: () => void
}) {
  const summary = summarizeDay(history.events, day)
  const events = history.events.filter((event) => event.activity_date === day)
  const unreported = history.occurrences.filter(
    (occurrence) => occurrence.scheduled_date === day && occurrence.status !== 'completed',
  )
  const editable = history.occurrences.filter(
    (occurrence) =>
      occurrence.status === 'completed' &&
      events.some((event) => event.source_type === 'quest' && event.source_id === occurrence.id),
  )
  const editableHobbies = events.filter((event) => event.source_type === 'hobby')
  const editableFinishes = events.filter((event) => event.source_type === 'finish')
  return (
    <>
      {!summary.recorded && (
        <>
          <p className="no-record-hero">-</p>
          <p>No activity recorded.</p>
        </>
      )}
      {summary.recorded && (
        <div className="day-totals">
          <strong>
            {summary.net > 0 ? '+' : ''}
            {summary.net} net points
          </strong>
          <span>
            +{summary.gained} gained · {summary.lost} lost · +{summary.xp} XP
          </span>
        </div>
      )}
      <dl className="day-stat-list">
        {STAT_KEYS.map((key) => (
          <div key={key}>
            <dt>{key}</dt>
            <dd>
              {summary.recorded ? `${summary.stats[key] > 0 ? '+' : ''}${summary.stats[key]}` : '-'}
            </dd>
          </div>
        ))}
      </dl>
      {events.length > 0 && (
        <div className="history-events">
          <h3 className="section-label">Recorded activity · {summary.quests} quests</h3>
          {events.map((event) => (
            <div className="history-event" key={event.id}>
              <strong>{eventTitle(event)}</strong>
              <span>{effectText(event)}</span>
              <small>
                +
                {event.xp_ledger_entries
                  .filter((entry) => entry.reason === 'current_award')
                  .reduce((sum, entry) => sum + Number(entry.credit_delta), 0)}{' '}
                XP
                {Object.values(event.streak_effects).some((value) => Number(value) !== 0)
                  ? ' · Streak bonus'
                  : ''}
              </small>
            </div>
          ))}
        </div>
      )}
      {unreported.length > 0 && (
        <div className="history-events">
          <h3 className="section-label">Unreported scheduled quests</h3>
          {unreported.map((occurrence) => (
            <p className="meta" key={occurrence.id}>
              {questFor(history, occurrence.quest_id)?.name ?? 'Quest'} ·{' '}
              {occurrence.status === 'partial' ? 'Partial' : 'Unreported'}
            </p>
          ))}
        </div>
      )}
      <details className="history-corrections">
        <summary>Correct entries</summary>
        {[...editable, ...unreported, ...editableHobbies, ...editableFinishes].length ? (
          <>
            {[...editable, ...unreported].map((occurrence) => {
              const quest = questFor(history, occurrence.quest_id)
              return quest ? (
                <HistoricalQuestEditor
                  key={`${occurrence.id}:${occurrence.version}`}
                  occurrence={occurrence}
                  quest={quest}
                  timeZone={history.timeZone}
                  onChanged={onChanged}
                />
              ) : null
            })}
            {editableHobbies.map((event) => {
              const occurrence = history.hobbyOccurrences.find((row) => row.id === event.source_id)
              return occurrence ? (
                <HistoricalHobbyEditor
                  key={`${occurrence.id}:${occurrence.version}`}
                  occurrence={occurrence}
                  event={event}
                  timeZone={history.timeZone}
                  onChanged={onChanged}
                />
              ) : null
            })}
            {editableFinishes.map((event) => {
              const award = history.finishAwards.find((row) => row.id === event.source_id)
              return award ? (
                <HistoricalFinishEditor
                  key={`${award.id}:${award.version}`}
                  award={award}
                  event={event}
                  timeZone={history.timeZone}
                  onChanged={onChanged}
                />
              ) : null
            })}
          </>
        ) : (
          <p className="meta">No quest entries to correct for this date.</p>
        )}
      </details>
      <Link className="text-link" to={`/report/${day}`}>
        System Report <span aria-hidden="true">›</span>
      </Link>
    </>
  )
}
