import { expect, it } from 'vitest'
import { createInitialProfile } from './profile'
it('initializes an unscored profile without invented Energy or history', () => {
  expect(createInitialProfile()).toEqual({
    displayName: 'Player',
    timeZone: 'Asia/Kolkata',
    theme: 'inked-fantasy',
    stats: { STR: 0, INT: 0, VIT: 0, DIS: 0, BNK: 0 },
    correctedLifetimeXp: 0,
    highestLevelAchieved: 1,
    energy: null,
  })
})
it('creates independent stat objects for new profiles', () => {
  const first = createInitialProfile()
  first.stats.STR = 9
  expect(createInitialProfile('Yash').stats.STR).toBe(0)
})
