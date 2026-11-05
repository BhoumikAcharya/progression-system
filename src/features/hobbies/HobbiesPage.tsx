import { Link } from 'react-router-dom'
import { EmptyState, PageHeader } from '../../components/ui'
export function HobbiesPage() {
  return (
    <>
      <PageHeader title="Hobbies" subtitle="Projects & long-running goals" />
      <EmptyState title="Room for something meaningful.">
        No hobbies yet. Create a Hobby / Project from Quests when quest creation becomes available.
      </EmptyState>
      <Link className="text-link" to="/quests/new">
        Explore quest setup <span aria-hidden="true">›</span>
      </Link>
    </>
  )
}
