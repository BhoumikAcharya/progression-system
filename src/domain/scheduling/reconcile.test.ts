import { expect, it } from 'vitest'
import { closedUnreported } from './reconcile'
it('finds all closed due slots after ten days, without duplicating existing outcomes', () => {
  const period = {
    sourceId: 'q',
    generation: 1,
    activeFrom: '2026-11-01' as const,
    activeThrough: null,
    schedule: { kind: 'DAILY' as const },
  }
  const existing = new Set(['q:1:2026-11-03'])
  const first = closedUnreported([period], '2026-11-11', existing)
  expect(first).toHaveLength(9)
  expect(first.every((o) => o.state === 'unreported')).toBe(true)
  expect(first.at(-1)?.scheduledDate).toBe('2026-11-10')
  const again = closedUnreported(
    [period],
    '2026-11-11',
    new Set([...existing, ...first.map((o) => o.key)]),
  )
  expect(again).toEqual([])
})
it('stops scheduling archived periods', () => {
  expect(
    closedUnreported(
      [
        {
          sourceId: 'q',
          generation: 2,
          activeFrom: '2026-11-01',
          activeThrough: '2026-11-03',
          schedule: { kind: 'DAILY' },
        },
      ],
      '2026-11-11',
      new Set(),
    ),
  ).toHaveLength(3)
})
