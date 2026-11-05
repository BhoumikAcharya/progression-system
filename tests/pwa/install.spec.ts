import { expect, test } from '@playwright/test'

test('production shell opens offline without claiming activity was saved', async ({
  page,
  context,
}) => {
  await page.goto('/status')
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller))
  const activeState = await page.evaluate(
    async () => (await navigator.serviceWorker.ready).active?.state,
  )
  expect(activeState).toBe('activated')
  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Player' })).toBeVisible()
  await expect(page.getByRole('status')).toContainText('Nothing is being synced.')
  await page.goto('/quests/new')
  await page.getByPlaceholder('Name your quest').fill('Offline draft')
  await page.getByRole('button', { name: 'Save Quest' }).click()
  await expect(page.getByRole('alert')).toContainText('This draft has not been saved.')
})
