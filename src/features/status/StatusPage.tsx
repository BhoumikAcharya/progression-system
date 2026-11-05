import { Link } from 'react-router-dom'
import { usePreferences } from '../../app/PreferencesContext'
import { Divider } from '../../components/ui'
import { Stats } from '../../components/Stats'
import { createInitialProfile } from '../profile/profile'
import { transitionCost } from '../../domain/progression/levels'
export function StatusPage() {
  const { name } = usePreferences()
  const profile = createInitialProfile(name)
  const cost = transitionCost(profile.highestLevelAchieved)
  return (
    <div className="status-page">
      <header className="status-header">
        <div>
          <p className="system-overline">Progression System</p>
          <h1>
            <Link to="/hub/settings" aria-label="Edit player name">
              {name}
            </Link>
          </h1>
          <div className="level">
            <span>{profile.highestLevelAchieved}</span>
            <small>Level</small>
          </div>
        </div>
        <p className="energy">
          Energy <span>·</span> <strong>-</strong>
        </p>
      </header>
      <div className="status-columns">
        <section aria-label="Player progression">
          <Divider />
          <div className="xp-label">
            <span>
              {profile.correctedLifetimeXp} / {cost} XP
            </span>
            <span>{cost} to Level 2</span>
          </div>
          <div
            className="xp-track"
            role="progressbar"
            aria-label="Progress to Level 2"
            aria-valuenow={0}
            aria-valuemin={0}
            aria-valuemax={cost}
          />
          <Divider />
          <h2 className="section-label centered">Attributes</h2>
          <Stats values={profile.stats} />
        </section>
        <section className="today">
          <Divider />
          <h2 className="section-label centered">Today at a glance</h2>
          <dl className="today-grid">
            <div>
              <dd>0</dd>
              <dt>XP today</dt>
            </div>
            <div>
              <dd>0 / 0</dd>
              <dt>Quests cleared</dt>
            </div>
            <div>
              <dd>0</dd>
              <dt>Points gained</dt>
            </div>
            <div>
              <dd>0</dd>
              <dt>Points lost</dt>
            </div>
          </dl>
          <p className="streak-note">No active quest streaks yet.</p>
        </section>
      </div>
      <div className="status-welcome">
        <h2>Your story starts here.</h2>
        <p>Five attributes. One day at a time.</p>
        <Link className="text-link" to="/quests">
          Explore your quests <span aria-hidden="true">›</span>
        </Link>
      </div>
    </div>
  )
}
