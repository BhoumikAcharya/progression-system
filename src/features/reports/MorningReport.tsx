import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { STAT_KEYS, type LocalDate } from '../../domain/types'
import { parseLocalDate, shiftDate } from '../../domain/scheduling/calendar'
import { summarizeDay } from '../../domain/history/summary'
import { loadHistory, type HistoryBundle } from '../../data/history'
import { supabaseClient } from '../../data/supabase'

const empty: HistoryBundle = {
  timeZone: 'Asia/Kolkata',
  events: [],
  occurrences: [],
  quests: [],
  sleep: [],
  hobbyOccurrences: [],
  finishAwards: [],
}
const configured = Boolean(
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
)
export function MorningReport() {
  const { date } = useParams()
  const navigate = useNavigate()
  const [history, setHistory] = useState<HistoryBundle>(empty)
  const [claimedDay, setClaimedDay] = useState<LocalDate | null>(null)
  const [seenDay, setSeenDay] = useState<LocalDate | null>(null)
  const [loading, setLoading] = useState(configured)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  let day: LocalDate
  try {
    parseLocalDate(date ?? '')
    day = date as LocalDate
  } catch {
    day = '' as LocalDate
  }
  useEffect(() => {
    if (!configured || !day) return
    let active = true
    Promise.all([
      loadHistory(day, day),
      supabaseClient()
        .from('sleep_records')
        .select('sleep_night_date,category,version')
        .eq('sleep_night_date', shiftDate(day, -1))
        .maybeSingle(),
      supabaseClient()
        .from('profiles')
        .select('report_claimed_quest_day,last_report_seen_quest_day')
        .single(),
    ])
      .then(([data, sleepResult, profileResult]) => {
        if (!active) return
        if (sleepResult.error) throw sleepResult.error
        if (profileResult.error) throw profileResult.error
        setHistory({
          ...data,
          sleep: sleepResult.data
            ? [...data.sleep, sleepResult.data as HistoryBundle['sleep'][number]]
            : data.sleep,
        })
        setClaimedDay(profileResult.data?.report_claimed_quest_day ?? null)
        setSeenDay(profileResult.data?.last_report_seen_quest_day ?? null)
        setError('')
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Could not load report.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [day])
  if (!day)
    return (
      <main className="report-screen">
        <p>Invalid report date.</p>
        <button onClick={() => navigate('/calendar')}>Calendar</button>
      </main>
    )
  const summary = summarizeDay(history.events, day)
  const previousNight = history.sleep.find((row) => row.sleep_night_date === shiftDate(day, -1))
  const energy = previousNight
    ? previousNight.category === 'EARLY'
      ? 'Excellent'
      : previousNight.category === 'MIDDLE'
        ? 'Medium'
        : 'Low'
    : '-'
  const questEvents = history.events.filter(
    (event) => event.source_type === 'quest' && event.activity_date === day,
  )
  async function continueToStatus() {
    if (
      configured &&
      claimedDay &&
      shiftDate(claimedDay, -1) === day &&
      (!seenDay || seenDay < claimedDay)
    ) {
      if (!navigator.onLine) {
        setError('Connect to dismiss this report across devices.')
        return
      }
      setBusy(true)
      setError('')
      try {
        const { error: saveError } = await supabaseClient().rpc('dismiss_morning_report', {
          p_quest_day: claimedDay,
        })
        if (saveError) throw saveError
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Could not dismiss report. Retry safely.')
        setBusy(false)
        return
      }
    }
    navigate('/status', { replace: true })
  }
  return (
    <main className="report-screen" aria-label="System Report">
      <p className="system-overline">Progression System · Daily Report</p>
      <h1>System Report</h1>
      <p className="report-date">
        {new Intl.DateTimeFormat('en-US', { dateStyle: 'full', timeZone: 'UTC' }).format(
          parseLocalDate(day),
        )}
      </p>
      {loading && <p className="meta">Loading report…</p>}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {!configured && (
        <p className="editor-note">Local preview · no activity has been saved to this account.</p>
      )}
      <div className="report-xp">
        <span>XP earned</span>
        <strong>+{summary.xp}</strong>
      </div>
      <div className="report-metrics">
        <div>
          <strong>+{summary.gained}</strong>
          <span>Points gained</span>
        </div>
        <div>
          <strong>{summary.lost}</strong>
          <span>Points lost</span>
        </div>
        <div>
          <strong>
            {summary.net > 0 ? '+' : ''}
            {summary.net}
          </strong>
          <span>Net points</span>
        </div>
        <div>
          <strong>{summary.quests}</strong>
          <span>Quests recorded</span>
        </div>
        <div>
          <strong>{energy}</strong>
          <span>Energy</span>
        </div>
      </div>
      <section className="report-stats">
        <h2 className="section-label">Attributes</h2>
        {STAT_KEYS.map((key) => (
          <div key={key}>
            <span>{key}</span>
            <strong>
              {summary.recorded ? `${summary.stats[key] > 0 ? '+' : ''}${summary.stats[key]}` : '-'}
            </strong>
          </div>
        ))}
      </section>
      {questEvents.length > 0 && (
        <section className="report-quests">
          <h2 className="section-label">Recorded quests</h2>
          {questEvents.map((event) => (
            <div key={event.id}>
              <span>
                {String(event.config_snapshot.quest_name ?? 'Quest')}
                {event.config_snapshot.outcome_label
                  ? ` · ${String(event.config_snapshot.outcome_label)}`
                  : ''}
              </span>
              <span>
                {Object.values(event.streak_effects).some((value) => Number(value) !== 0)
                  ? 'Streak milestone'
                  : 'Recorded'}
              </span>
            </div>
          ))}
        </section>
      )}
      {!summary.recorded && <p className="meta">No activity was recorded for this date.</p>}
      <button
        className="save-button"
        disabled={busy || loading}
        onClick={() => void continueToStatus()}
      >
        {busy ? 'Saving…' : 'Continue to Status'}
      </button>
    </main>
  )
}
