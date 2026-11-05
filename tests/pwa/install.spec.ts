import { expect, test } from '@playwright/test'

test('unconfigured production shell stays closed offline', async ({ page, context }) => {
  await page.goto('/status')
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller))
  const activeState = await page.evaluate(
    async () => (await navigator.serviceWorker.ready).active?.state,
  )
  expect(activeState).toBe('activated')
  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Sign-in is unavailable' })).toBeVisible()
  await page.goto('/quests/new')
  await expect(page.getByRole('heading', { name: 'Sign-in is unavailable' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Save Quest' })).toHaveCount(0)
})
