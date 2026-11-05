import type { Occurrence, PlayerProfile, StatEffects } from '../types'
export interface RewardProjection {
  rawEffects: StatEffects
  streakEffects: StatEffects
  effectiveEffects: StatEffects
  xpCredit: number
  highestLevelAchieved: number
}
// TODO M2: pure floor-aware ordered ledger replay, cumulative XP and streak dependencies.
// This is a calculation contract, never a client API for writing totals.
export interface ProgressionEngine {
  project(profile: Readonly<PlayerProfile>, occurrences: readonly Occurrence[]): RewardProjection
}
