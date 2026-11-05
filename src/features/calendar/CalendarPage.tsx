import { useCallback, useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { PageHeader, Segments } from '../../components/ui'
import { accountCalendarDate, addDays, dateKey, formatDate, monthCells } from './dates'
import { loadHistory, type HistoryBundle } from '../../data/history'
import { summarizeDay } from '../../domain/history/summary'
import { SleepCheckIn } from '../sleep/SleepCheckIn'
import type { LocalDate } from '../../domain/types'
import { DayDetails } from './DayDetails'
const emptyHistory: HistoryBundle = {
  timeZone: 'Asia/Kolkata',
  events: [],
  occurrences: [],
  quests: [],
  sleep: [],
  hobbyOccurrences: [],
  finishAwards: [],
}
export function CalendarPage() {
  const [today, setToday] = useState(() => accountCalendarDate())
  const [selected, setSelected] = useState(today)
  const [mode, setMode] = useState<'Monthly' | 'Weekly' | 'Daily'>('Monthly')
  const [kind, setKind] = useState<'Stats' | 'Sleep'>('Stats')
  const [history, setHistory] = useState<HistoryBundle>(emptyHistory)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const configured = Boolean(
    import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  )
  const cells =
    mode === 'Monthly'
      ? monthCells(selected)
      : mode === 'Weekly'
        ? Array.from({ length: 7 }, (_, i) => addDays(selected, i - selected.getUTCDay()))
        : [selected]
  const visibleDates = cells.filter((date): date is Date => Boolean(date))
  const from = dateKey(visibleDates[0] ?? selected) as LocalDate
  const through = dateKey(visibleDates.at(-1) ?? selected) as LocalDate
  const selectedKey = dateKey(selected) as LocalDate
  const load = useCallback(async () => {
    if (!configured) return
    setLoading(true)
    try {
      const data = await loadHistory(from, through)
      setHistory(data)
      const accountToday = accountCalendarDate(new Date(), data.timeZone)
      if (dateKey(accountToday) !== dateKey(today)) {
        setToday(accountToday)
        setSelected((current) => (dateKey(current) === dateKey(today) ? accountToday : current))
      }
      setError('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load Calendar history.')
    } finally {
      setLoading(false)
    }
  }, [configured, from, through, today])
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [load])
  function move(direction: number) {
    if (mode === 'Monthly')
      setSelected(
        new Date(Date.UTC(selected.getUTCFullYear(), selected.getUTCMonth() + direction, 1, 12)),
      )
    else setSelected(addDays(selected, direction * (mode === 'Weekly' ? 7 : 1)))
  }
  return (
    <>
      <PageHeader title="Calendar" subtitle="A record of the days that add up." />
      <div className="split-layout calendar-layout">
        <section aria-label="Calendar browser">
          <div className="calendar-toolbar">
            <div className="month-navigation">
              <button
                className="icon-button"
                aria-label={`Previous ${mode === 'Monthly' ? 'month' : mode === 'Weekly' ? 'week' : 'day'}`}
                onClick={() => move(-1)}
              >
                <ChevronLeft size={18} />
              </button>
              <h2>{formatDate(selected, { month: 'long', year: 'numeric' })}</h2>
              <button
                className="icon-button"
                aria-label={`Next ${mode === 'Monthly' ? 'month' : mode === 'Weekly' ? 'week' : 'day'}`}
                onClick={() => move(1)}
              >
                <ChevronRight size={18} />
              </button>
            </div>
            <Segments
              label="Record type"
              options={['Stats', 'Sleep']}
              value={kind}
              onChange={setKind}
            />
          </div>
          <Segments
            label="Calendar view"
            options={['Monthly', 'Weekly', 'Daily']}
            value={mode}
            onChange={setMode}
          />
          <div className={`calendar-grid ${mode === 'Daily' ? 'daily-grid' : ''}`}>
            {mode !== 'Daily' &&
              ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <span className="weekday" key={day}>
                  {day}
                </span>
              ))}
            {cells.map((date, i) => {
              if (!date) return <span key={`blank-${i}`} />
              const key = dateKey(date) as LocalDate
              const summary = summarizeDay(history.events, key)
              const sleepNight = history.sleep.find((row) => row.sleep_night_date === key)
              const cellValue =
                kind === 'Sleep'
                  ? sleepNight
                    ? sleepNight.category === 'EARLY'
                      ? 'Early'
                      : sleepNight.category === 'MIDDLE'
                        ? 'Middle'
                        : 'Late'
                    : '-'
                  : summary.recorded
                    ? summary.net > 0
                      ? `+${summary.net}`
                      : String(summary.net)
                    : '-'
              return (
                <button
                  key={key}
                  className={`calendar-cell ${key === selectedKey ? 'selected' : ''} ${key === dateKey(today) ? 'is-today' : ''}`}
                  aria-label={formatDate(date, { dateStyle: 'full' })}
                  aria-pressed={key === selectedKey}
                  onClick={() => setSelected(date)}
                >
                  <span>{date.getUTCDate()}</span>
                  <span
                    className={
                      kind === 'Stats' && summary.recorded
                        ? summary.net > 0
                          ? 'positive'
                          : summary.net < 0
                            ? 'negative'
                            : 'recorded-zero'
                        : 'no-record'
                    }
                  >
                    {cellValue}
                  </span>
                </button>
              )
            })}
          </div>
          <p className="calendar-legend">
            <span className="positive">+ Gain</span>
            <span className="negative">− Loss</span>
            <span>0 Recorded zero</span>
            <span>- No record</span>
          </p>
          <button className="text-link" onClick={() => setSelected(today)}>
            Today
          </button>
        </section>
        <section className="detail-pane day-details" aria-label="Day details">
          <p className="section-label">Day details · {kind}</p>
          <div className="day-detail-nav">
            <button
              className="icon-button"
              aria-label="Previous date"
              onClick={() => setSelected(addDays(selected, -1))}
            >
              <ChevronLeft size={18} />
            </button>
            <h2>
              {formatDate(selected, {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </h2>
            <button
              className="icon-button"
              aria-label="Next date"
              onClick={() => setSelected(addDays(selected, 1))}
            >
              <ChevronRight size={18} />
            </button>
          </div>
          {loading && <p className="meta">Loading history…</p>}
          {error && (
            <p className="form-error" role="alert">
              {error}{' '}
              <button className="text-link" onClick={() => void load()}>
                Retry
              </button>
            </p>
          )}
          {kind === 'Stats' ? (
            <DayDetails day={selectedKey} history={history} onChanged={() => void load()} />
          ) : (
            <>
              <p>
                {history.sleep.some((row) => row.sleep_night_date === selectedKey)
                  ? `${history.sleep.find((row) => row.sleep_night_date === selectedKey)?.category === 'EARLY' ? 'Excellent' : history.sleep.find((row) => row.sleep_night_date === selectedKey)?.category === 'MIDDLE' ? 'Medium' : 'Low'} Energy from this sleep night.`
                  : 'No sleep recorded.'}
              </p>
              <p className="meta">
                Sleep is recorded by sleep-night date. No bedtime or Energy is inferred from a
                missing entry.
              </p>
              <SleepCheckIn
                key={selectedKey}
                initialNight={selectedKey as LocalDate}
                onSaved={() => void load()}
              />
            </>
          )}
        </section>
      </div>
    </>
  )
}
