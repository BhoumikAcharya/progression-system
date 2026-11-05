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

test('a saved quest appears on the list without refreshing the page', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-05T08:00:00Z') })
  const created = new Map<string, Record<string, unknown>>()
  let hobby: Record<string, unknown> | null = null
  let listReads = 0
  const creationRequestIds: string[] = []
  const profile = {
    user_id: userId,
    display_name: 'Player',
    time_zone: 'Asia/Kolkata',
    theme: 'inked-fantasy',
    stats: { STR: 0, INT: 0, VIT: 0, DIS: 0, BNK: 0 },
    corrected_lifetime_xp: 0,
    highest_level_achieved: 1,
  }
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
    if (url.pathname.endsWith('/rest/v1/profiles')) return json(profile)
    if (url.pathname.endsWith('/rest/v1/rpc/claim_morning_report')) return json(null)
    if (url.pathname.endsWith('/rest/v1/rpc/reconcile_closed_quests')) return json(0)
    if (url.pathname.endsWith('/rest/v1/rpc/create_quest_once')) {
      const request = route.request().postDataJSON() as {
        p_request_id: string
        p_type: string
        p_name: string
        p_schedule: Record<string, unknown>
        p_effects: Record<string, number>
      }
      creationRequestIds.push(request.p_request_id)
      if (!created.has(request.p_request_id)) {
        const ordinal = created.size + 1
        created.set(request.p_request_id, {
          id: `10000000-0000-4000-8000-${String(ordinal).padStart(12, '0')}`,
          type: request.p_type,
          name: request.p_name,
          version: 1,
          effects: request.p_effects,
          quest_schedule_periods: [
            {
              id: `20000000-0000-4000-8000-${String(ordinal).padStart(12, '0')}`,
              generation: 1,
              active_from: '2026-11-05',
              active_through: null,
              schedule_spec: request.p_schedule,
            },
          ],
          quest_outcomes: [],
          routine_steps: [],
        })
      }
      if (creationRequestIds.length === 1) {
        await new Promise((resolve) => setTimeout(resolve, 200))
        return route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Response lost after server save' }),
        })
      }
      return json({ id: created.get(request.p_request_id)?.id })
    }
    if (url.pathname.endsWith('/rest/v1/rpc/create_hobby')) {
      const request = route.request().postDataJSON() as {
        p_name: string
        p_description: string | null
        p_steps: {
          name: string
          schedule: Record<string, unknown>
          effects: Record<string, number>
        }[]
        p_finish_effects: Record<string, number>
      }
      hobby = {
        id: '90000000-0000-4000-8000-000000000001',
        name: request.p_name,
        description: request.p_description,
        version: 1,
        finish_effects: request.p_finish_effects,
        hobby_steps: request.p_steps.map((step, index) => ({
          id: `91000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
          name: step.name,
          schedule_spec: step.schedule,
          effects: step.effects,
          ordinal: index + 1,
          state: 'active',
          active_from: '2026-11-05',
        })),
      }
      return json(hobby)
    }
    if (url.pathname.endsWith('/rest/v1/hobbies')) return json(hobby ? [hobby] : [])
    if (url.pathname.endsWith('/rest/v1/quest_definitions')) {
      listReads += 1
      return json([...created.values()])
    }
    if (url.pathname.endsWith('/rest/v1/sleep_records')) return json(null)
    return json([])
  })

  await page.goto('/login')
  await page.getByLabel('Email').fill('owner@example.test')
  await page.getByLabel('Password').fill('test-password')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/status$/)
  await page.goto('/quests/new')
  await expect(page.getByRole('form', { name: 'Quest editor' })).toBeVisible()
  await page.getByLabel('Quest type').selectOption('Routine')
  const routineBorders = await page
    .locator('.routine-edit-row')
    .first()
    .evaluate((element) => {
      const style = getComputedStyle(element)
      return [style.borderTopWidth, style.borderBottomWidth]
    })
  expect(routineBorders).toEqual(['0px', '1px'])
  await page.getByLabel('Quest type').selectOption('Hobby / Project')
  const hobbyBorders = await page
    .locator('.hobby-step-editor')
    .first()
    .evaluate((element) => {
      const style = getComputedStyle(element)
      const rowStyle = getComputedStyle(element.querySelector('.routine-edit-row')!)
      return [style.borderBottomWidth, rowStyle.borderTopWidth, rowStyle.borderBottomWidth]
    })
  expect(hobbyBorders).toEqual(['0px', '0px', '1px'])
  await page.getByLabel('Quest type').selectOption('Standard')
  for (const placeholder of ['Name your quest', 'Add a description']) {
    const border = await page
      .getByPlaceholder(placeholder)
      .evaluate((element) => getComputedStyle(element).borderBottomWidth)
    expect(border).toBe('0px')
  }
  await page.getByPlaceholder('Name your quest').fill('Read every day')
  await page.getByRole('button', { name: 'Increase Intelligence' }).click()
  await page.getByRole('button', { name: 'Save Quest' }).dblclick()
  await expect(page.getByRole('alert')).toContainText('Response lost after server save')
  expect(creationRequestIds).toHaveLength(1)
  await page.getByRole('button', { name: 'Save Quest' }).click()
  await expect(page).toHaveURL(/\/quests$/)
  await expect(page.getByRole('article', { name: 'Read every day' })).toBeVisible()
  await expect(page.locator('.save-notice')).toContainText('Read every day saved')
  await expect(page.getByPlaceholder('Name your quest')).toHaveValue('')
  expect(creationRequestIds).toHaveLength(2)
  expect(creationRequestIds[1]).toBe(creationRequestIds[0])
  expect(listReads).toBeGreaterThanOrEqual(2)
  await page.goto('/quests/new')
  await page.getByPlaceholder('Name your quest').fill('Future once')
  await page.getByRole('button', { name: 'Once', exact: true }).click()
  await page
    .getByRole('form', { name: 'Quest editor' })
    .locator('input[type=date]')
    .fill('2026-11-04')
  await page.getByRole('button', { name: 'Save Quest' }).click()
  await expect(page.getByRole('alert')).toContainText('Choose today or a future quest day')
  await page
    .getByRole('form', { name: 'Quest editor' })
    .locator('input[type=date]')
    .fill('2026-11-06')
  await page.getByRole('button', { name: 'Save Quest' }).click()
  await expect(page).toHaveURL(/\/quests$/)
  await expect(page.getByRole('region', { name: 'Not due today' })).toContainText('Future once')
  await expect(page.getByRole('region', { name: 'Not due today' })).toContainText(
    'Next due 2026-11-06',
  )
  await expect(page.getByRole('article', { name: 'Future once' })).toHaveCount(0)
  for (const scenario of [
    { name: 'Saturday quest', schedule: 'Days', next: '2026-11-07' },
    { name: 'Monthly quest', schedule: 'Monthly', next: '2026-11-10' },
    { name: 'Yearly quest', schedule: 'Yearly', next: '2026-12-01' },
  ]) {
    await page.goto('/quests/new')
    await page.getByPlaceholder('Name your quest').fill(scenario.name)
    await page.getByRole('button', { name: scenario.schedule, exact: true }).click()
    if (scenario.schedule === 'Days') await page.getByRole('button', { name: 'Sat' }).click()
    if (scenario.schedule === 'Monthly') await page.getByLabel('Day of month').fill('10')
    if (scenario.schedule === 'Yearly') {
      await page.getByLabel('Month', { exact: true }).fill('12')
      await page.getByLabel('Day', { exact: true }).fill('1')
    }
    await page.getByRole('button', { name: 'Save Quest' }).click()
    await expect(page).toHaveURL(/\/quests$/)
    await expect(page.getByRole('region', { name: 'Not due today' })).toContainText(scenario.name)
    await expect(page.getByRole('region', { name: 'Not due today' })).toContainText(scenario.next)
  }
  for (const questType of ['Volatile', 'Routine']) {
    await page.goto('/quests/new')
    await page.getByLabel('Quest type').selectOption(questType)
    await page.getByPlaceholder('Name your quest').fill(`${questType} today`)
    if (questType === 'Routine')
      await page.getByRole('textbox', { name: 'Step 1' }).fill('First step')
    await page.getByRole('button', { name: 'Save Quest' }).click()
    await expect(page).toHaveURL(/\/quests$/)
    await expect(page.getByRole('article', { name: `${questType} today` })).toBeVisible()
  }
  await page.goto('/quests/new')
  await page.getByLabel('Quest type').selectOption('Hobby / Project')
  await page.getByPlaceholder('Name your project').fill('Sketching')
  await page.getByRole('textbox', { name: 'Hobby subtask 1' }).fill('Draw a page')
  await page.getByRole('button', { name: 'Save Hobby' }).click()
  await expect(page).toHaveURL(/\/hobbies$/)
  await expect(page.getByRole('article', { name: 'Sketching' })).toBeVisible()
  await page.goto('/calendar')
  const lastStatBorder = await page
    .locator('.day-stat-list > div')
    .last()
    .evaluate((element) => getComputedStyle(element).borderBottomWidth)
  expect(lastStatBorder).toBe('0px')
})
