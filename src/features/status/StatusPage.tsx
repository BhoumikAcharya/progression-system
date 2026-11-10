import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { usePreferences } from '../../app/PreferencesContext'
import { Divider } from '../../components/ui'
import { Stats } from '../../components/Stats'
import { createInitialProfile } from '../profile/profile'
import { levelState } from '../../domain/progression/accounting'
import { dueDates, questDay, shiftDate } from '../../domain/scheduling/calendar'
import { sleepEffect } from '../../domain/progression/sleep'
import type { LocalDate, PlayerProfile, Schedule, SleepRecord } from '../../domain/types'
import { SupabaseProfileRepository, supabaseClient } from '../../data/supabase'
import { describeError } from '../../data/errors'
interface Today {
  xp: number
  quests: number
  gained: number
  lost: number
}
const emptyToday: Today = { xp: 0, quests: 0, gained: 0, lost: 0 }
interface StreakRow {
  quest_id: string
  current_length: number
  generation: number
  last_scheduled_date: LocalDate | null
  quest_definitions: {
    name: string
    state: string
    quest_schedule_periods: {
      generation: number
      schedule_spec: Schedule
      active_from: LocalDate
      active_through: LocalDate | null
    }[]
  } | null
}
/** A stored run only counts while no scheduled day since its last completion was missed. */
function liveLength(row: StreakRow, day: LocalDate): number {
  if (!row.last_scheduled_date || !row.quest_definitions) return 0
  const period = row.quest_definitions.quest_schedule_periods.find(
    (p) => p.generation === row.generation,
  )
  if (!period || (period.active_through && period.active_through < day)) return 0
  if (row.last_scheduled_date >= day) return row.current_length
  const missed = dueDates(
    period.schedule_spec,
    shiftDate(row.last_scheduled_date, 1),
    shiftDate(day, -1),
  )
  return missed.length ? 0 : row.current_length
}
export function StatusPage() {
  const { name } = usePreferences()
  const [profile, setProfile] = useState<PlayerProfile>(() => createInitialProfile(name))
  const [today, setToday] = useState<Today>(emptyToday)
  const [streaks, setStreaks] = useState<{ name: string; length: number }[]>([])
  const [error, setError] = useState('')
  const configured = Boolean(
    import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  )
  useEffect(() => {
    if (!configured) return
    let active = true
    async function load() {
      try {
        const db = supabaseClient()
        const account = await new SupabaseProfileRepository(db).load()
        // Energy follows the quest day: between midnight and 03:00 it still reflects the night
        // before the day that is being played, not a night that has not been slept yet.
        const day = questDay(new Date(), account.timeZone)
        const previous = shiftDate(day, -1)
        const [sleepResult, eventResult, streakResult] = await Promise.all([
          db
            .from('sleep_records')
            .select('category')
            .eq('sleep_night_date', previous)
            .maybeSingle(),
          db
            .from('reward_source_events')
            .select(
              'source_type,stat_ledger_entries(effective_delta),xp_ledger_entries(credit_delta,reason)',
            )
            .eq('activity_date', day)
            .eq('valid', true),
          db
            .from('streak_states')
            .select(
              'quest_id,current_length,generation,last_scheduled_date,quest_definitions(name,state,quest_schedule_periods(generation,schedule_spec,active_from,active_through))',
            )
            .gt('current_length', 0),
        ])
        if (sleepResult.error) throw sleepResult.error
        if (eventResult.error) throw eventResult.error
        if (streakResult.error) throw streakResult.error
        const sleep = sleepResult.data
        account.energy = sleep
          ? sleepEffect(sleep.category as SleepRecord['category']).nextDayEnergy
          : null
        const events = eventResult.data
        const activeStreaks = ((streakResult.data ?? []) as unknown as StreakRow[])
          .filter((row) => row.quest_definitions?.state === 'active')
          .map((row) => ({ name: row.quest_definitions!.name, length: liveLength(row, day) }))
          .filter((row) => row.length > 0)
          .sort((a, b) => b.length - a.length || a.name.localeCompare(b.name))
        const stats = (events ?? []).flatMap((event) => event.stat_ledger_entries ?? [])
        const total: Today = {
          xp: (events ?? [])
            .flatMap((event) => event.xp_ledger_entries ?? [])
            .filter((entry) => entry.reason === 'current_award')
            .reduce((sum, entry) => sum + Number(entry.credit_delta), 0),
          quests: (events ?? []).filter((event) => event.source_type === 'quest').length,
          gained: stats.reduce((sum, entry) => sum + Math.max(0, entry.effective_delta), 0),
          lost: stats.reduce((sum, entry) => sum + Math.min(0, entry.effective_delta), 0),
        }
        if (active) {
          setProfile(account)
          setToday(total)
          setStreaks(activeStreaks)
          setError('')
        }
      } catch (cause) {
        if (active) setError(describeError(cause, 'Could not load profile.'))
      }
    }
    void load()
    const focus = () => {
      void load()
    }
    window.addEventListener('focus', focus)
    return () => {
      active = false
      window.removeEventListener('focus', focus)
    }
  }, [configured, name])
  const level = levelState(profile.correctedLifetimeXp, profile.highestLevelAchieved)
  const nextLevel = level.highestLevelAchieved + 1
  return (
    <div className="status-page">
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <header className="status-header">
        <div>
          <p className="system-overline">Progression System</p>
          <h1>
            <Link to="/hub/settings" aria-label="Edit player name">
              {configured ? profile.displayName : name}
            </Link>
          </h1>
          <div className="level">
            <span>{level.highestLevelAchieved}</span>
            <small>Level</small>
          </div>
        </div>
        <p className="energy">
          Energy <span>·</span> <strong>{profile.energy ?? '-'}</strong>
        </p>
      </header>
      <div className="status-columns">
        <section aria-label="Player progression">
          <Divider />
          <div className="xp-label">
            <span>
              {level.progressXp} / {level.transitionCost} XP
            </span>
            <span>
              {level.remainingXp} to Level {nextLevel}
            </span>
          </div>
          <div
            className="xp-track"
            role="progressbar"
            aria-label={`Progress to Level ${nextLevel}`}
            aria-valuenow={level.progressXp}
            aria-valuemin={0}
            aria-valuemax={level.transitionCost}
          >
            <span style={{ width: `${level.progressFraction * 100}%` }} />
          </div>
          <Divider />
          <h2 className="section-label centered">Attributes</h2>
          <Stats values={profile.stats} />
        </section>
        <section className="today">
          <Divider />
          <h2 className="section-label centered">Today at a glance</h2>
          <dl className="today-grid">
            <div>
              <dd>{today.xp}</dd>
              <dt>XP today</dt>
            </div>
            <div>
              <dd>{today.quests}</dd>
              <dt>Quests cleared</dt>
            </div>
            <div>
              <dd>
                {today.gained > 0 ? '+' : ''}
                {today.gained}
              </dd>
              <dt>Points gained</dt>
            </div>
            <div>
              <dd>{today.lost}</dd>
              <dt>Points lost</dt>
            </div>
          </dl>
          {streaks.length ? (
            <ul className="streak-list" aria-label="Active quest streaks">
              {streaks.map((streak) => (
                <li key={streak.name}>
                  <span>{streak.name}</span>
                  <span>
                    Streak {streak.length}
                    {streak.length % 3 === 0
                      ? ' · bonus earned'
                      : ` · bonus at ${streak.length + 3 - (streak.length % 3)}`}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="streak-note">
              {configured
                ? 'No active quest streaks. Three completions in a row earn a bonus.'
                : 'No active quest streaks yet.'}
            </p>
          )}
        </section>
      </div>
      {!configured && (
        <div className="status-welcome">
          <h2>Your story starts here.</h2>
          <p>Five attributes. One day at a time.</p>
          <Link className="text-link" to="/quests">
            Explore your quests <span aria-hidden="true">›</span>
          </Link>
        </div>
      )}
    </div>
  )
}
