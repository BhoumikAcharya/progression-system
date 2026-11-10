import { describe, expect, it } from 'vitest'
import { describeError } from './errors'

describe('describeError', () => {
  it('translates known server codes', () => {
    expect(describeError({ message: 'QUEST_NOT_DUE', code: '22023' }, 'x')).toBe(
      'This quest is not scheduled for that day.',
    )
  })
  it('treats serialization failures and STALE codes as conflicts', () => {
    expect(describeError({ message: 'anything', code: '40001' }, 'x')).toMatch(/Conflict/)
    expect(describeError({ message: 'STALE_HOBBY', code: '22023' }, 'x')).toMatch(/Conflict/)
  })
  it('hides unknown upper-case codes behind the fallback', () => {
    expect(describeError({ message: 'SOMETHING_NEW' }, 'Could not save.')).toBe('Could not save.')
  })
  it('passes through readable messages and handles non-objects', () => {
    expect(describeError(new Error('Row level security violation'), 'x')).toBe(
      'Row level security violation',
    )
    expect(describeError(undefined, 'fallback')).toBe('fallback')
    expect(describeError({ message: 'TypeError: Failed to fetch' }, 'x')).toMatch(/connection/)
  })
})
