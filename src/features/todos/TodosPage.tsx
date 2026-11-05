import { useSearchParams } from 'react-router-dom'
import { EmptyState, PageHeader } from '../../components/ui'
export function TodosPage() {
  const [params] = useSearchParams()
  return (
    <>
      <PageHeader title="To-Dos" subtitle="Quick notes & checklists — no stats, no dates" />
      <div className="unavailable-field">
        <span>Add a to-do</span>
        <span aria-hidden="true">+</span>
      </div>
      <p className="meta">To-Do editing arrives in Milestone 4.</p>
      <EmptyState title="A little less on your mind.">
        Your notes and simple checklists will live here.
      </EmptyState>
      <details className="archive" open={params.has('archive') || undefined}>
        <summary>
          Archive <span>(0)</span>
        </summary>
        <p className="meta">No archived To-Dos.</p>
      </details>
    </>
  )
}
