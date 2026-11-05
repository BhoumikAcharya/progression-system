import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { EmptyState, PageHeader } from '../../components/ui'
import { supabaseClient } from '../../data/supabase'

interface TodoRow {
  id: string
  parent_id: string | null
  title: string
  done: boolean
  archived: boolean
  position: number
}
const configured = Boolean(
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
)
export function TodosPage() {
  const [params] = useSearchParams()
  const [rows, setRows] = useState<TodoRow[]>([])
  const [title, setTitle] = useState('')
  const [childFor, setChildFor] = useState<string | null>(null)
  const [childTitle, setChildTitle] = useState('')
  const [loading, setLoading] = useState(configured)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const load = useCallback(async () => {
    if (!configured) return
    setLoading(true)
    try {
      const { data, error: loadError } = await supabaseClient()
        .from('todo_items')
        .select('id,parent_id,title,done,archived,position')
        .eq('deleted', false)
        .order('position')
      if (loadError) throw loadError
      setRows((data ?? []) as TodoRow[])
      setError('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load To-Dos.')
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    const focus = () => void load()
    window.addEventListener('focus', focus)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('focus', focus)
    }
  }, [load])
  async function write(
    action: string,
    id: string | null,
    itemTitle?: string,
    parentId?: string,
    done?: boolean,
  ) {
    if (!navigator.onLine) {
      setError('Offline. Nothing was saved.')
      return false
    }
    setPending(true)
    setError('')
    try {
      const { error: saveError } = await supabaseClient().rpc('write_todo', {
        p_action: action,
        p_id: id,
        p_title: itemTitle ?? null,
        p_parent_id: parentId ?? null,
        p_done: done ?? null,
      })
      if (saveError) throw saveError
      await load()
      return true
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save To-Do. Retry safely.')
      return false
    } finally {
      setPending(false)
    }
  }
  async function add(event: FormEvent, parentId?: string) {
    event.preventDefault()
    const value = (parentId ? childTitle : title).trim()
    if (!value) return
    if (await write('create', crypto.randomUUID(), value, parentId)) {
      if (parentId) {
        setChildTitle('')
        setChildFor(null)
      } else setTitle('')
    }
  }
  async function removeArchived(root: TodoRow) {
    if (!window.confirm(`Remove ${root.title} from the To-Do Archive?`)) return
    if (!navigator.onLine) {
      setError('Offline. Nothing was removed.')
      return
    }
    setPending(true)
    setError('')
    try {
      const { error: saveError } = await supabaseClient().rpc('remove_archived_todo', {
        p_id: root.id,
      })
      if (saveError) throw saveError
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not remove To-Do. Retry safely.')
    } finally {
      setPending(false)
    }
  }
  const roots = rows.filter((row) => !row.parent_id)
  const active = roots.filter((row) => !row.archived)
  const archived = roots.filter((row) => row.archived)
  function item(row: TodoRow, child = false) {
    return (
      <label className={`todo-row ${child ? 'todo-child' : ''}`} key={row.id}>
        <input
          type="checkbox"
          checked={row.done}
          disabled={pending || row.archived}
          onChange={(event) =>
            void write('toggle', row.id, undefined, undefined, event.target.checked)
          }
        />
        <span>{row.title}</span>
      </label>
    )
  }
  return (
    <>
      <PageHeader title="To-Dos" subtitle="Quick notes & checklists — no stats, no dates" />
      {configured ? (
        <form className="todo-add" onSubmit={(event) => void add(event)}>
          <input
            aria-label="Add a to-do"
            placeholder="Add a to-do"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={200}
            required
          />
          <button type="submit" aria-label="Save to-do" disabled={pending}>
            +
          </button>
        </form>
      ) : (
        <p className="editor-note">
          Connect a private account to save To-Dos. This preview holds no activity data.
        </p>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}{' '}
          <button className="text-link" onClick={() => void load()}>
            Retry
          </button>
        </p>
      )}
      {loading && <p className="meta">Loading To-Dos…</p>}
      {!loading && active.length === 0 && (
        <EmptyState title="A little less on your mind.">
          Your active notes and checklists will appear here.
        </EmptyState>
      )}
      {active.map((root) => (
        <section className="todo-group" key={root.id} aria-label={root.title}>
          <div className="todo-parent-line">
            {item(root)}
            <button
              className="text-link"
              disabled={pending}
              onClick={() => {
                setChildFor(childFor === root.id ? null : root.id)
                setChildTitle('')
              }}
            >
              + Subtask
            </button>
          </div>
          {rows.filter((row) => row.parent_id === root.id).map((row) => item(row, true))}
          {childFor === root.id && (
            <form className="todo-add todo-child" onSubmit={(event) => void add(event, root.id)}>
              <input
                aria-label={`Subtask for ${root.title}`}
                placeholder="Subtask"
                value={childTitle}
                onChange={(event) => setChildTitle(event.target.value)}
                maxLength={200}
                required
                autoFocus
              />
              <button type="submit" disabled={pending}>
                Add
              </button>
            </form>
          )}
        </section>
      ))}
      <details className="archive" open={params.has('archive') || undefined}>
        <summary>
          Archive <span>({archived.length})</span>
        </summary>
        {archived.length === 0 ? (
          <p className="meta">No archived To-Dos.</p>
        ) : (
          archived.map((root) => (
            <div className="todo-archive-row" key={root.id}>
              <span>
                {root.title}
                {rows
                  .filter((row) => row.parent_id === root.id)
                  .map((child) => (
                    <small className="todo-archive-child" key={child.id}>
                      {child.title}
                    </small>
                  ))}
              </span>
              <div className="archive-actions">
                <button
                  className="text-link"
                  disabled={pending}
                  onClick={() => void write('restore', root.id)}
                >
                  Restore
                </button>
                <button
                  className="text-link"
                  disabled={pending}
                  onClick={() => void removeArchived(root)}
                >
                  Remove
                </button>
              </div>
            </div>
          ))
        )}
        {archived.length > 0 && (
          <button
            className="text-link"
            disabled={pending}
            onClick={() => {
              if (window.confirm('Clear all archived To-Dos?')) void write('clear_archive', null)
            }}
          >
            Clear Archive
          </button>
        )}
      </details>
    </>
  )
}
