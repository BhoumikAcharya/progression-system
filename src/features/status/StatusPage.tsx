import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { usePreferences } from '../../app/PreferencesContext'
import { Divider } from '../../components/ui'
import { Stats } from '../../components/Stats'
import { createInitialProfile } from '../profile/profile'
import { levelState } from '../../domain/progression/accounting'
import { accountDate, questDay, shiftDate } from '../../domain/scheduling/calendar'
import { sleepEffect } from '../../domain/progression/sleep'
import type { PlayerProfile, SleepRecord } from '../../domain/types'
import { SupabaseProfileRepository, supabaseClient } from '../../data/supabase'
interface Today {
  xp: number
  quests: number
  gained: number
  lost: number
}
const emptyToday: Today = { xp: 0, quests: 0, gained: 0, lost: 0 }
export function StatusPage() {
  const { name } = usePreferences()
  const [profile, setProfile] = useState<PlayerProfile>(() => createInitialProfile(name))
  const [today, setToday] = useState<Today>(emptyToday)
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
        const calendarDate = accountDate(new Date(), account.timeZone)
        const previous = shiftDate(calendarDate, -1)
        const { data: sleep, error: sleepError } = await db
          .from('sleep_records')
          .select('category')
          .eq('sleep_night_date', previous)
          .maybeSingle()
        if (sleepError) throw sleepError
        account.energy = sleep
          ? sleepEffect(sleep.category as SleepRecord['category']).nextDayEnergy
          : null
        const day = questDay(new Date(), account.timeZone)
        const { data: events, error: eventError } = await db
          .from('reward_source_events')
          .select(
            'source_type,stat_ledger_entries(effective_delta),xp_ledger_entries(credit_delta,reason)',
          )
          .eq('activity_date', day)
          .eq('valid', true)
        if (eventError) throw eventError
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
          setError('')
        }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : 'Could not load profile.')
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
          <p className="streak-note">
            {configured
              ? 'Quest streaks appear on recorded activities.'
              : 'No active quest streaks yet.'}
          </p>
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
