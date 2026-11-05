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

interface ArchivedQuest {
  id: string
  name: string
  version: number
  schedule_spec: { kind: string }
  quest_occurrences: { status: string }[]
}
const configured = Boolean(
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
)
export function QuestArchive() {
  const [quests, setQuests] = useState<ArchivedQuest[]>([])
  const [completed, setCompleted] = useState<CompletionHistoryRow[]>([])
  const [hiddenDefinitions, setHiddenDefinitions] = useState<Set<string>>(new Set())
  const [hiddenCompletions, setHiddenCompletions] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(configured)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const load = useCallback(async () => {
    if (!configured) return
    setLoading(true)
    try {
      const db = supabaseClient()
      const { data, error: loadError } = await db
        .from('quest_definitions')
        .select('id,name,version,schedule_spec,quest_occurrences(status)')
        .eq('state', 'archived')
        .order('created_at')
      if (loadError) throw loadError
      const [history, hiddenQuestIds, hiddenCompletionIds] = await Promise.all([
        loadCompletionHistory(db, 'quest'),
        loadHiddenArchiveIds(db, 'quest_definition'),
        loadHiddenArchiveIds(db, 'quest_completion'),
      ])
      setQuests((data ?? []) as ArchivedQuest[])
      setCompleted(history)
      setHiddenDefinitions(hiddenQuestIds)
      setHiddenCompletions(hiddenCompletionIds)
      setError('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load quest archive.')
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [load])
  async function restore(quest: ArchivedQuest) {
    if (!navigator.onLine) {
      setError('Offline. Nothing was changed.')
      return
    }
    setBusy(quest.id)
    setError('')
    try {
      const { error: saveError } = await supabaseClient().rpc('change_quest_state', {
        p_quest_id: quest.id,
        p_action: 'restore',
        p_expected_version: quest.version,
      })
      if (saveError) throw saveError
      await load()
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Could not restore quest. Refresh and retry.',
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
      if (kind === 'quest_definition') setHiddenDefinitions((current) => new Set(current).add(id))
      else setHiddenCompletions((current) => new Set(current).add(id))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not remove entry. Retry safely.')
    } finally {
      setBusy(null)
    }
  }
  const visibleQuests = quests.filter((quest) => !hiddenDefinitions.has(quest.id))
  const visibleCompleted = completed.filter((entry) => !hiddenCompletions.has(entry.source_id))
  const once = visibleQuests.filter(
    (quest) =>
      quest.schedule_spec.kind === 'ONCE' &&
      quest.quest_occurrences.some((row) => row.status === 'completed'),
  )
  const restorable = visibleQuests.filter((quest) => !once.includes(quest))
  return (
    <>
      <PageHeader title="Quest Archive" back="/hub" />
      {loading && <p className="meta">Loading archive…</p>}
      {error && (
        <p className="form-error" role="alert">
          {error}{' '}
          <button className="text-link" onClick={() => void load()}>
            Refresh
          </button>
        </p>
      )}
      <Section title="Archived · can restore">
        {restorable.length ? (
          restorable.map((quest) => (
            <div className="todo-archive-row" key={quest.id}>
              <span>{quest.name}</span>
              <div className="archive-actions">
                <button
                  className="text-link"
                  disabled={busy === quest.id}
                  onClick={() => void restore(quest)}
                >
                  Restore
                </button>
                <button
                  className="text-link"
                  disabled={busy === quest.id}
                  onClick={() => void remove('quest_definition', quest.id, quest.name)}
                >
                  Remove
                </button>
              </div>
            </div>
          ))
        ) : (
          <p className="meta">Nothing archived yet.</p>
        )}
      </Section>
      <Section title="Completed one-time · view only">
        {once.length ? (
          once.map((quest) => (
            <div className="todo-archive-row" key={quest.id}>
              <span>{quest.name}</span>
              <div className="archive-actions">
                <span className="meta">Completed</span>
                <button
                  className="text-link"
                  disabled={busy === quest.id}
                  onClick={() => void remove('quest_definition', quest.id, quest.name)}
                >
                  Remove
                </button>
              </div>
            </div>
          ))
        ) : (
          <p className="meta">Nothing completed yet. Earned history will be preserved.</p>
        )}
      </Section>
      <Section title="Completed quests · all dates">
        {visibleCompleted.length ? (
          visibleCompleted.map((entry) => (
            <div className="todo-archive-row" key={entry.id}>
              <span>{snapshotName(entry.config_snapshot, 'quest_name', 'Quest')}</span>
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
                      'quest_completion',
                      entry.source_id,
                      snapshotName(entry.config_snapshot, 'quest_name', 'this quest'),
                    )
                  }
                >
                  Remove
                </button>
              </div>
            </div>
          ))
        ) : (
          <p className="meta">No completed quests yet.</p>
        )}
      </Section>
    </>
  )
}
