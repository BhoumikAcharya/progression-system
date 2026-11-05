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
  await expect(page.getByRole('form', { name: 'Quest editor' })).toBeVisible()
  if (testInfo.project.name.startsWith('ipad'))
    await expect(page.getByRole('heading', { name: 'Sleep check-in' })).toBeVisible()
  else await expect(page.locator('.quest-list')).toBeHidden()
  await expect(page.getByRole('navigation').getByRole('link')).toHaveCount(6)
})
test('quest editor changes draft and reports unsaved preview', async ({ page }) => {
  await page.goto('/quests/new')
  const selector = await page.getByLabel('Quest type').boundingBox()
  const arrow = await page.locator('.quest-type-select svg').boundingBox()
  expect(
    Math.abs(selector!.y + selector!.height / 2 - (arrow!.y + arrow!.height / 2)),
  ).toBeLessThan(1)
  await page.getByPlaceholder('Name your quest').fill('Read every day')
  await page.getByRole('button', { name: 'Increase Intelligence' }).click()
  await expect(page.getByText('+150 XP')).toBeVisible()
  await page.getByRole('button', { name: 'Save Quest' }).click()
  await expect(page.getByRole('alert')).toContainText('This draft has not been saved')
  await page.getByLabel('Quest type').selectOption('Routine')
  await page.getByRole('textbox', { name: 'Step 1' }).fill('Open book')
  await page.getByRole('button', { name: 'Add step' }).click()
  await page.getByRole('textbox', { name: 'Step 2' }).fill('Read chapter')
  await expect(page.getByText('Parent reward', { exact: true })).toBeVisible()
})
test('hobby editor configures independent subtask and finish rewards', async ({ page }) => {
  await page.goto('/hobbies')
  await page.getByRole('link', { name: 'Add Hobby / Project' }).click()
  await expect(page.getByRole('form', { name: 'Hobby editor' })).toBeVisible()
  await page.getByPlaceholder('Name your project').fill('Sketchbook')
  await page.getByRole('textbox', { name: 'Hobby subtask 1' }).fill('Draw')
  await page.getByLabel('Schedule for subtask 1').selectOption('WEEKDAYS')
  await page
    .getByRole('group', { name: 'Days for subtask 1' })
    .getByRole('button', { name: 'Mon' })
    .click()
  await expect(page.getByText('Potential +750 XP when finished, once.')).toBeVisible()
  await page.getByRole('button', { name: 'Save Hobby' }).click()
  await expect(page.getByRole('alert')).toContainText('This hobby has not been saved')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})
test('sleep and archives share reachable routes in local preview', async ({ page }) => {
  await page.goto('/quests')
  await expect(page.getByLabel('Sleep night')).toBeVisible()
  await page.goto('/hub/sleep')
  await expect(page.getByLabel('Sleep night')).toBeVisible()
  await expect(page.getByText('Connect a private account to record sleep')).toBeVisible()
  await page.goto('/todos?archive=1')
  await expect(page.locator('details.archive')).toHaveAttribute('open', '')
  await page.goto('/hub/hobby-archive')
  await expect(page.getByText('Paused · can restore')).toBeVisible()
  await page.goto('/hub/quest-archive')
  await expect(page.getByText('Archived · can restore')).toBeVisible()
})
test('manual System Report is fullscreen and uses real calendar date', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-05T08:00:00Z') })
  await page.goto('/calendar')
  await page.getByRole('button', { name: 'Wednesday, 4 November 2026', exact: true }).click()
  await page.getByRole('link', { name: 'System Report' }).click()
  await expect(page.getByRole('main', { name: 'System Report' })).toBeVisible()
  await expect(page.getByText('Wednesday, November 4, 2026')).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Primary navigation' })).toHaveCount(0)
  await expect(page.getByText('No activity was recorded for this date.')).toBeVisible()
  await page.getByRole('button', { name: 'Continue to Status' }).click()
  await expect(page).toHaveURL(/\/status$/)
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
test('keyboard entry, touch targets, form text and reduced motion are usable', async ({ page }) => {
  await page.goto('/status')
  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.locator('#main')).toBeFocused()
  const navSizes = await page
    .getByRole('navigation', { name: 'Primary navigation' })
    .getByRole('link')
    .evaluateAll((links) =>
      links.map((link) => {
        const rect = link.getBoundingClientRect()
        return { width: rect.width, height: rect.height }
      }),
    )
  expect(navSizes.every(({ width, height }) => width >= 44 && height >= 44)).toBe(true)
  await page.goto('/quests/new')
  const controls = page.getByRole('button', {
    name: /^(Increase|Decrease) (Strength|Intelligence|Vitality|Discipline|Bank)$/,
  })
  expect(await controls.count()).toBe(10)
  expect(
    await controls.evaluateAll((buttons) =>
      buttons.every(
        (button) =>
          button.getBoundingClientRect().width >= 44 && button.getBoundingClientRect().height >= 44,
      ),
    ),
  ).toBe(true)
  expect(
    await page
      .getByPlaceholder('Name your quest')
      .evaluate((input) => parseFloat(getComputedStyle(input).fontSize)),
  ).toBeGreaterThanOrEqual(16)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  expect(
    await page
      .locator('.save-button')
      .evaluate((button) => getComputedStyle(button).transitionDuration),
  ).toBe('0s')
})
test('install manifest and backup preview state are truthful', async ({ page, request }) => {
  const manifestResponse = await request.get('/manifest.webmanifest')
  expect(manifestResponse.ok()).toBe(true)
  const manifest = await manifestResponse.json()
  expect(manifest.name).toBe('Progression System')
  expect(manifest.display).toBe('standalone')
  expect(manifest.icons.map((icon: { sizes: string }) => icon.sizes)).toEqual([
    '192x192',
    '512x512',
  ])
  await page.goto('/hub/settings')
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    'href',
    '/manifest.webmanifest',
  )
  await expect(page.getByText('Not connected — local UI preview only.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Download JSON backup' })).toHaveCount(0)
})
