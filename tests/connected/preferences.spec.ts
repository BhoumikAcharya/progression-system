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

test('signed-in preferences follow the server and reject an offline write', async ({
  page,
  context,
}) => {
  let profile = {
    user_id: userId,
    display_name: 'Server Player',
    time_zone: 'Asia/Kolkata',
    theme: 'inked-fantasy',
    stats: { STR: 0, INT: 0, VIT: 0, DIS: 0, BNK: 0 },
    corrected_lifetime_xp: 0,
    highest_level_achieved: 1,
  }
  const patches: Record<string, unknown>[] = []
  await page.route('**/mock/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const json = (body: unknown) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
    if (url.pathname.endsWith('/auth/v1/token')) {
      await json({
        access_token: token,
        token_type: 'bearer',
        expires_in: 3600,
        refresh_token: 'refresh',
        user,
      })
      return
    }
    if (url.pathname.endsWith('/auth/v1/user')) {
      await json(user)
      return
    }
    if (url.pathname.endsWith('/auth/v1/logout')) {
      await route.fulfill({ status: 204 })
      return
    }
    if (url.pathname.endsWith('/rest/v1/profiles')) {
      if (request.method() === 'PATCH') {
        const patch = request.postDataJSON() as Record<string, unknown>
        patches.push(patch)
        profile = { ...profile, ...patch }
      }
      await json(profile)
      return
    }
    if (url.pathname.endsWith('/rest/v1/rpc/claim_morning_report')) {
      await json(null)
      return
    }
    if (url.pathname.endsWith('/rest/v1/sleep_records')) {
      await json(null)
      return
    }
    if (url.pathname.endsWith('/rest/v1/reward_source_events')) {
      await json([])
      return
    }
    await route.fulfill({ status: 404, contentType: 'application/json', body: '{}' })
  })
  await page.goto('/login')
  await page.getByLabel('Email').fill('owner@example.test')
  await page.getByLabel('Password').fill('test-password')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/status$/)
  await expect(page.locator('h1')).toHaveText('Server Player')
  await page.goto('/hub/settings')
  await page.getByRole('checkbox', { name: /Collapsed by default/ }).check()
  await page.goto('/quests')
  await expect(page.getByRole('button', { name: 'Sleep check-in' })).toHaveAttribute(
    'aria-expanded',
    'false',
  )
  await page.getByRole('button', { name: 'Sleep check-in' }).click()
  await expect(page.getByRole('button', { name: 'Sleep check-in' })).toHaveAttribute(
    'aria-expanded',
    'true',
  )
  await page.goto('/hub/settings')
  await expect(page.getByRole('checkbox', { name: /Collapsed by default/ })).toBeChecked()
  await page.getByRole('radio', { name: /OLED Black/ }).check()
  await expect(page.getByText('Appearance saved to your account.')).toBeVisible()
  expect(patches.at(-1)).toEqual({ theme: 'oled-black' })
  await page.evaluate(() => localStorage.setItem('progression.theme.v1', 'inked-fantasy'))
  await page.reload()
  await expect(page.getByRole('radio', { name: /OLED Black/ })).toBeChecked()
  await page.getByLabel('Player name', { exact: true }).fill('Updated Player')
  await page.getByRole('button', { name: 'Save name' }).click()
  await expect(page.getByText('Name saved to your account.')).toBeVisible()
  expect(patches.at(-1)).toEqual({ display_name: 'Updated Player' })
  await page.reload()
  await expect(page.getByLabel('Player name', { exact: true })).toHaveValue('Updated Player')
  await context.setOffline(true)
  await page.getByRole('radio', { name: /Inked Fantasy/ }).click()
  await expect(page.getByRole('radio', { name: /OLED Black/ })).toBeChecked()
  await expect(page.getByText('Offline. Preference was not saved to your account.')).toBeVisible()
  await context.setOffline(false)
  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page).toHaveURL(/\/login$/)
  await page.goto('/status')
  await expect(page).toHaveURL(/\/login\?next=%2Fstatus$/)
})
