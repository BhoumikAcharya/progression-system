import { describe, expect, it } from 'vitest'
import { transitionCost } from './levels'
describe('level transition requirements', () => {
  it('follows ceil(previous × 1.15), including the corrected level 7 cost', () => {
    expect(Array.from({ length: 8 }, (_, i) => transitionCost(i + 1))).toEqual([
      400, 460, 529, 609, 701, 807, 929, 1069,
    ])
    expect(transitionCost(7)).toBeGreaterThan(927)
  })
  it.each([0, -1, 1.5, NaN, Infinity])('rejects invalid level %s', (level) =>
    expect(() => transitionCost(level)).toThrow(RangeError),
  )
  it('does not silently exceed safe integer precision', () =>
    expect(() => transitionCost(1000)).toThrow(RangeError))
})
