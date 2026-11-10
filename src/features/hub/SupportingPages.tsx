import { useCallback, useEffect, useState } from 'react'
import { EmptyState, PageHeader, Section } from '../../components/ui'
import { SleepCheckIn } from '../sleep/SleepCheckIn'
import { supabaseClient } from '../../data/supabase'
interface SleepHistoryRow {
  sleep_night_date: string
  category: 'EARLY' | 'MIDDLE' | 'LATE'
}
export function SleepPage() {
  const [nights, setNights] = useState<SleepHistoryRow[]>([])
  const [error, setError] = useState('')
  const configured = Boolean(
    import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  )
  const load = useCallback(async () => {
    if (!configured) return
    const { data, error: loadError } = await supabaseClient()
      .from('sleep_records')
      .select('sleep_night_date,category')
      .order('sleep_night_date', { ascending: false })
      .limit(14)
    if (loadError) setError(loadError.message)
    else {
      setNights((data ?? []) as SleepHistoryRow[])
      setError('')
    }
  }, [configured])
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [load])
  return (
    <>
      <PageHeader
        title="Sleep Log"
        back="/hub"
        subtitle="Sleep-night records · separate from the 03:00 quest reset"
      />
      <SleepCheckIn showDate onSaved={() => void load()} />
      <Section title="Recent nights">
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {nights.length ? (
          nights.map((night) => (
            <div className="todo-archive-row" key={night.sleep_night_date}>
              <span>{night.sleep_night_date}</span>
              <span className="meta">
                {night.category === 'EARLY'
                  ? 'Excellent'
                  : night.category === 'MIDDLE'
                    ? 'Medium'
                    : 'Low'}
              </span>
            </div>
          ))
        ) : (
          <EmptyState title="No nights recorded.">Saved sleep nights will appear here.</EmptyState>
        )}
      </Section>
    </>
  )
}
export function GuidePage() {
  return (
    <>
      <PageHeader title="System guide" back="/hub/settings" />
      <Section title="Attributes & XP">
        <p>
          Strength, Intelligence, Vitality, Discipline, and Bank begin at zero and never display
          below zero. Each positive awarded point earns 150 XP. Negative outcomes do not directly
          remove XP.
        </p>
      </Section>
      <Section title="Levels">
        <p>
          The first level requires 400 XP. Each following transition costs the previous requirement
          × 1.15, rounded up. Unlocked levels never decrease; correcting an incorrect award also
          corrects its XP.
        </p>
      </Section>
      <Section title="Quests & streaks">
        <p>
          The quest day resets at 03:00 in your account time zone. Every third consecutive scheduled
          completion adds one point in the configured direction for each affected stat. Volatile
          streaks require the same recorded outcome. Missing a quest never records a negative
          outcome.
        </p>
      </Section>
      <Section title="Sleep & Energy">
        <p>
          9–11 PM: VIT +1, DIS +1, Excellent Energy. 11 PM–1 AM: no stat changes, Medium Energy.
          After 1 AM: DIS −1, Low Energy. Sleep effects belong to the sleep night; Energy belongs to
          the following day. No record means Energy is “-”.
        </p>
      </Section>
      <Section title="A separate space">
        <p>
          To-Dos have no dates, stats, XP, or streaks. Routine rewards belong only to the parent.
          Hobby tasks have no dates: each earns once when ticked (repeatable tasks once per day); the finish bonus is awarded exactly once.
        </p>
      </Section>
    </>
  )
}
