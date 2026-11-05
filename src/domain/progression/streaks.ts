import { STAT_KEYS, type LocalDate, type StatEffects } from '../types'
import { zeroStats, validateEffects } from './accounting'
export interface StreakSlot {
  key: string
  scheduledDate: LocalDate
  outcomeId: string | null
  completed: boolean
  eligible: boolean
  effects: StatEffects
  generation: number
  bonusAwarded?: boolean
}
/** Recorded slots are ordered by due occurrence, never by logging timestamp. */
export function projectStreaks(slots: readonly StreakSlot[]) {
  let run = 0,
    priorOutcome: string | null = null,
    priorGeneration: number | null = null
  return [...slots]
    .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate) || a.key.localeCompare(b.key))
    .map((slot) => {
      validateEffects(slot.effects)
      if (priorGeneration !== null && slot.generation !== priorGeneration) {
        run = 0
        priorOutcome = null
      }
      priorGeneration = slot.generation
      if (!slot.completed || !slot.eligible) {
        run = 0
        priorOutcome = null
        return { ...slot, streak: 0, bonus: zeroStats() }
      }
      const outcome = slot.outcomeId ?? 'STANDARD'
      run = priorOutcome === outcome ? run + 1 : 1
      priorOutcome = outcome
      const bonus = zeroStats()
      if (run % 3 === 0) for (const key of STAT_KEYS) bonus[key] = Math.sign(slot.effects[key])
      return { ...slot, streak: run, bonus }
    })
}
/** Corrections may revoke existing dependent bonuses; they never create a fresh historical bonus. */
export function reconcileAwardedBonuses(slots: readonly StreakSlot[]) {
  return projectStreaks(slots).map((slot) => ({
    ...slot,
    bonus: slot.bonusAwarded ? slot.bonus : zeroStats(),
    withdrawBonus: Boolean(slot.bonusAwarded && slot.streak % 3 !== 0),
  }))
}
