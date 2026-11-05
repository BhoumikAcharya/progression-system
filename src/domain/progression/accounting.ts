import { STAT_KEYS, type LocalDate, type StatEffects } from '../types'
import { transitionCost } from './levels'
export const zeroStats = (): StatEffects => ({ STR: 0, INT: 0, VIT: 0, DIS: 0, BNK: 0 })
export function potentialXp(effects: StatEffects): number {
  return STAT_KEYS.reduce((sum, key) => sum + Math.max(0, effects[key]), 0) * 150
}
export function validateEffects(effects: StatEffects): void {
  for (const key of STAT_KEYS)
    if (!Number.isSafeInteger(effects[key])) throw new RangeError(`Invalid ${key} effect`)
}
export function applyEffects(current: StatEffects, raw: StatEffects) {
  validateEffects(raw)
  const stats = { ...current },
    effective = zeroStats()
  for (const key of STAT_KEYS) {
    const before = current[key]
    if (!Number.isSafeInteger(before) || before < 0) throw new RangeError(`Invalid ${key} balance`)
    const after = Math.max(0, before + raw[key])
    if (!Number.isSafeInteger(after)) throw new RangeError('Stat overflow')
    stats[key] = after
    effective[key] = after - before
  }
  const xpCredit = STAT_KEYS.reduce((sum, key) => sum + Math.max(0, effective[key]), 0) * 150
  return { stats, effective, xpCredit }
}
export function cumulativeThreshold(level: number): number {
  if (!Number.isSafeInteger(level) || level < 1) throw new RangeError('Invalid level')
  let total = 0
  for (let n = 1; n < level; n++) total += transitionCost(n)
  if (!Number.isSafeInteger(total)) throw new RangeError('XP overflow')
  return total
}
export function levelState(correctedLifetimeXp: number, highestLevelAchieved: number) {
  if (
    !Number.isSafeInteger(correctedLifetimeXp) ||
    correctedLifetimeXp < 0 ||
    !Number.isSafeInteger(highestLevelAchieved) ||
    highestLevelAchieved < 1
  )
    throw new RangeError('Invalid level state')
  let level = highestLevelAchieved
  while (correctedLifetimeXp >= cumulativeThreshold(level + 1)) level++
  const floor = cumulativeThreshold(level),
    next = cumulativeThreshold(level + 1)
  return {
    highestLevelAchieved: level,
    transitionCost: transitionCost(level),
    progressXp: Math.max(0, correctedLifetimeXp - floor),
    progressFraction: Math.max(
      0,
      Math.min(1, (correctedLifetimeXp - floor) / transitionCost(level)),
    ),
    remainingXp: Math.max(0, next - correctedLifetimeXp),
  }
}
export interface LedgerSource {
  id: string
  activityDate: LocalDate
  order: number
  rawEffects: StatEffects
  valid: boolean
}
/** Stable replay makes historical corrections recompute later floor-limited penalties. */
export function replayLedger(sources: readonly LedgerSource[]) {
  let stats = zeroStats(),
    xp = 0
  const entries = sources
    .filter((s) => s.valid)
    .sort(
      (a, b) =>
        a.activityDate.localeCompare(b.activityDate) ||
        a.order - b.order ||
        a.id.localeCompare(b.id),
    )
    .map((source) => {
      const applied = applyEffects(stats, source.rawEffects)
      stats = applied.stats
      xp += applied.xpCredit
      return { ...source, effectiveEffects: applied.effective, xpCredit: applied.xpCredit }
    })
  if (!Number.isSafeInteger(xp)) throw new RangeError('XP overflow')
  return { stats, correctedLifetimeXp: xp, entries }
}
export function dailySummary(entries: ReturnType<typeof replayLedger>['entries'], day: LocalDate) {
  const matching = entries.filter((e) => e.activityDate === day)
  const effects = zeroStats()
  for (const entry of matching)
    for (const key of STAT_KEYS) effects[key] += entry.effectiveEffects[key]
  const gained = matching.reduce(
    (sum, e) => sum + STAT_KEYS.reduce((n, key) => n + Math.max(0, e.effectiveEffects[key]), 0),
    0,
  )
  const lost = matching.reduce(
    (sum, e) => sum + STAT_KEYS.reduce((n, key) => n + Math.min(0, e.effectiveEffects[key]), 0),
    0,
  )
  return {
    recorded: matching.length > 0,
    effects,
    gained,
    lost,
    net: gained + lost,
    xp: matching.reduce((sum, e) => sum + e.xpCredit, 0),
  }
}
