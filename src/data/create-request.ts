const STORAGE_KEY = 'progression.quest-create-request.v1'

interface StoredRequest {
  payload: string
  requestId: string
}

export function questCreationRequestId(payload: unknown): string {
  const serialized = JSON.stringify(payload)
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? 'null') as StoredRequest | null
    if (saved?.payload === serialized && saved.requestId) return saved.requestId
  } catch {
    // A blocked or stale session store still allows one in-flight submit.
  }
  const requestId = crypto.randomUUID()
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ payload: serialized, requestId }))
  } catch {
    // The server request remains idempotent within this submit attempt.
  }
  return requestId
}

export function clearQuestCreationRequest(requestId: string): void {
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? 'null') as StoredRequest | null
    if (saved?.requestId === requestId) sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // Storage may be unavailable; the confirmed create still succeeded.
  }
}
