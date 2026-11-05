import type { LocalDate, StatEffects } from '../types'
export interface RewardEvent {
  id: string
  ownerUserId: string
  sourceId: string
  sourceType: 'quest' | 'hobby' | 'finish' | 'sleep'
  revision: number
  rawEffects: StatEffects
  effectiveEffects: StatEffects
  xpCredit: number
  activityDate: LocalDate
  recordedAt: string
  correctsEventId: string | null
}
