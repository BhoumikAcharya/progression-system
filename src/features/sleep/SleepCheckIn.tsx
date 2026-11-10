import { useCallback, useEffect, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { accountDate, shiftDate } from '../../domain/scheduling/calendar'
import type { LocalDate } from '../../domain/types'
import { supabaseClient } from '../../data/supabase'
import { describeError } from '../../data/errors'
import { sleepCollapsedByDefault } from '../../data/sleep-preferences'

type Category = 'EARLY' | 'MIDDLE' | 'LATE'
interface SleepRow {
  category: Category
  version: number
}
const options: { label: string; category: Category; energy: string }[] = [
  { label: '9–11 PM', category: 'EARLY', energy: 'Excellent' },
  { label: '11 PM–1 AM', category: 'MIDDLE', energy: 'Medium' },
  { label: 'After 1 AM', category: 'LATE', energy: 'Low' },
]
const configured = Boolean(
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
)
export function SleepCheckIn({
  showDate = false,
  onSaved,
  initialNight,
}: {
  showDate?: boolean
  onSaved?: () => void
  initialNight?: LocalDate
}) {
  const [zone, setZone] = useState('Asia/Kolkata')
  const [night, setNight] = useState<LocalDate>(
    () => initialNight ?? shiftDate(accountDate(new Date(), 'Asia/Kolkata'), -1),
  )
  const [record, setRecord] = useState<SleepRow | null>(null)
  const [loading, setLoading] = useState(configured)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState(() => !sleepCollapsedByDefault())
  const load = useCallback(async (date: LocalDate) => {
    if (!configured) return
    setLoading(true)
    try {
      const db = supabaseClient()
      const { data: profile, error: profileError } = await db
        .from('profiles')
        .select('time_zone')
        .single()
      if (profileError || !profile) throw profileError ?? new Error('Profile unavailable')
      setZone(profile.time_zone)
      const { data, error: loadError } = await db
        .from('sleep_records')
        .select('category,version')
        .eq('sleep_night_date', date)
        .maybeSingle()
      if (loadError) throw loadError
      setRecord(data as SleepRow | null)
      setError('')
    } catch (cause) {
      setError(describeError(cause, 'Could not load sleep record.'))
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => {
    const timer = window.setTimeout(() => void load(night), 0)
    const focus = () => void load(night)
    window.addEventListener('focus', focus)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('focus', focus)
    }
  }, [load, night])
  async function save(category: Category) {
    if (!navigator.onLine) {
      setError('Offline. Nothing was recorded.')
      return
    }
    setPending(true)
    setError('')
    try {
      const { error: saveError } = await supabaseClient().rpc('record_sleep', {
        p_night: night,
        p_category: category,
        p_expected_version: record?.version ?? null,
      })
      if (saveError) throw saveError
      await load(night)
      onSaved?.()
    } catch (cause) {
      setError(
        describeError(cause, 'Could not record sleep. Refresh and retry.'),
      )
    } finally {
      setPending(false)
    }
  }
  const today = accountDate(new Date(), zone)
  return (
    <section className="sleep-card" aria-labelledby="sleep-title">
      <div className="sleep-toggle">
        <h2 id="sleep-title" className="section-label">
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls="sleep-check-in-content"
            onClick={() => setExpanded((value) => !value)}
          >
            Sleep check-in
            <ChevronDown size={18} aria-hidden="true" />
          </button>
        </h2>
        <span className="meta">{loading ? 'Loading…' : record ? 'Recorded' : 'Not recorded'}</span>
      </div>
      {expanded && (
        <div id="sleep-check-in-content">
          {showDate && (
            <label className="small-field">
              Sleep night{' '}
              <input
                type="date"
                value={night}
                max={today}
                onChange={(event) => {
                  if (event.target.value) setNight(event.target.value as LocalDate)
                }}
              />
            </label>
          )}
          <p className="meta">Night of {night} · Energy applies the following day.</p>
          <div className="sleep-options">
            {options.map(({ label, category, energy }) => (
              <button
                key={category}
                type="button"
                aria-pressed={record?.category === category}
                disabled={!configured || pending || loading || night > today}
                onClick={() => void save(category)}
              >
                <span className="empty-checkbox" aria-hidden="true">
                  {record?.category === category ? '✓' : ''}
                </span>
                <span>{label}</span>
                <small>{energy}</small>
              </button>
            ))}
          </div>
          {error && (
            <p className="form-error" role="alert">
              {error}{' '}
              <button className="text-link" onClick={() => void load(night)}>
                Refresh
              </button>
            </p>
          )}
          {!configured && (
            <p className="meta">
              Connect a private account to record sleep. This preview has no saved nights.
            </p>
          )}
        </div>
      )}
    </section>
  )
}
