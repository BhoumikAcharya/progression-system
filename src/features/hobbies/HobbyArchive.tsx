import { useCallback, useEffect, useState } from 'react'
import { PageHeader, Section } from '../../components/ui'
import { supabaseClient } from '../../data/supabase'
import {
  loadHiddenArchiveIds,
  loadCompletionHistory,
  snapshotName,
  type ArchiveEntryKind,
  type CompletionHistoryRow,
} from '../../data/archive-history'

interface ArchivedHobby {
  id: string
  name: string
  state: 'archived' | 'finished'
  version: number
  finished_at: string | null
}
const configured = Boolean(
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
)
export function HobbyArchive() {
  const [hobbies, setHobbies] = useState<ArchivedHobby[]>([])
  const [completed, setCompleted] = useState<CompletionHistoryRow[]>([])
  const [hiddenDefinitions, setHiddenDefinitions] = useState<Set<string>>(new Set())
  const [hiddenCompletions, setHiddenCompletions] = useState<Set<string>>(new Set())
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(configured)
  const [busy, setBusy] = useState<string | null>(null)
  const load = useCallback(async () => {
    if (!configured) return
    setLoading(true)
    try {
      const db = supabaseClient()
      const { data, error: loadError } = await db
        .from('hobbies')
        .select('id,name,state,version,finished_at')
        .in('state', ['archived', 'finished'])
        .order('created_at')
      if (loadError) throw loadError
      const [history, hiddenHobbyIds, hiddenCompletionIds] = await Promise.all([
        loadCompletionHistory(db, 'hobby'),
        loadHiddenArchiveIds(db, 'hobby_definition'),
        loadHiddenArchiveIds(db, 'hobby_completion'),
      ])
      setHobbies((data ?? []) as ArchivedHobby[])
      setCompleted(history)
      setHiddenDefinitions(hiddenHobbyIds)
      setHiddenCompletions(hiddenCompletionIds)
      setError('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load hobby archive.')
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [load])
  async function restore(hobby: ArchivedHobby) {
    if (!navigator.onLine) {
      setError('Offline. Nothing was changed.')
      return
    }
    setBusy(hobby.id)
    setError('')
    try {
      const { error: saveError } = await supabaseClient().rpc('change_hobby_state', {
        p_hobby_id: hobby.id,
        p_action: 'restore',
        p_expected_version: hobby.version,
      })
      if (saveError) throw saveError
      await load()
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Could not restore hobby. Refresh and retry.',
      )
    } finally {
      setBusy(null)
    }
  }
  async function remove(kind: ArchiveEntryKind, id: string, label: string) {
    if (
      !window.confirm(
        `Remove ${label} from this Archive? Earned stats, XP, and Calendar history remain.`,
      )
    )
      return
    if (!navigator.onLine) {
      setError('Offline. Nothing was removed.')
      return
    }
    setBusy(id)
    setError('')
    try {
      const { error: saveError } = await supabaseClient().rpc('remove_archive_entry', {
        p_kind: kind,
        p_entry_id: id,
      })
      if (saveError) throw saveError
      if (kind === 'hobby_definition') setHiddenDefinitions((current) => new Set(current).add(id))
      else setHiddenCompletions((current) => new Set(current).add(id))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not remove entry. Retry safely.')
    } finally {
      setBusy(null)
    }
  }
  const visibleHobbies = hobbies.filter((hobby) => !hiddenDefinitions.has(hobby.id))
  const visibleCompleted = completed.filter((entry) => !hiddenCompletions.has(entry.source_id))
  const paused = visibleHobbies.filter((hobby) => hobby.state === 'archived')
  const finished = visibleHobbies.filter((hobby) => hobby.state === 'finished')
  return (
    <>
      <PageHeader title="Hobby Archive" back="/hub" />
      {loading && <p className="meta">Loading archive…</p>}
      {error && (
        <p className="form-error" role="alert">
          {error}{' '}
          <button className="text-link" onClick={() => void load()}>
            Refresh
          </button>
        </p>
      )}
      <Section title="Paused · can restore">
        {paused.length ? (
          paused.map((hobby) => (
            <div className="todo-archive-row" key={hobby.id}>
              <span>{hobby.name}</span>
              <div className="archive-actions">
                <button
                  className="text-link"
                  disabled={busy === hobby.id}
                  onClick={() => void restore(hobby)}
                >
                  Restore
                </button>
                <button
                  className="text-link"
                  disabled={busy === hobby.id}
                  onClick={() => void remove('hobby_definition', hobby.id, hobby.name)}
                >
                  Remove
                </button>
              </div>
            </div>
          ))
        ) : (
          <p className="meta">Nothing paused yet.</p>
        )}
      </Section>
      <Section title="Finished · permanent">
        {finished.length ? (
          finished.map((hobby) => (
            <div className="todo-archive-row" key={hobby.id}>
              <span>{hobby.name}</span>
              <div className="archive-actions">
                <span className="meta">Finished</span>
                <button
                  className="text-link"
                  disabled={busy === hobby.id}
                  onClick={() => void remove('hobby_definition', hobby.id, hobby.name)}
                >
                  Remove
                </button>
              </div>
            </div>
          ))
        ) : (
          <p className="meta">Nothing finished yet. Earned history will be preserved.</p>
        )}
      </Section>
      <Section title="Completed hobby tasks · all dates">
        {visibleCompleted.length ? (
          visibleCompleted.map((entry) => (
            <div className="todo-archive-row" key={entry.id}>
              <span>
                {snapshotName(entry.config_snapshot, 'hobby_name', 'Hobby')} ·{' '}
                {snapshotName(entry.config_snapshot, 'step_name', 'Task')}
              </span>
              <div className="archive-actions">
                <span className="meta">
                  <time dateTime={entry.activity_date}>{entry.activity_date}</time>
                  {entry.scheduled_date &&
                    entry.scheduled_date !== entry.activity_date &&
                    ` · due ${entry.scheduled_date}`}
                </span>
                <button
                  className="text-link"
                  disabled={busy === entry.source_id}
                  onClick={() =>
                    void remove(
                      'hobby_completion',
                      entry.source_id,
                      snapshotName(entry.config_snapshot, 'step_name', 'this task'),
                    )
                  }
                >
                  Remove
                </button>
              </div>
            </div>
          ))
        ) : (
          <p className="meta">No completed hobby tasks yet.</p>
        )}
      </Section>
    </>
  )
}
