import { Link, useLocation } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { EmptyState, PageHeader } from '../../components/ui'
export function SleepCheckIn() {
  return (
    <section className="sleep-card" aria-labelledby="sleep-title">
      <div className="flex justify-between gap-2">
        <h2 id="sleep-title" className="section-label">
          Sleep check-in
        </h2>
        <span className="meta">Not recorded</span>
      </div>
      <div className="sleep-options">
        {['9–11 PM', '11 PM–1 AM', 'After 1 AM'].map((label, i) => (
          <div key={label}>
            <span className="empty-checkbox" aria-hidden="true" />
            <span>{label}</span>
            <small>{['Excellent', 'Medium', 'Low'][i]}</small>
          </div>
        ))}
      </div>
      <p className="meta">Sleep recording will be available after the backend is connected.</p>
    </section>
  )
}
export function QuestEditorPlaceholder() {
  return (
    <section className="editor-placeholder" aria-label="Quest editor">
      <p className="section-label">Add Quest</p>
      <h2>A place for your next intention.</h2>
      <p>Standard, Volatile, Routine, or Hobby / Project.</p>
      <div className="editor-lines">
        <div>
          <span className="section-label">Quest name</span>
          <p>Your next quest</p>
        </div>
        <div>
          <span className="section-label">Schedule</span>
          <p>Every Day · Days · Monthly · Yearly · Once</p>
        </div>
        <div>
          <span className="section-label">Stat effects</span>
          <p>STR · INT · VIT · DIS · BNK</p>
        </div>
      </div>
      <p className="meta">
        The editor and saving arrive with quest flows in Milestone 3. No quest has been created.
      </p>
      <Link className="text-link" to="/quests">
        Back to quests
      </Link>
    </section>
  )
}
export function QuestsPage() {
  const adding = useLocation().pathname.endsWith('/new')
  return (
    <>
      <PageHeader
        title="Quests"
        subtitle="Your scheduled activities · resets at 03:00 Asia/Kolkata"
      />
      <div className={`split-layout quest-layout ${adding ? 'is-editing' : ''}`}>
        <div className="quest-list">
          <SleepCheckIn />
          <EmptyState title="A clear page.">
            No quests have been created. Your daily activities will appear here once quest recording
            is connected.
          </EmptyState>
          <Link className="text-link" to="/quests/new">
            Explore quest setup <span aria-hidden="true">›</span>
          </Link>
        </div>
        <div className={`detail-pane ${adding ? '' : 'tablet-only'}`}>
          <QuestEditorPlaceholder />
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
