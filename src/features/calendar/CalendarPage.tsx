import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { PageHeader, Segments } from '../../components/ui'
import { accountCalendarDate, addDays, dateKey, formatDate, monthCells } from './dates'
export function CalendarPage() {
  const [today] = useState(() => accountCalendarDate())
  const [selected, setSelected] = useState(today)
  const [mode, setMode] = useState<'Monthly' | 'Weekly' | 'Daily'>('Monthly')
  const [kind, setKind] = useState<'Stats' | 'Sleep'>('Stats')
  const cells =
    mode === 'Monthly'
      ? monthCells(selected)
      : mode === 'Weekly'
        ? Array.from({ length: 7 }, (_, i) => addDays(selected, i - selected.getUTCDay()))
        : [selected]
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
            {cells.map((date, i) =>
              date ? (
                <button
                  key={dateKey(date)}
                  className={`calendar-cell ${dateKey(date) === dateKey(selected) ? 'selected' : ''} ${dateKey(date) === dateKey(today) ? 'is-today' : ''}`}
                  aria-label={formatDate(date, { dateStyle: 'full' })}
                  aria-pressed={dateKey(date) === dateKey(selected)}
                  onClick={() => setSelected(date)}
                >
                  <span>{date.getUTCDate()}</span>
                  <span className="no-record">-</span>
                </button>
              ) : (
                <span key={`blank-${i}`} />
              ),
            )}
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
          <h2>
            {formatDate(selected, {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </h2>
          <p className="no-record-hero">-</p>
          <p>No {kind === 'Stats' ? 'activity' : 'sleep'} recorded.</p>
          <p className="meta">
            {kind === 'Stats'
              ? 'An unreported day is different from a recorded zero. Historical totals will appear here after recording is connected.'
              : 'Sleep is recorded by sleep-night date. No bedtime or Energy is inferred from a missing entry.'}
          </p>
        </section>
      </div>
    </>
  )
}
