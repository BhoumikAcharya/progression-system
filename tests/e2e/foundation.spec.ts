import { test, expect } from '@playwright/test'
const destinations = ['Status', 'Quests', 'To-Dos', 'Calendar', 'Hobbies', 'Hub']
test.beforeEach(async ({ page }, testInfo) => {
  if (testInfo.project.name.endsWith('oled'))
    await page.addInitScript(() => {
      if (!localStorage.getItem('progression.theme.v1'))
        localStorage.setItem('progression.theme.v1', 'oled-black')
    })
})
test('six routes, empty profile, responsive layouts and review screenshots', async ({
  page,
}, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/')
  const nav = page.getByRole('navigation', { name: 'Primary navigation' })
  await expect(nav.getByRole('link')).toHaveText(destinations)
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0')
  await expect(page.locator('.stats dd')).toHaveText(['0', '0', '0', '0', '0'])
  for (const title of destinations) {
    await nav.getByRole('link', { name: title, exact: true }).click()
    await expect(nav.getByRole('link', { name: title, exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    )
    await expect(page.locator('h1')).toHaveText(title === 'Status' ? 'Player' : title)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    if (['Status', 'Quests', 'Calendar', 'Hub'].includes(title))
      await page.screenshot({
        path: testInfo.outputPath(`${title.toLowerCase()}.png`),
        fullPage: true,
      })
  }
  expect(errors).toEqual([])
})
test('theme changes instantly, persists after reload and leaves profile at zero', async ({
  page,
}, testInfo) => {
  await page.goto('/hub/settings')
  const target = testInfo.project.name.endsWith('oled') ? 'Inked Fantasy' : 'OLED Black'
  const value = target === 'OLED Black' ? 'oled-black' : 'inked-fantasy'
  await page.getByRole('radio', { name: new RegExp(target) }).check()
  await expect(page.locator('html')).toHaveAttribute('data-theme', value)
  await page.reload()
  await expect(page.getByRole('radio', { name: new RegExp(target) })).toBeChecked()
  await page.getByRole('navigation').getByRole('link', { name: 'Status', exact: true }).click()
  await expect(page.locator('.stats dd')).toHaveText(['0', '0', '0', '0', '0'])
})
test('initializes a local name and truthfully persists it', async ({ page }) => {
  await page.goto('/hub/settings')
  await page.getByLabel('Player name', { exact: true }).fill('Yash')
  await page.getByRole('button', { name: 'Save name' }).click()
  await expect(page.getByRole('status')).toHaveText('Name saved on this device only.')
  await page.reload()
  await page.goto('/status')
  await expect(page.locator('h1')).toHaveText('Yash')
})
test('calendar selection, modes and tablet detail pane', async ({ page }, testInfo) => {
  await page.clock.install({ time: new Date('2026-11-05T08:00:00Z') })
  await page.goto('/calendar')
  await page.getByRole('button', { name: 'Wednesday, 4 November 2026', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Day details' })).toContainText(
    'Wednesday, 4 November 2026',
  )
  await page.getByRole('button', { name: 'Sleep', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Day details' })).toContainText(
    'No sleep recorded.',
  )
  await page.getByRole('button', { name: 'Weekly', exact: true }).click()
  await expect(page.locator('.calendar-cell')).toHaveCount(7)
  await page.getByRole('button', { name: 'Daily', exact: true }).click()
  await expect(page.locator('.calendar-cell')).toHaveCount(1)
  if (testInfo.project.name.startsWith('ipad')) {
    const grid = await page.getByRole('region', { name: 'Calendar browser' }).boundingBox()
    const detail = await page.getByRole('region', { name: 'Day details' }).boundingBox()
    expect(detail!.x).toBeGreaterThan(grid!.x + grid!.width)
  }
})
test('quest setup keeps the list alongside on iPad and tabs remain accessible', async ({
  page,
}, testInfo) => {
  await page.goto('/quests')
  await page.getByRole('link', { name: 'Add quest', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Quest editor' })).toBeVisible()
  if (testInfo.project.name.startsWith('ipad'))
    await expect(page.getByRole('heading', { name: 'Sleep check-in' })).toBeVisible()
  else await expect(page.locator('.quest-list')).toBeHidden()
  await expect(page.getByRole('navigation').getByRole('link')).toHaveCount(6)
})
test('offline state is visible and private routes stay closed', async ({ page, context }) => {
  await page.goto('/private/history')
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole('heading', { name: 'Sign-in is not connected yet.' })).toBeVisible()
  await context.setOffline(true)
  await expect(page.getByRole('status')).toContainText('Offline')
  await context.setOffline(false)
  await expect(page.getByText('Offline · activity recording')).toHaveCount(0)
})
test('320px navigation fits without horizontal clipping', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 })
  for (const route of ['/status', '/quests', '/todos', '/calendar', '/hobbies', '/hub/settings']) {
    await page.goto(route)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await expect(page.getByRole('navigation').getByRole('link')).toHaveCount(6)
  }
})
