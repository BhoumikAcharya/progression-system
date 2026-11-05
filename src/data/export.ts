import { supabaseClient } from './supabase'

export interface PrivateExport {
  schema_version: number
  exported_at: string
  account_user_id: string
  tables: Record<string, Record<string, unknown>[]>
}

export async function fetchPrivateExport(): Promise<PrivateExport> {
  if (!navigator.onLine) throw new Error('Offline. Connect to export your account history.')
  const db = supabaseClient()
  const { data: auth, error: authError } = await db.auth.getUser()
  if (authError || !auth.user) throw new Error('Sign in before exporting account history.')
  const { data, error } = await db.rpc('export_private_data')
  if (error) throw error
  if (
    !data ||
    data.schema_version !== 1 ||
    data.account_user_id !== auth.user.id ||
    typeof data.exported_at !== 'string' ||
    !data.tables ||
    typeof data.tables !== 'object'
  )
    throw new Error('Export response was incomplete. No file was downloaded.')
  return data as PrivateExport
}

export function downloadPrivateExport(data: PrivateExport): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `progression-system-backup-${data.exported_at.slice(0, 10)}.json`
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
