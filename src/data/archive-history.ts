import type { SupabaseClient } from '@supabase/supabase-js'

export interface CompletionHistoryRow {
  id: string
  source_id: string
  scheduled_date: string | null
  activity_date: string
  config_snapshot: Record<string, unknown>
}

export type ArchiveEntryKind =
  'quest_definition' | 'hobby_definition' | 'quest_completion' | 'hobby_completion'

export async function loadHiddenArchiveIds(
  db: SupabaseClient,
  kind: ArchiveEntryKind,
): Promise<Set<string>> {
  const ids = new Set<string>()
  const pageSize = 500
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await db
      .from('archive_hidden_entries')
      .select('entry_id')
      .eq('entry_kind', kind)
      .order('entry_id')
      .range(offset, offset + pageSize - 1)
    if (error) throw error
    for (const row of data ?? []) ids.add(row.entry_id)
    if ((data ?? []).length < pageSize) return ids
  }
}

/** Read every valid award, including activity from definitions later archived or deleted. */
export async function loadCompletionHistory(
  db: SupabaseClient,
  sourceType: 'quest' | 'hobby',
): Promise<CompletionHistoryRow[]> {
  const pageSize = 500
  const rows: CompletionHistoryRow[] = []
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await db
      .from('reward_source_events')
      .select('id,source_id,scheduled_date,activity_date,config_snapshot')
      .eq('source_type', sourceType)
      .eq('valid', true)
      .order('activity_date', { ascending: false })
      .order('id', { ascending: false })
      .range(offset, offset + pageSize - 1)
    if (error) throw error
    const page = (data ?? []) as CompletionHistoryRow[]
    rows.push(...page)
    if (page.length < pageSize) return rows
  }
}

export function snapshotName(snapshot: Record<string, unknown>, key: string, fallback: string) {
  const value = snapshot[key]
  return typeof value === 'string' && value.trim() ? value : fallback
}
