import { createClient } from '@supabase/supabase-js'
import { PGlite } from '@electric-sql/pglite'
import { existsSync, readFileSync, readdirSync } from 'node:fs'

const requiredFiles = ['.env.local', '.env.live-test.local']
for (const file of requiredFiles) {
  if (!existsSync(file)) throw new Error(`Missing ${file}`)
  process.loadEnvFile(file)
}

const required = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_PUBLISHABLE_KEY',
  'PRIMARY_TEST_EMAIL',
  'PRIMARY_TEST_PASSWORD',
  'SECONDARY_TEST_EMAIL',
  'SECONDARY_TEST_PASSWORD',
]
for (const name of required)
  if (!process.env[name]) throw new Error(`Set ${name} in the local ignored env file`)

const url = process.env.VITE_SUPABASE_URL
if (url !== 'https://jtrvzbkklpiuwydaolek.supabase.co') {
  throw new Error('Refusing to run: target is not progression-system-dev')
}
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY
if (!key.startsWith('sb_publishable_')) throw new Error('Expected a publishable key')
const makeClient = () =>
  createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
const a = makeClient()
const aSecondDevice = makeClient()
const b = makeClient()
const results = []
const pass = (name) => {
  results.push(name)
  console.log(`PASS ${name}`)
}
const check = (condition, message) => {
  if (!condition) throw new Error(message)
}
const unwrap = (result, label) => {
  if (result.error) throw new Error(`${label}: ${result.error.message}`)
  return result.data
}

async function signIn(client, email, password) {
  const data = unwrap(await client.auth.signInWithPassword({ email, password }), 'sign-in')
  check(data.user?.id, 'Sign-in returned no user')
  return data.user.id
}

async function ensureProfile(client, id) {
  const existing = unwrap(
    await client.from('profiles').select('user_id').eq('user_id', id),
    'read profile',
  )
  if (existing.length) return
  unwrap(
    await client.from('profiles').insert({
      user_id: id,
      display_name: 'Live Test',
      time_zone: 'Asia/Kolkata',
      theme: 'inked-fantasy',
    }),
    'create profile',
  )
}

function questDay() {
  // Date in the account zone after the 03:00 quest-day cutoff.
  const shifted = new Date(Date.now() - 3 * 60 * 60 * 1000)
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(shifted)
  const part = (kind) => parts.find((entry) => entry.type === kind)?.value
  return `${part('year')}-${part('month')}-${part('day')}`
}

async function verifyIsolatedRecovery(snapshot) {
  const database = new PGlite()
  try {
    await database.exec(`create role anon; create role authenticated; create schema auth;
      create table auth.users(id uuid primary key);
      grant usage on schema auth to anon,authenticated;
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;`)
    const files = readdirSync('supabase/migrations')
      .filter((name) => name.endsWith('.sql'))
      .sort()
    for (const file of files) {
      const sql = readFileSync(`supabase/migrations/${file}`, 'utf8').replace(
        'create extension if not exists pgcrypto;',
        '',
      )
      await database.exec(sql)
    }
    await database.query('insert into auth.users(id) values ($1)', [snapshot.account_user_id])
    const restoreOrder = [
      'profiles',
      'quest_definitions',
      'quest_schedule_periods',
      'quest_outcomes',
      'routine_steps',
      'quest_occurrences',
      'routine_step_completions',
      'hobbies',
      'hobby_steps',
      'hobby_occurrences',
      'hobby_finish_awards',
      'hobby_reschedules',
      'sleep_records',
      'todo_items',
      'reward_source_events',
      'stat_ledger_entries',
      'xp_ledger_entries',
      'streak_states',
      'audit_events',
      'archive_hidden_entries',
    ]
    for (const table of restoreOrder) {
      const exportedRows = snapshot.tables[table]
      check(Array.isArray(exportedRows), `Export lacks ${table}`)
      const rows =
        table === 'todo_items'
          ? [...exportedRows].sort(
              (left, right) => Number(Boolean(left.parent_id)) - Number(Boolean(right.parent_id)),
            )
          : exportedRows
      for (const row of rows) {
        const columns = Object.keys(row)
        const identifiers = columns.map((column) => `"${column.replaceAll('"', '""')}"`).join(',')
        const placeholders = columns.map((_, index) => `$${index + 1}`).join(',')
        const values = columns.map((column) => {
          const value = row[column]
          return value && typeof value === 'object' ? JSON.stringify(value) : value
        })
        await database.query(
          `insert into public."${table}" (${identifiers}) values (${placeholders})`,
          values,
        )
      }
      const restored = await database.query(`select count(*)::int as n from public."${table}"`)
      check(restored.rows[0].n === exportedRows.length, `Recovery count mismatch in ${table}`)
    }
    await database.exec(
      `set role authenticated; set request.jwt.claim.sub='${snapshot.account_user_id}'`,
    )
    const restoredProfile = await database.query(
      'select corrected_lifetime_xp,stats from public.profiles',
    )
    check(restoredProfile.rows.length === 1, 'Recovered owner profile is not readable')
    check(
      Number(restoredProfile.rows[0].corrected_lifetime_xp) ===
        Number(snapshot.tables.profiles[0].corrected_lifetime_xp),
      'Recovered XP does not match the export',
    )
    check(
      JSON.stringify(restoredProfile.rows[0].stats) ===
        JSON.stringify(snapshot.tables.profiles[0].stats),
      'Recovered stats do not match the export',
    )
  } finally {
    await database.close()
  }
}

try {
  const aId = await signIn(a, process.env.PRIMARY_TEST_EMAIL, process.env.PRIMARY_TEST_PASSWORD)
  const aAgainId = await signIn(
    aSecondDevice,
    process.env.PRIMARY_TEST_EMAIL,
    process.env.PRIMARY_TEST_PASSWORD,
  )
  const bId = await signIn(b, process.env.SECONDARY_TEST_EMAIL, process.env.SECONDARY_TEST_PASSWORD)
  check(aId === aAgainId && aId !== bId, 'Test accounts are not distinct')
  pass('two-account authentication and second-device session')

  await ensureProfile(a, aId)
  await ensureProfile(b, bId)
  const profileA = unwrap(
    await a.from('profiles').select('user_id,corrected_lifetime_xp,stats'),
    'primary profile',
  )
  const profileB = unwrap(await b.from('profiles').select('user_id'), 'secondary profile')
  check(profileA.length === 1 && profileA[0].user_id === aId, 'Primary profile scope failed')
  check(profileB.length === 1 && profileB[0].user_id === bId, 'Secondary profile scope failed')
  pass('owner-only profile reads')

  const foreignRead = unwrap(
    await b.from('profiles').select('user_id').eq('user_id', aId),
    'foreign profile read',
  )
  check(foreignRead.length === 0, 'Secondary user read primary profile')
  const foreignWrite = await b
    .from('profiles')
    .update({ display_name: 'Invalid' })
    .eq('user_id', aId)
    .select('user_id')
  check(
    !foreignWrite.error && foreignWrite.data.length === 0,
    'Secondary user modified primary profile',
  )
  const xpWrite = await a
    .from('profiles')
    .update({ corrected_lifetime_xp: 999999 })
    .eq('user_id', aId)
  check(Boolean(xpWrite.error), 'Client was allowed to author XP')
  pass('cross-account isolation and XP write restriction')

  const marker = `Live check ${Date.now()}`
  const day = questDay()
  const creationRequest = {
    p_request_id: crypto.randomUUID(),
    p_type: 'standard',
    p_name: marker,
    p_description: 'Disposable development-project check',
    p_schedule: { kind: 'DAILY' },
    p_effects: { STR: 1 },
    p_outcomes: null,
    p_steps: null,
  }
  const [createdOnA, createdOnSecondDevice] = await Promise.all([
    a.rpc('create_quest_once', creationRequest),
    aSecondDevice.rpc('create_quest_once', creationRequest),
  ])
  const quest = unwrap(createdOnA, 'create quest')
  const repeatedQuest = unwrap(createdOnSecondDevice, 'repeat quest creation')
  check(quest.id, 'Quest creation returned no ID')
  check(repeatedQuest.id === quest.id, 'Repeated creation produced two quests')
  const matchingDefinitions = unwrap(
    await a.from('quest_definitions').select('id').eq('name', marker),
    'matching quest definitions',
  )
  check(matchingDefinitions.length === 1, 'Repeated creation stored duplicate definitions')
  const foreignQuest = unwrap(
    await b.from('quest_definitions').select('id').eq('id', quest.id),
    'foreign quest read',
  )
  check(foreignQuest.length === 0, 'Secondary user read primary quest')
  pass('idempotent quest creation and quest RLS')

  const request = {
    p_quest_id: quest.id,
    p_scheduled_date: day,
    p_outcome_id: null,
    p_activity_date: day,
  }
  const attempts = await Promise.all([
    a.rpc('record_quest', request),
    aSecondDevice.rpc('record_quest', request),
  ])
  const successful = attempts.filter((item) => !item.error)
  check(
    successful.length >= 1,
    `Concurrent completion failed: ${attempts.map((x) => x.error?.message).join(' / ')}`,
  )
  const occurrence = unwrap(
    await a.from('quest_occurrences').select('id,version,status').eq('quest_id', quest.id),
    'occurrences',
  )
  check(
    occurrence.length === 1 && occurrence[0].status === 'completed',
    'Duplicate or missing occurrence',
  )
  const events = unwrap(
    await a
      .from('reward_source_events')
      .select('id,revision,valid')
      .eq('source_type', 'quest')
      .eq('source_id', occurrence[0].id),
    'award events',
  )
  check(events.length === 1 && events[0].valid, 'Duplicate award after concurrent completion')
  const xp = unwrap(
    await a.from('xp_ledger_entries').select('credit_delta').eq('source_event_id', events[0].id),
    'XP ledger',
  )
  check(xp.length === 1 && Number(xp[0].credit_delta) === 150, 'Expected one 150 XP award')
  pass('concurrent completion creates one occurrence and one award')

  const onSecondDevice = unwrap(
    await aSecondDevice.from('quest_occurrences').select('id,status').eq('id', occurrence[0].id),
    'second-device sync',
  )
  check(
    onSecondDevice.length === 1 && onSecondDevice[0].status === 'completed',
    'Second device did not see completion',
  )
  const history = unwrap(
    await a
      .from('reward_source_events')
      .select(
        'id,activity_date,stat_ledger_entries(stat_key,effective_delta),xp_ledger_entries(credit_delta)',
      )
      .eq('id', events[0].id),
    'history join',
  )
  check(
    history.length === 1 &&
      history[0].stat_ledger_entries.some(
        (entry) => entry.stat_key === 'STR' && entry.effective_delta === 1,
      ),
    'History stat missing',
  )
  pass('second-device synchronization and history joins')

  unwrap(
    await a.rpc('remove_archive_entry', {
      p_kind: 'quest_completion',
      p_entry_id: occurrence[0].id,
    }),
    'hide completed archive entry',
  )
  const hiddenA = unwrap(
    await aSecondDevice
      .from('archive_hidden_entries')
      .select('entry_id,entry_kind')
      .eq('entry_id', occurrence[0].id),
    'second-device archive visibility',
  )
  check(
    hiddenA.length === 1 && hiddenA[0].entry_kind === 'quest_completion',
    'Archive removal did not synchronize',
  )
  const hiddenB = unwrap(
    await b.from('archive_hidden_entries').select('entry_id').eq('entry_id', occurrence[0].id),
    'foreign archive visibility',
  )
  check(hiddenB.length === 0, 'Secondary account read private archive setting')
  const foreignRemoval = await b.rpc('remove_archive_entry', {
    p_kind: 'quest_completion',
    p_entry_id: occurrence[0].id,
  })
  check(Boolean(foreignRemoval.error), 'Secondary account removed primary archive entry')
  pass('archive removal sync and owner isolation')

  const removed = unwrap(
    await a.rpc('remove_quest_completion', {
      p_occurrence_id: occurrence[0].id,
      p_expected_version: occurrence[0].version,
    }),
    'remove incorrect completion',
  )
  check(
    removed.status === 'unreported' && removed.version === occurrence[0].version + 1,
    'Correction did not advance occurrence version',
  )
  const afterCorrection = unwrap(
    await a.from('profiles').select('corrected_lifetime_xp,stats').eq('user_id', aId).single(),
    'corrected profile',
  )
  check(
    Number(afterCorrection.corrected_lifetime_xp) === Number(profileA[0].corrected_lifetime_xp),
    'Correction did not withdraw XP',
  )
  const awardAfter = unwrap(
    await a.from('reward_source_events').select('valid').eq('id', events[0].id).single(),
    'corrected award',
  )
  check(awardAfter.valid === false, 'Incorrect award remains valid')
  pass('audited completion correction and XP withdrawal')

  const exportA = unwrap(await a.rpc('export_private_data'), 'primary JSON export')
  const exportB = unwrap(await b.rpc('export_private_data'), 'secondary JSON export')
  check(
    exportA.schema_version === 1 && exportA.account_user_id === aId,
    'Primary export identity mismatch',
  )
  check(
    exportB.schema_version === 1 && exportB.account_user_id === bId,
    'Secondary export identity mismatch',
  )
  check(
    exportA.tables.quest_definitions.some((row) => row.id === quest.id),
    'Primary export lacks test quest',
  )
  check(
    exportA.tables.archive_hidden_entries.some((row) => row.entry_id === occurrence[0].id),
    'Primary export lacks archive visibility history',
  )
  check(
    exportB.tables.quest_definitions.every((row) => row.id !== quest.id),
    'Secondary export includes primary quest',
  )
  pass('JSON export shape and owner isolation')

  await verifyIsolatedRecovery(exportA)
  pass('isolated in-memory recovery from JSON export')

  console.log(
    `Completed ${results.length} live checks on progression-system-dev. Test quest: ${quest.id}`,
  )
} catch (error) {
  console.error(`FAIL ${error.message}`)
  process.exitCode = 1
} finally {
  await Promise.all([a.auth.signOut(), aSecondDevice.auth.signOut(), b.auth.signOut()])
}
