import type { PlayerProfile } from '../../domain/types'
export function createInitialProfile(displayName = 'Player'): PlayerProfile {
  return {
    displayName,
    timeZone: 'Asia/Kolkata',
    theme: 'inked-fantasy',
    stats: { STR: 0, INT: 0, VIT: 0, DIS: 0, BNK: 0 },
    correctedLifetimeXp: 0,
    highestLevelAchieved: 1,
    energy: null,
  }
}
