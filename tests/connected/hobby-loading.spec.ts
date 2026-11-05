import { expect, test } from '@playwright/test'

const userId = '00000000-0000-4000-8000-000000000001'
const user = {
  id: userId,
  aud: 'authenticated',
  role: 'authenticated',
  email: 'owner@example.test',
  app_metadata: { provider: 'email', providers: ['email'] },
  user_metadata: {},
  created_at: '2026-11-05T00:00:00Z',
}
const token = [
  Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'),
  Buffer.from(JSON.stringify({ sub: userId, role: 'authenticated', exp: 4102444800 })).toString(
    'base64url',
  ),
  'signature',
].join('.')

test('completed hobby tasks do not flash while completion data is loading', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-06T08:00:00Z') })
  let releaseOccurrences: () => void = () => {}
  const occurrenceGate = new Promise<void>((resolve) => {
    releaseOccurrences = resolve
  })
  await page.route('**/mock/**', async (route) => {
    const url = new URL(route.request().url())
    const json = (data: unknown) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) })
    if (url.pathname.endsWith('/auth/v1/token'))
      return json({
        access_token: token,
        token_type: 'bearer',
        expires_in: 3600,
        refresh_token: 'refresh',
        user,
      })
    if (url.pathname.endsWith('/auth/v1/user')) return json(user)
    if (url.pathname.endsWith('/rest/v1/profiles'))
      return json({
        user_id: userId,
        display_name: 'Player',
        time_zone: 'Asia/Kolkata',
        theme: 'inked-fantasy',
        stats: { STR: 0, INT: 0, VIT: 0, DIS: 0, BNK: 0 },
        corrected_lifetime_xp: 0,
        highest_level_achieved: 1,
      })
    if (url.pathname.endsWith('/rest/v1/rpc/claim_morning_report')) return json(null)
    if (url.pathname.endsWith('/rest/v1/hobbies'))
      return json([
        {
          id: '10000000-0000-4000-8000-000000000001',
          name: 'Painting',
          description: null,
          version: 1,
          finish_effects: { INT: 5 },
          hobby_steps: [
            {
              id: '20000000-0000-4000-8000-000000000001',
              name: 'Paint a study',
              schedule_spec: { kind: 'ONCE', date: '2026-11-06' },
              effects: { INT: 1 },
              ordinal: 1,
              state: 'active',
              active_from: '2026-11-01',
            },
          ],
        },
      ])
    if (url.pathname.endsWith('/rest/v1/hobby_occurrences')) {
      await occurrenceGate
      return json([
        {
          step_id: '20000000-0000-4000-8000-000000000001',
          scheduled_date: '2026-11-06',
        },
      ])
    }
    return json([])
  })
  await page.goto('/login')
  await page.getByLabel('Email').fill('owner@example.test')
  await page.getByLabel('Password').fill('test-password')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/status$/)
  await page.goto('/hobbies')
  await expect(page.getByText('Loading hobbies…')).toBeVisible()
  await expect(page.getByText('Paint a study')).toHaveCount(0)
  releaseOccurrences()
  await expect(page.getByText('All wrapped up for now.')).toBeVisible()
  await expect(page.getByText('Paint a study')).toHaveCount(0)
})
