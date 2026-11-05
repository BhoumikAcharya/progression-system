import { expect, test, type Page } from '@playwright/test'

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

async function signIn(page: Page, loginCheck: { mode: 'ok' | 'dropped' | 'rejected' }) {
  await page.route('**/mock/**', async (route) => {
    const url = new URL(route.request().url())
    const json = (data: unknown, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) })
    if (url.pathname.endsWith('/auth/v1/token'))
      return json({
        access_token: token,
        token_type: 'bearer',
        expires_in: 3600,
        refresh_token: 'refresh',
        user,
      })
    if (url.pathname.endsWith('/auth/v1/user')) {
      if (loginCheck.mode === 'dropped') return route.abort('failed')
      if (loginCheck.mode === 'rejected')
        return json({ code: 403, error_code: 'bad_jwt', msg: 'Invalid token' }, 403)
      return json(user)
    }
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
    if (url.pathname.includes('/rest/v1/rpc/')) return json(null)
    return json([])
  })
  await page.goto('/login')
  await page.getByLabel('Email').fill('owner@example.test')
  await page.getByLabel('Password').fill('local-test-password')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/status$/)
}

test('a dropped connection keeps a signed-in player in the app', async ({ page }) => {
  const loginCheck: { mode: 'ok' | 'dropped' | 'rejected' } = { mode: 'ok' }
  await signIn(page, loginCheck)

  loginCheck.mode = 'dropped'
  await page.getByRole('link', { name: 'Quests' }).click()
  await expect(page).toHaveURL(/\/quests$/)
  await page.getByRole('link', { name: 'Calendar' }).click()
  await expect(page).toHaveURL(/\/calendar$/)

  await page.reload()
  await expect(page).toHaveURL(/\/calendar$/)
  await expect(page.getByRole('heading', { name: 'Calendar' })).toBeVisible()
})

test('a login the server rejects still returns to sign-in', async ({ page }) => {
  const loginCheck: { mode: 'ok' | 'dropped' | 'rejected' } = { mode: 'ok' }
  await signIn(page, loginCheck)

  loginCheck.mode = 'rejected'
  await page.getByRole('link', { name: 'Quests' }).click()
  await expect(page).toHaveURL(/\/login\?next=%2Fquests$/)
})

test('a dropped connection on save keeps the quest draft on screen', async ({ page }) => {
  const loginCheck: { mode: 'ok' | 'dropped' | 'rejected' } = { mode: 'ok' }
  await signIn(page, loginCheck)
  await page.goto('/quests/new')
  await page.getByPlaceholder('Name your quest').fill('Draft kept')

  loginCheck.mode = 'dropped'
  await page.getByRole('button', { name: 'Save Quest' }).click()
  await expect(page.getByRole('alert')).toContainText('This draft has not been saved.')
  await expect(page.getByPlaceholder('Name your quest')).toHaveValue('Draft kept')
})
