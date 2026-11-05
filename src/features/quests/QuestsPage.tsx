import { Link, useLocation } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { PageHeader } from '../../components/ui'
import { QuestEditor } from './QuestEditor'
import { QuestList } from './QuestList'
import { SleepCheckIn } from '../sleep/SleepCheckIn'
export function QuestsPage() {
  const location = useLocation()
  const adding = location.pathname.endsWith('/new')
  const savedName = (location.state as { questSaved?: unknown } | null)?.questSaved
  return (
    <>
      <PageHeader
        title="Quests"
        subtitle="Your scheduled activities · resets at 03:00 Asia/Kolkata"
      />
      {!adding && typeof savedName === 'string' && (
        <p className="save-notice" role="status">
          {savedName} saved. It is listed below and becomes actionable on its scheduled days.
        </p>
      )}
      <div className={`split-layout quest-layout ${adding ? 'is-editing' : ''}`}>
        <div className="quest-list">
          <SleepCheckIn showDate />
          <QuestList />
        </div>
        <div className={`detail-pane ${adding ? '' : 'tablet-only'}`}>
          <QuestEditor key={location.key} />
        </div>
      </div>
      {!adding && (
        <Link to="/quests/new" className="fab" aria-label="Add quest">
          <Plus size={25} />
        </Link>
      )}
    </>
  )
}
