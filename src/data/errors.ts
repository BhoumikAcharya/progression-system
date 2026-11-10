/** Turns a server error into a sentence a player can act on. Codes come from the RPC layer. */
const messages: Record<string, string> = {
  AUTH_REQUIRED: 'Sign in again to continue.',
  PROFILE_REQUIRED: 'Your account profile is missing. Sign in again.',
  QUEST_NOT_FOUND: 'This quest no longer exists. Refresh the list.',
  QUEST_NOT_DUE: 'This quest is not scheduled for that day.',
  QUEST_NOT_ACTIVE: 'This quest is archived. Restore it from the Quest Archive first.',
  FUTURE_OCCURRENCE: 'That day has not arrived yet.',
  ACTIVITY_BEFORE_QUEST: 'The activity date is before this quest existed.',
  ACTIVITY_BEFORE_HOBBY: 'The activity date is before this hobby existed.',
  ROUTINE_REQUIRES_STEPS: 'Tick every routine step first.',
  ROUTINE_NOT_ACTIVE: 'This routine is not active.',
  ROUTINE_NOT_CURRENT: 'The quest day has rolled over. The list has been refreshed.',
  ROUTINE_NOT_DUE: 'This routine is not scheduled today.',
  ROUTINE_ALREADY_AWARDED: 'This routine is already recorded. Remove the completion to change it.',
  STEP_NOT_FOUND: 'That routine step no longer exists. Refresh the list.',
  STEP_NOT_TICKED: 'That step is not ticked.',
  OUTCOME_REQUIRED: 'Choose an outcome first.',
  OUTCOME_NOT_FOUND: 'That outcome no longer exists. Refresh the list.',
  UNEXPECTED_OUTCOME: 'This quest type has no outcomes.',
  OCCURRENCE_NOT_FOUND: 'That entry no longer exists. Refresh and review it.',
  OCCURRENCE_NOT_COMPLETED: 'That entry is not recorded, so it cannot be corrected.',
  INVALID_CORRECTION_DATE: 'Choose a day that has already happened.',
  HISTORICAL_CORRECTION_REQUIRED: 'Choose a day that has already happened.',
  AWARD_NOT_FOUND: 'No award is attached to that entry. Refresh and review it.',
  COMPLETED_ONCE_CANNOT_RESTORE: 'A completed one-time quest cannot be restored.',
  INVALID_QUEST_TRANSITION: 'That change is not possible from the quest’s current state.',
  INVALID_HOBBY_TRANSITION: 'That change is not possible from the hobby’s current state.',
  HOBBY_NOT_FOUND: 'This hobby no longer exists. Refresh the list.',
  HOBBY_NOT_ACTIVE: 'This hobby is not active.',
  HOBBY_STEP_NOT_FOUND: 'That task no longer exists. Refresh the list.',
  HOBBY_OCCURRENCE_NOT_COMPLETED: 'That task is not recorded.',
  INVALID_HOBBY: 'Give the hobby a name and between one and thirty tasks.',
  INVALID_HOBBY_STEP: 'Name every task and check its stat effects.',
  INVALID_HOBBY_CORRECTION: 'Choose a valid date and stat effects.',
  INVALID_FINISH_CORRECTION: 'Choose a valid date and stat effects.',
  FINISH_AWARD_NOT_FOUND: 'That Finish award no longer exists.',
  DUPLICATE_HOBBY_STEP: 'A task appears twice. Refresh the editor.',
  INVALID_SLEEP_RECORD: 'Choose a sleep night and a category.',
  FUTURE_SLEEP_NIGHT: 'That night has not happened yet.',
  INVALID_TODO: 'Give the To-Do a title under 200 characters.',
  INVALID_PARENT: 'Subtasks can only be added to an active top-level To-Do.',
  TODO_UNAVAILABLE: 'That To-Do cannot be changed from here. Refresh the list.',
  TODO_NOT_ARCHIVED: 'That To-Do is not archived.',
  ARCHIVED_TODO_NOT_FOUND: 'That archived To-Do no longer exists.',
  INVALID_QUEST: 'Check the quest name, schedule and stat effects.',
  TWO_OUTCOMES_REQUIRED: 'A Volatile quest needs exactly two outcomes.',
  ROUTINE_STEPS_REQUIRED: 'A Routine needs at least one step.',
  INVALID_OUTCOME: 'Name both outcomes and check their stat effects.',
  INVALID_ROUTINE_STEP: 'Name every routine step.',
  QUEST_REQUEST_CONFLICT: 'This quest was already saved with different details. Refresh the list.',
  REPORT_DAY_NOT_CLAIMED: 'This report was already dismissed on another device.',
  ARCHIVE_ENTRY_NOT_FOUND: 'That archive entry no longer exists.',
}
const conflict = 'Conflict: this entry changed on another device. Refresh and review it.'

export function describeError(cause: unknown, fallback: string): string {
  if (!cause || typeof cause !== 'object') return fallback
  const record = cause as { code?: unknown; message?: unknown }
  if (record.code === '40001') return conflict
  const message = typeof record.message === 'string' ? record.message.trim() : ''
  if (message in messages) return messages[message]!
  if (/^STALE_/.test(message)) return conflict
  if (/^[A-Z_]+$/.test(message)) return fallback
  if (/Failed to fetch|NetworkError|Load failed/i.test(message))
    return 'Could not reach the server. Check your connection and retry.'
  return message || fallback
}
