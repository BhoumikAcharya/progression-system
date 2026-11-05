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

test('archives show completed activity from previous dates and nested To-Dos', async ({ page }) => {
  const hidden = new Set<string>()
  let removedTodo = false
  await page.route('**/mock/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
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
    if (url.pathname.endsWith('/rest/v1/archive_hidden_entries'))
      return json(
        [...hidden]
          .map((value) => ({ entry_id: value.split(':')[1] }))
          .filter((row) =>
            hidden.has(`${url.searchParams.get('entry_kind')?.replace('eq.', '')}:${row.entry_id}`),
          ),
      )
    if (url.pathname.endsWith('/rest/v1/rpc/remove_archive_entry')) {
      const body = request.postDataJSON() as { p_kind: string; p_entry_id: string }
      hidden.add(`${body.p_kind}:${body.p_entry_id}`)
      return json(null)
    }
    if (url.pathname.endsWith('/rest/v1/rpc/remove_archived_todo')) {
      removedTodo = true
      return json(null)
    }
    if (url.pathname.endsWith('/rest/v1/rpc/claim_morning_report')) return json(null)
    if (url.pathname.endsWith('/rest/v1/quest_definitions'))
      return json([
        {
          id: '10000000-0000-4000-8000-000000000001',
          name: 'Archived Reading',
          version: 2,
          schedule_spec: { kind: 'DAILY' },
          quest_occurrences: [],
        },
      ])
    if (url.pathname.endsWith('/rest/v1/hobbies'))
      return json([
        {
          id: '20000000-0000-4000-8000-000000000001',
          name: 'Paused Painting',
          state: 'archived',
          version: 2,
          finished_at: null,
        },
      ])
    if (url.pathname.endsWith('/rest/v1/reward_source_events')) {
      if (url.searchParams.get('source_type') === 'eq.quest')
        return json([
          {
            id: '30000000-0000-4000-8000-000000000001',
            source_id: '70000000-0000-4000-8000-000000000001',
            activity_date: '2026-11-02',
            scheduled_date: '2026-11-02',
            config_snapshot: { quest_name: 'Archived Reading' },
          },
        ])
      if (url.searchParams.get('source_type') === 'eq.hobby')
        return json([
          {
            id: '40000000-0000-4000-8000-000000000001',
            source_id: '80000000-0000-4000-8000-000000000001',
            activity_date: '2026-11-03',
            scheduled_date: '2026-11-01',
            config_snapshot: { hobby_name: 'Paused Painting', step_name: 'Paint a study' },
          },
        ])
      return json([])
    }
    if (url.pathname.endsWith('/rest/v1/todo_items'))
      return json(
        removedTodo
          ? []
          : [
              {
                id: '50000000-0000-4000-8000-000000000001',
                parent_id: null,
                title: 'Plan weekend',
                done: true,
                archived: true,
                position: 0,
              },
              {
                id: '60000000-0000-4000-8000-000000000001',
                parent_id: '50000000-0000-4000-8000-000000000001',
                title: 'Book tickets',
                done: true,
                archived: false,
                position: 0,
              },
            ],
      )
    return json([])
  })

  await page.goto('/login')
  await page.getByLabel('Email').fill('owner@example.test')
  await page.getByLabel('Password').fill('test-password')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/status$/)

  await page.goto('/hub/quest-archive')
  await expect(page.getByText('Archived · can restore')).toBeVisible()
  await expect(page.getByText('Completed quests · all dates')).toBeVisible()
  await expect(page.getByText('2026-11-02')).toBeVisible()
  page.once('dialog', (dialog) => dialog.accept())
  await page
    .getByText('Archived Reading')
    .first()
    .locator('..')
    .getByRole('button', { name: 'Remove' })
    .click()
  await expect(
    page
      .getByRole('heading', { name: 'Archived · can restore' })
      .locator('..')
      .getByText('Archived Reading', { exact: true }),
  ).toHaveCount(0)
  await expect(page.getByText('2026-11-02')).toBeVisible()
  page.once('dialog', (dialog) => dialog.accept())
  await page
    .getByRole('heading', { name: 'Completed quests · all dates' })
    .locator('..')
    .getByRole('button', { name: 'Remove' })
    .click()
  await expect(page.getByText('2026-11-02')).toHaveCount(0)
  await page.reload()
  await expect(page.getByText('2026-11-02')).toHaveCount(0)
  await page.goto('/hub/hobby-archive')
  await expect(page.getByText('Completed hobby tasks · all dates')).toBeVisible()
  await expect(page.getByText('Paused Painting · Paint a study')).toBeVisible()
  await expect(page.getByText('due 2026-11-01')).toBeVisible()
  page.once('dialog', (dialog) => dialog.accept())
  await page
    .getByText('Paused Painting', { exact: true })
    .locator('..')
    .getByRole('button', { name: 'Remove' })
    .click()
  await expect(page.getByText('Paused Painting', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Paused Painting · Paint a study')).toBeVisible()
  await page.goto('/todos?archive=1')
  await expect(page.getByText('Plan weekend')).toBeVisible()
  await expect(page.getByText('Book tickets')).toBeVisible()
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByText('Plan weekend').locator('..').getByRole('button', { name: 'Remove' }).click()
  await expect(page.getByText('Plan weekend')).toHaveCount(0)
})
