process.on('unhandledRejection', (error) => {
  console.error(error.message, error.code, error.query)
  process.exit(1)
})
import assert from 'node:assert/strict'
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
const db = new PGlite()
const a = '00000000-0000-4000-8000-000000000001',
  b = '00000000-0000-4000-8000-000000000002'
const query = async (sql) => (await db.query(sql)).rows
async function rejects(sql, code) {
  await assert.rejects(
    db.exec(sql),
    (error) => error.code === code,
    `${sql} should fail with ${code}`,
  )
}
await db.exec(`create role anon; create role authenticated; create schema auth;
create table auth.users(id uuid primary key); grant usage on schema auth to anon,authenticated;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;`)
for (const file of [
  '202611050001_foundation.sql',
  '202611050002_sleep_transactions.sql',
  '202611050003_quest_awards.sql',
  '202611050004_quest_corrections.sql',
  '202611050005_reconciliation.sql',
  '202611050006_todo_depth.sql',
  '202611050007_quest_creation.sql',
  '202611050008_routine_steps.sql',
  '202611050009_todo_transactions.sql',
  '202611050010_hobby_transactions.sql',
  '202611050011_quest_lifecycle.sql',
  '202611050012_hobby_edit.sql',
  '202611050013_hobby_reschedule.sql',
  '202611050014_restrict_direct_writes.sql',
  '202611050015_history_report.sql',
  '202611050016_historical_routine.sql',
  '202611050017_hobby_corrections.sql',
  '202611050018_finish_corrections.sql',
  '202611050019_private_export.sql',
  '202611060001_idempotent_quest_creation.sql',
  '202611060002_archive_visibility.sql',
  '202611060003_correctness_fixes.sql',
  '202611100001_review_fixes.sql',
]) {
  const sql = readFileSync(new URL(`../migrations/${file}`, import.meta.url), 'utf8').replace(
    'create extension if not exists pgcrypto;',
    '',
  )
  await db.exec(sql)
  console.log(`${file}: applied`)
}
await db.exec(
  `insert into auth.users(id) values ('${a}'),('${b}'); insert into public.profiles(user_id) values ('${a}'),('${b}');`,
)
await db.exec(`set role anon`)
await rejects(`select * from public.profiles`, '42501')
await rejects(`select public.export_private_data()`, '42501')
await db.exec(`reset role; set role authenticated; set request.jwt.claim.sub='${a}'`)
assert.equal((await query('select * from public.profiles')).length, 1)
assert.equal((await query('select auth.uid() as id'))[0].id, a)
await db.exec(
  `update public.profiles set display_name='Account A',theme='oled-black' where user_id='${a}'`,
)
assert.equal(
  (await query(`select theme from public.profiles where user_id='${a}'`))[0].theme,
  'oled-black',
)
assert.equal(
  (
    await query(
      `update public.profiles set display_name='Wrong owner' where user_id='${b}' returning user_id`,
    )
  ).length,
  0,
)
await rejects(
  `insert into public.todo_items(owner_user_id,title) values ('${a}','bypass')`,
  '42501',
)
await rejects(`insert into public.hobbies(owner_user_id,name) values ('${a}','bypass')`, '42501')
await rejects(`update public.profiles set corrected_lifetime_xp=999 where user_id='${a}'`, '42501')
await rejects(`insert into public.profiles(user_id) values ('${b}')`, '42501') // owner check wins before uniqueness
await db.exec(`select public.record_sleep('2026-11-04','EARLY')`)
await rejects(
  `select public.record_sleep((timezone('Asia/Kolkata',now())::date+1),'EARLY')`,
  '22023',
)
let profile = (
  await query(`select stats,corrected_lifetime_xp,highest_level_achieved from public.profiles`)
)[0]
assert.equal(profile.stats.VIT, 1)
assert.equal(profile.stats.DIS, 1)
assert.equal(Number(profile.corrected_lifetime_xp), 300)
await db.exec(`select public.record_sleep('2026-11-04','EARLY')`)
assert.equal(
  (await query(`select count(*)::int as count from public.reward_source_events`))[0].count,
  1,
)
await db.exec(`select public.record_sleep('2026-11-05','EARLY')`)
profile = (
  await query(`select corrected_lifetime_xp,highest_level_achieved from public.profiles`)
)[0]
assert.equal(Number(profile.corrected_lifetime_xp), 600)
assert.equal(profile.highest_level_achieved, 2)
await rejects(`select public.record_sleep('2026-11-04','LATE',0)`, '40001')
await db.exec(`select public.record_sleep('2026-11-04','LATE',1)`)
profile = (
  await query(`select stats,corrected_lifetime_xp,highest_level_achieved from public.profiles`)
)[0]
assert.equal(Number(profile.corrected_lifetime_xp), 300)
assert.equal(profile.highest_level_achieved, 2)
assert.equal(profile.stats.VIT, 1)
assert.equal(profile.stats.DIS, 1)
assert.equal(
  (
    await query(`select count(*)::int as count from public.reward_source_events where valid=true`)
  )[0].count,
  2,
)

const questId = '10000000-0000-4000-8000-000000000001'
await db.exec(`reset role;
 insert into public.quest_definitions(id,owner_user_id,type,name,schedule_spec,effects)
 values ('${questId}','${a}','standard','Test Quest','{"kind":"DAILY"}','{"STR":2}');
 insert into public.quest_schedule_periods(owner_user_id,quest_id,generation,active_from,schedule_spec)
 values ('${a}','${questId}',1,(timezone('Asia/Kolkata',now())-interval '3 hours')::date,'{"kind":"DAILY"}');
 set role authenticated; set request.jwt.claim.sub='${a}'`)
const today = (
  await query(`select (timezone('Asia/Kolkata',now())-interval '3 hours')::date as day`)
)[0].day
const day = new Date(today).toISOString().slice(0, 10)
await db.exec(`select public.record_quest('${questId}','${day}')`)
await db.exec(`select public.record_quest('${questId}','${day}')`)
assert.equal(
  (await query(`select count(*)::int as count from public.quest_occurrences`))[0].count,
  1,
)
assert.equal(
  (
    await query(
      `select count(*)::int as count from public.reward_source_events where source_type='quest'`,
    )
  )[0].count,
  1,
)
profile = (await query(`select stats,corrected_lifetime_xp from public.profiles`))[0]
assert.equal(profile.stats.STR, 2)
assert.equal(Number(profile.corrected_lifetime_xp), 600)

const occurrence = (
  await query(`select id,version from public.quest_occurrences where quest_id='${questId}'`)
)[0]
await rejects(`select public.remove_quest_completion('${occurrence.id}',0)`, '40001')
await db.exec(`select public.remove_quest_completion('${occurrence.id}',1)`)
profile = (
  await query(`select stats,corrected_lifetime_xp,highest_level_achieved from public.profiles`)
)[0]
assert.equal(profile.stats.STR, 0)
assert.equal(Number(profile.corrected_lifetime_xp), 300)
assert.equal(profile.highest_level_achieved, 2)
assert.equal(
  (
    await query(
      `select count(*)::int as count from public.reward_source_events where source_type='quest' and valid=true`,
    )
  )[0].count,
  0,
)
await rejects(`select public.remove_quest_completion('${occurrence.id}',1)`, '40001')

const quest2 = '10000000-0000-4000-8000-000000000002'
const dates = [-2, -1, 0].map((offset) =>
  new Date(new Date(day + 'T12:00:00Z').getTime() + offset * 86400000).toISOString().slice(0, 10),
)
await db.exec(`reset role;
 insert into public.quest_definitions(id,owner_user_id,type,name,schedule_spec,effects)
 values ('${quest2}','${a}','standard','Streak Test','{"kind":"DAILY"}','{"STR":2}');
 insert into public.quest_schedule_periods(owner_user_id,quest_id,generation,active_from,schedule_spec)
 values ('${a}','${quest2}',1,'${dates[0]}','{"kind":"DAILY"}');`)
const periodId = (
  await query(`select id from public.quest_schedule_periods where quest_id='${quest2}'`)
)[0].id
const fixtureIds = []
for (const [i, date] of dates.entries()) {
  const rows =
    await query(`insert into public.quest_occurrences(owner_user_id,quest_id,period_id,scheduled_date,actual_activity_date,status)
 values ('${a}','${quest2}','${periodId}','${date}','${date}','completed') returning id`)
  const id = rows[0].id
  fixtureIds.push(id)
  const bonusText = i === 2 ? '{"STR":1}' : '{}'
  await db.exec(`insert into public.reward_source_events(owner_user_id,source_type,source_id,revision,scheduled_date,activity_date,config_snapshot,raw_effects,streak_effects)
 values ('${a}','quest','${id}',1,'${date}','${date}','{"streak_eligible":true}','{"STR":2}','${bonusText}')`)
}
await db.exec(`set role authenticated; set request.jwt.claim.sub='${a}'`)
await db.exec(`select public.remove_quest_completion('${fixtureIds[0]}',1)`)
const bonus = (
  await query(
    `select e.streak_effects from public.reward_source_events e where e.source_id='${fixtureIds[2]}'`,
  )
)[0]
assert.deepEqual(bonus.streak_effects, {})
profile = (await query(`select stats,corrected_lifetime_xp from public.profiles`))[0]
assert.equal(profile.stats.STR, 4)
assert.equal(Number(profile.corrected_lifetime_xp), 900)

const quest3 = '10000000-0000-4000-8000-000000000003'
const tenDaysAgo = new Date(new Date(day + 'T12:00:00Z').getTime() - 10 * 86400000)
  .toISOString()
  .slice(0, 10)
const fiveDaysAgo = new Date(new Date(day + 'T12:00:00Z').getTime() - 5 * 86400000)
  .toISOString()
  .slice(0, 10)
await db.exec(`reset role;
 insert into public.quest_definitions(id,owner_user_id,type,name,schedule_spec,effects)
 values ('${quest3}','${a}','standard','Long absence','{"kind":"DAILY"}','{"STR":2}');
 insert into public.quest_schedule_periods(owner_user_id,quest_id,generation,active_from,schedule_spec)
 values ('${a}','${quest3}',1,'${tenDaysAgo}','{"kind":"DAILY"}');
 set role authenticated; set request.jwt.claim.sub='${a}'`)
assert.equal((await query(`select public.reconcile_closed_quests() as count`))[0].count, 10)
assert.equal((await query(`select public.reconcile_closed_quests() as count`))[0].count, 0)
assert.equal(
  (
    await query(
      `select count(*)::int as count from public.quest_occurrences where quest_id='${quest3}' and status='unreported'`,
    )
  )[0].count,
  10,
)
await db.exec(`select public.record_quest('${quest3}','${fiveDaysAgo}')`)
assert.equal(
  (
    await query(
      `select status from public.quest_occurrences where quest_id='${quest3}' and scheduled_date='${fiveDaysAgo}'`,
    )
  )[0].status,
  'completed',
)
assert.deepEqual(
  (
    await query(
      `select streak_effects from public.reward_source_events where source_type='quest' and source_id=(select id from public.quest_occurrences where quest_id='${quest3}' and scheduled_date='${fiveDaysAgo}')`,
    )
  )[0].streak_effects,
  {},
)
await db.exec(`reset role`)
assert.equal(
  (
    await query(
      `select app_private.schedule_due('{"kind":"MONTHLY","day":31}'::jsonb,'2026-02-28') as due`,
    )
  )[0].due,
  true,
)
await db.exec(`reset role; set role authenticated; set request.jwt.claim.sub='${b}'`)
assert.equal((await query(`select count(*)::int as count from public.sleep_records`))[0].count, 0)

for (const table of [
  'quest_definitions',
  'quest_occurrences',
  'reward_source_events',
  'stat_ledger_entries',
  'xp_ledger_entries',
  'audit_events',
]) {
  assert.equal(
    (await query(`select count(*)::int as count from public.${table}`))[0].count,
    0,
    `${table} leaked between owners`,
  )
}
await rejects(`select public.record_quest('${quest3}','${day}')`, '22023')
const parent = '30000000-0000-4000-8000-000000000001'
const child = '30000000-0000-4000-8000-000000000002'
await db.exec(`select public.write_todo('create','${parent}','Parent')`)
await db.exec(`select public.write_todo('create','${child}','Child','${parent}')`)
await rejects(
  `select public.write_todo('create','30000000-0000-4000-8000-000000000003','Grandchild','${child}')`,
  '22023',
)
await db.exec(`set request.jwt.claim.sub='${a}'`)
await rejects(
  `select public.write_todo('create','30000000-0000-4000-8000-000000000004','Forged','${parent}')`,
  '22023',
)
await db.exec(`set request.jwt.claim.sub='${b}'`)
await db.exec(`select public.record_sleep('2026-11-04','MIDDLE')`)
assert.equal((await query(`select count(*)::int as count from public.sleep_records`))[0].count, 1)

const created = (
  await query(
    `select (public.create_quest('standard','Read daily',null,'{"kind":"DAILY"}','{"INT":1}')).*`,
  )
)[0]
assert.equal(created.owner_user_id, b)
const creationRequest = '70000000-0000-4000-8000-000000000001'
const createOnceSql = `select (public.create_quest_once('${creationRequest}','standard','Idempotent reading',null,'{"kind":"DAILY"}','{"INT":1}')).*`
const firstCreate = (await query(createOnceSql))[0]
const repeatedCreate = (await query(createOnceSql))[0]
assert.equal(repeatedCreate.id, firstCreate.id)
assert.equal(
  (
    await query(
      `select count(*)::int as count from public.quest_definitions where name='Idempotent reading'`,
    )
  )[0].count,
  1,
)
await rejects(
  `select public.create_quest_once('${creationRequest}','standard','Different name',null,'{"kind":"DAILY"}','{"INT":1}')`,
  '23505',
)
await rejects(`select * from app_private.quest_creation_requests`, '42501')
assert.equal(
  (
    await query(
      `select count(*)::int as count from public.quest_schedule_periods where quest_id='${created.id}'`,
    )
  )[0].count,
  1,
)
const volatile = (
  await query(
    `select (public.create_quest('volatile','No spending',null,'{"kind":"DAILY"}','{}','[{"label":"Yes","effects":{"BNK":1}},{"label":"No","effects":{"BNK":-1}}]')).*`,
  )
)[0]
assert.equal(
  (
    await query(
      `select count(*)::int as count from public.quest_outcomes where quest_id='${volatile.id}'`,
    )
  )[0].count,
  2,
)
const routine = (
  await query(
    `select (public.create_quest('routine','Evening routine',null,'{"kind":"DAILY"}','{"DIS":1}',null,'["Brush teeth","Read"]')).*`,
  )
)[0]
assert.equal(
  (
    await query(
      `select count(*)::int as count from public.routine_steps where quest_id='${routine.id}'`,
    )
  )[0].count,
  2,
)

const routineSteps = await query(
  `select id from public.routine_steps where quest_id='${routine.id}' order by ordinal`,
)
const currentB = (
  await query(`select (timezone('Asia/Kolkata',now())-interval '3 hours')::date as day`)
)[0].day
const bDay = new Date(currentB).toISOString().slice(0, 10)
await db.exec(
  `select public.record_routine_step('${routine.id}','${bDay}','${routineSteps[0].id}')`,
)
assert.equal(
  (
    await query(
      `select count(*)::int as count from public.reward_source_events where source_type='quest'`,
    )
  )[0].count,
  0,
)
await db.exec(
  `select public.record_routine_step('${routine.id}','${bDay}','${routineSteps[1].id}')`,
)
await db.exec(
  `select public.record_routine_step('${routine.id}','${bDay}','${routineSteps[1].id}')`,
)
assert.equal(
  (
    await query(
      `select count(*)::int as count from public.reward_source_events where source_type='quest'`,
    )
  )[0].count,
  1,
)
assert.equal(
  Number(
    (await query(`select corrected_lifetime_xp from public.profiles`))[0].corrected_lifetime_xp,
  ),
  150,
)
await rejects(
  `select public.create_quest('standard','Invalid',null,'{"kind":"DAILY"}','{"STR":1.5}')`,
  '22023',
)
await rejects(
  `select public.create_quest('standard','Invalid date',null,'{"kind":"YEARLY","month":2,"day":31}','{"STR":1}')`,
  '22023',
)
const todoParent = '20000000-0000-4000-8000-000000000001'
const todoChild1 = '20000000-0000-4000-8000-000000000002'
const todoChild2 = '20000000-0000-4000-8000-000000000003'
await db.exec(`select public.write_todo('create','${todoParent}','Pack bag')`)
await db.exec(`select public.write_todo('create','${todoParent}','Pack bag')`)
await db.exec(`select public.write_todo('create','${todoChild1}','Book','${todoParent}')`)
await db.exec(`select public.write_todo('create','${todoChild2}','Charger','${todoParent}')`)
await db.exec(`select public.write_todo('toggle','${todoChild1}',null,null,true)`)
assert.equal(
  (await query(`select done from public.todo_items where id='${todoParent}'`))[0].done,
  false,
)
await db.exec(`select public.write_todo('toggle','${todoChild2}',null,null,true)`)
assert.equal(
  (await query(`select archived from public.todo_items where id='${todoParent}'`))[0].archived,
  true,
)
await db.exec(`select public.write_todo('restore','${todoParent}')`)
assert.equal(
  (
    await query(
      `select count(*)::int as count from public.todo_items where id in ('${todoParent}','${todoChild1}','${todoChild2}') and done`,
    )
  )[0].count,
  0,
)
await db.exec(`select public.write_todo('toggle','${todoParent}',null,null,true)`)
assert.equal(
  (
    await query(
      `select count(*)::int as count from public.todo_items where id in ('${todoChild1}','${todoChild2}') and done`,
    )
  )[0].count,
  2,
)
await db.exec(`select public.write_todo('clear_archive')`)
assert.equal(
  (
    await query(
      `select count(*)::int as count from public.todo_items where id in ('${todoParent}','${todoChild1}','${todoChild2}') and deleted`,
    )
  )[0].count,
  3,
)
assert.equal(
  Number(
    (await query(`select corrected_lifetime_xp from public.profiles`))[0].corrected_lifetime_xp,
  ),
  150,
)
const hobby = (
  await query(
    `select (public.create_hobby('Sketchbook',null,'{"INT":5}','[{"name":"Draw","schedule":{"kind":"DAILY"},"effects":{"INT":1}}]')).*`,
  )
)[0]
const hobbyStep = (await query(`select id from public.hobby_steps where hobby_id='${hobby.id}'`))[0]
await db.exec(`select public.record_hobby_step('${hobbyStep.id}','${bDay}')`)
await db.exec(`select public.record_hobby_step('${hobbyStep.id}','${bDay}')`)
assert.equal(
  (
    await query(
      `select count(*)::int as count from public.reward_source_events where source_type='hobby'`,
    )
  )[0].count,
  1,
)
await db.exec(
  `select public.edit_hobby('${hobby.id}',1,'Sketchbook revised',null,'{"INT":5}','[{"id":"${hobbyStep.id}","name":"Daily drawing","schedule":{"kind":"DAILY"},"effects":{"INT":2}},{"name":"Review","schedule":{"kind":"WEEKDAYS","weekdays":[1]},"effects":{}}]')`,
)
assert.equal(
  (
    await query(
      `select count(*)::int as count from public.hobby_steps where hobby_id='${hobby.id}' and state='active'`,
    )
  )[0].count,
  2,
)
assert.equal(
  Number(
    (await query(`select corrected_lifetime_xp from public.profiles`))[0].corrected_lifetime_xp,
  ),
  300,
)
await db.exec(`select public.change_hobby_state('${hobby.id}','archive',2)`)
await rejects(`select public.record_hobby_step('${hobbyStep.id}','2020-01-01')`, '22023')
await db.exec(`select public.change_hobby_state('${hobby.id}','restore',3)`)
await db.exec(`select public.finish_hobby('${hobby.id}',4)`)
await db.exec(`select public.finish_hobby('${hobby.id}',4)`)
assert.equal(
  (
    await query(
      `select count(*)::int as count from public.reward_source_events where source_type='finish'`,
    )
  )[0].count,
  1,
)
assert.equal(
  (await query(`select count(*)::int as count from public.hobby_finish_awards`))[0].count,
  1,
)
assert.equal(
  Number(
    (await query(`select corrected_lifetime_xp from public.profiles`))[0].corrected_lifetime_xp,
  ),
  1050,
)
await rejects(`select public.change_hobby_state('${hobby.id}','restore',5)`, '22023')
const rescheduled = (
  await query(
    `select (public.create_hobby('Late project',null,'{}','[{"name":"Task","schedule":{"kind":"DAILY"},"effects":{"STR":1}}]')).*`,
  )
)[0]
const rescheduledStep = (
  await query(`select id from public.hobby_steps where hobby_id='${rescheduled.id}'`)
)[0]
const previous = new Date(`${bDay}T12:00:00Z`)
previous.setUTCDate(previous.getUTCDate() - 1)
const yesterday = previous.toISOString().slice(0, 10)
previous.setUTCDate(previous.getUTCDate() + 2)
const tomorrow = previous.toISOString().slice(0, 10)
await db.exec(
  `reset role; update public.hobby_steps set active_from='${yesterday}' where id='${rescheduledStep.id}'; set role authenticated; set request.jwt.claim.sub='${b}'`,
)
await db.exec(
  `select public.reschedule_hobby_step('${rescheduledStep.id}','${yesterday}','${tomorrow}')`,
)
await rejects(`select public.record_hobby_step('${rescheduledStep.id}','${yesterday}')`, '22023')
await db.exec(
  `select public.reschedule_hobby_step('${rescheduledStep.id}','${yesterday}','${bDay}')`,
)
await db.exec(`select public.record_hobby_step('${rescheduledStep.id}','${yesterday}')`)
await db.exec(`select public.record_hobby_step('${rescheduledStep.id}','${yesterday}')`)
assert.equal(
  (
    await query(
      `select count(*)::int as count from public.hobby_occurrences where step_id='${rescheduledStep.id}'`,
    )
  )[0].count,
  1,
)
assert.equal(
  (
    await query(
      `select actual_activity_date from public.hobby_occurrences where step_id='${rescheduledStep.id}'`,
    )
  )[0].actual_activity_date
    .toISOString()
    .slice(0, 10),
  bDay,
)
await rejects(
  `select public.reschedule_hobby_step('${rescheduledStep.id}','${yesterday}','${tomorrow}')`,
  '22023',
)
const archivedQuest = (
  await query(
    `select (public.create_quest('standard','Archive me',null,'{"kind":"DAILY"}','{"STR":1}')).*`,
  )
)[0]
await db.exec(`select public.change_quest_state('${archivedQuest.id}','archive',1)`)
await db.exec(`select public.remove_archive_entry('quest_definition','${archivedQuest.id}')`)
assert.equal(
  (
    await query(
      `select count(*)::int as count from public.archive_hidden_entries where entry_id='${archivedQuest.id}'`,
    )
  )[0].count,
  1,
)
await rejects(
  `select public.remove_archive_entry('quest_completion','${archivedQuest.id}')`,
  '22023',
)
const archivedTodoId = '70000000-0000-4000-8000-000000000002'
await db.exec(`select public.write_todo('create','${archivedTodoId}','Archived note')`)
await db.exec(`select public.write_todo('toggle','${archivedTodoId}',null,null,true)`)
await db.exec(`select public.remove_archived_todo('${archivedTodoId}')`)
assert.equal(
  (await query(`select deleted from public.todo_items where id='${archivedTodoId}'`))[0].deleted,
  true,
)
await rejects(`select public.record_quest('${archivedQuest.id}','${bDay}')`, '22023')
assert.equal(
  (
    await query(
      `select count(*)::int as count from public.quest_schedule_periods where quest_id='${archivedQuest.id}' and active_through is not null`,
    )
  )[0].count,
  1,
)
await rejects(`select public.change_quest_state('${archivedQuest.id}','restore',1)`, '40001')
await db.exec(`select public.change_quest_state('${archivedQuest.id}','restore',2)`)
assert.equal(
  (
    await query(
      `select count(*)::int as count from public.quest_schedule_periods where quest_id='${archivedQuest.id}'`,
    )
  )[0].count,
  2,
)
await db.exec(`select public.change_quest_state('${archivedQuest.id}','delete',3)`)
assert.equal(
  (await query(`select state from public.quest_definitions where id='${archivedQuest.id}'`))[0]
    .state,
  'deleted',
)
await db.exec(`set request.jwt.claim.sub='${a}'`)
const historical = (
  await query(
    `select id,version from public.quest_occurrences where quest_id='${quest3}' and scheduled_date='${fiveDaysAgo}'`,
  )
)[0]
const movedDate = new Date(`${fiveDaysAgo}T12:00:00Z`)
movedDate.setUTCDate(movedDate.getUTCDate() + 1)
const activityDay = movedDate.toISOString().slice(0, 10)
await db.exec(
  `select public.correct_quest_occurrence('${historical.id}',${historical.version},null,'${activityDay}')`,
)
await rejects(
  `select public.correct_quest_occurrence('${historical.id}',${historical.version},null,'${activityDay}')`,
  '40001',
)
assert.equal(
  (
    await query(
      `select count(*)::int as count from public.reward_source_events where source_type='quest' and source_id='${historical.id}' and valid`,
    )
  )[0].count,
  1,
)
assert.equal(
  (
    await query(
      `select activity_date from public.reward_source_events where source_type='quest' and source_id='${historical.id}' and valid`,
    )
  )[0].activity_date
    .toISOString()
    .slice(0, 10),
  activityDay,
)
const reportDay = (await query(`select public.claim_morning_report() as day`))[0].day
assert.equal(new Date(reportDay).toISOString().slice(0, 10), dates[1])
assert.equal((await query(`select public.claim_morning_report() as day`))[0].day, null)
await db.exec(`select public.dismiss_morning_report('${day}')`)
assert.equal((await query(`select public.claim_morning_report() as day`))[0].day, null)
const quest4 = '10000000-0000-4000-8000-000000000004'
const priorDates = [-3, -2, -1].map((offset) =>
  new Date(new Date(`${day}T12:00:00Z`).getTime() + offset * 86400000).toISOString().slice(0, 10),
)
await db.exec(`reset role;
 insert into public.quest_definitions(id,owner_user_id,type,name,schedule_spec,effects) values ('${quest4}','${a}','standard','Preserved bonus','{"kind":"DAILY"}','{"STR":1}');
 insert into public.quest_schedule_periods(owner_user_id,quest_id,generation,active_from,schedule_spec) values ('${a}','${quest4}',1,'${priorDates[0]}','{"kind":"DAILY"}');`)
const bonusPeriod = (
  await query(`select id from public.quest_schedule_periods where quest_id='${quest4}'`)
)[0].id
let bonusOccurrence = ''
for (const [index, date] of priorDates.entries()) {
  const occ = (
    await query(
      `insert into public.quest_occurrences(owner_user_id,quest_id,period_id,scheduled_date,actual_activity_date,status) values ('${a}','${quest4}','${bonusPeriod}','${date}','${date}','completed') returning id`,
    )
  )[0]
  await db.exec(
    `insert into public.reward_source_events(owner_user_id,source_type,source_id,revision,scheduled_date,activity_date,config_snapshot,raw_effects,streak_effects) values ('${a}','quest','${occ.id}',1,'${date}','${date}','{"streak_eligible":true}','{"STR":1}','${index === 2 ? '{"STR":1}' : '{}'}')`,
  )
  if (index === 2) bonusOccurrence = occ.id
}
await db.exec(`set role authenticated; set request.jwt.claim.sub='${a}'`)
await db.exec(`select public.correct_quest_occurrence('${bonusOccurrence}',1,null,'${day}')`)
assert.deepEqual(
  (
    await query(
      `select streak_effects from public.reward_source_events where source_id='${bonusOccurrence}' and valid`,
    )
  )[0].streak_effects,
  { STR: 1 },
)
assert.equal((await query(`select public.claim_morning_report() as day`))[0].day, null)
await db.exec(`reset role;
 update public.quest_schedule_periods set active_from='${yesterday}' where quest_id in ('${volatile.id}','${routine.id}');
 set role authenticated; set request.jwt.claim.sub='${b}'`)
const volatileOutcomes = await query(
  `select id from public.quest_outcomes where quest_id='${volatile.id}' order by slot`,
)
const beforeVolatile = Number(
  (await query(`select corrected_lifetime_xp from public.profiles`))[0].corrected_lifetime_xp,
)
await db.exec(
  `select public.record_quest('${volatile.id}','${yesterday}','${volatileOutcomes[0].id}','${yesterday}')`,
)
const volatileOccurrence = (
  await query(
    `select id,version from public.quest_occurrences where quest_id='${volatile.id}' and scheduled_date='${yesterday}'`,
  )
)[0]
await db.exec(
  `select public.correct_quest_occurrence('${volatileOccurrence.id}',${volatileOccurrence.version},'${volatileOutcomes[1].id}','${yesterday}')`,
)
assert.equal(
  Number(
    (await query(`select corrected_lifetime_xp from public.profiles`))[0].corrected_lifetime_xp,
  ),
  beforeVolatile,
)
assert.equal(
  (
    await query(
      `select count(*)::int as count from public.reward_source_events where source_id='${volatileOccurrence.id}' and valid`,
    )
  )[0].count,
  1,
)
await rejects(
  `select public.correct_quest_occurrence('${volatileOccurrence.id}',${volatileOccurrence.version},'${volatileOutcomes[0].id}','${yesterday}')`,
  '40001',
)
const beforeRoutine = Number(
  (await query(`select corrected_lifetime_xp from public.profiles`))[0].corrected_lifetime_xp,
)
await db.exec(
  `select public.record_historical_routine('${routine.id}','${yesterday}','${yesterday}',array['${routineSteps[0].id}'::uuid,'${routineSteps[1].id}'::uuid])`,
)
await db.exec(
  `select public.record_historical_routine('${routine.id}','${yesterday}','${yesterday}',array['${routineSteps[0].id}'::uuid,'${routineSteps[1].id}'::uuid])`,
)
assert.equal(
  Number(
    (await query(`select corrected_lifetime_xp from public.profiles`))[0].corrected_lifetime_xp,
  ),
  beforeRoutine + 150,
)
assert.equal(
  (
    await query(
      `select count(*)::int as count from public.reward_source_events where source_type='quest' and source_id=(select id from public.quest_occurrences where quest_id='${routine.id}' and scheduled_date='${yesterday}') and valid`,
    )
  )[0].count,
  1,
)
const hobbyOccurrence = (
  await query(
    `select id,version from public.hobby_occurrences where step_id='${rescheduledStep.id}' and scheduled_date='${yesterday}'`,
  )
)[0]
const beforeHobbyCorrection = Number(
  (await query(`select corrected_lifetime_xp from public.profiles`))[0].corrected_lifetime_xp,
)
await db.exec(
  `select public.correct_hobby_occurrence('${hobbyOccurrence.id}',${hobbyOccurrence.version},'${yesterday}','{"STR":2}')`,
)
assert.equal(
  Number(
    (await query(`select corrected_lifetime_xp from public.profiles`))[0].corrected_lifetime_xp,
  ),
  beforeHobbyCorrection + 150,
)
await rejects(
  `select public.correct_hobby_occurrence('${hobbyOccurrence.id}',${hobbyOccurrence.version},'${yesterday}','{"STR":2}')`,
  '40001',
)
await db.exec(
  `select public.correct_hobby_occurrence('${hobbyOccurrence.id}',${hobbyOccurrence.version + 1},null,null,true)`,
)
assert.equal(
  (
    await query(
      `select count(*)::int as count from public.reward_source_events where source_type='hobby' and source_id='${hobbyOccurrence.id}' and valid`,
    )
  )[0].count,
  0,
)
await db.exec(`select public.record_hobby_step('${rescheduledStep.id}','${yesterday}')`)
assert.equal(
  (
    await query(
      `select count(*)::int as count from public.reward_source_events where source_type='hobby' and source_id='${hobbyOccurrence.id}' and valid`,
    )
  )[0].count,
  1,
)
const finishAward = (
  await query(`select id,version from public.hobby_finish_awards where hobby_id='${hobby.id}'`)
)[0]
const beforeFinishCorrection = Number(
  (await query(`select corrected_lifetime_xp from public.profiles`))[0].corrected_lifetime_xp,
)
await db.exec(
  `select public.correct_hobby_finish('${finishAward.id}',${finishAward.version},'${bDay}','{"INT":4}')`,
)
assert.equal(
  Number(
    (await query(`select corrected_lifetime_xp from public.profiles`))[0].corrected_lifetime_xp,
  ),
  beforeFinishCorrection - 150,
)
assert.equal(
  (
    await query(
      `select count(*)::int as count from public.reward_source_events where source_type='finish' and source_id='${finishAward.id}' and valid`,
    )
  )[0].count,
  1,
)
await rejects(
  `select public.correct_hobby_finish('${finishAward.id}',${finishAward.version},'${bDay}','{"INT":3}')`,
  '40001',
)
// Two overlapping client submissions share a unique scheduled occurrence identity.
await Promise.all([
  db.exec(`select public.record_quest('${created.id}','${bDay}')`),
  db.exec(`select public.record_quest('${created.id}','${bDay}')`),
])
assert.equal(
  (
    await query(
      `select count(*)::int as count from public.reward_source_events where source_type='quest' and source_id=(select id from public.quest_occurrences where quest_id='${created.id}' and scheduled_date='${bDay}') and valid`,
    )
  )[0].count,
  1,
)
const exportA = (await query(`select public.export_private_data() as backup`))[0].backup
assert.equal(exportA.schema_version, 1)
assert.ok(exportA.exported_at)
assert.equal(exportA.account_user_id, b)
assert.equal(exportA.tables.profiles.length, 1)
assert.ok(exportA.tables.quest_definitions.length > 0)
assert.ok(exportA.tables.reward_source_events.length > 0)
assert.ok(exportA.tables.audit_events.length > 0)
assert.equal(exportA.tables.archive_hidden_entries.length, 1)
for (const rows of Object.values(exportA.tables)) {
  assert.ok(Array.isArray(rows))
  assert.ok(rows.every((row) => (row.owner_user_id ?? row.user_id) === b))
}
await db.exec(`set request.jwt.claim.sub='${a}'`)
await rejects(
  `select public.remove_archive_entry('quest_definition','${archivedQuest.id}')`,
  '22023',
)
const exportB = (await query(`select public.export_private_data() as backup`))[0].backup
assert.equal(exportB.account_user_id, a)
assert.equal(exportB.tables.profiles.length, 1)
assert.ok(exportB.tables.profiles.every((row) => row.user_id === a))

// Regression: review fixes. Each case uses its own account so earlier state cannot mask it.
const freshAccount = async () => {
  const owner = crypto.randomUUID()
  await db.exec(`reset role; insert into auth.users(id) values ('${owner}');
   insert into public.profiles(user_id) values ('${owner}');
   set role authenticated; set request.jwt.claim.sub='${owner}'`)
  return owner
}
const fixDay = (
  await query(`select (timezone('Asia/Kolkata',now())-interval '3 hours')::date::text as day`)
)[0].day
// The embedded test database has a one-millisecond clock, unlike hosted Postgres.
const pause = () => new Promise((resolve) => setTimeout(resolve, 5))
const newQuest = async (type, schedule, effects, steps = null) =>
  (
    await query(
      `select id from public.create_quest('${type}','Regression',null,'${schedule}'::jsonb,'${effects}'::jsonb,null,${steps ? `'${steps}'::jsonb` : 'null'})`,
    )
  )[0].id

// A Routine removed today can be completed again, without a duplicate award.
const undoOwner = await freshAccount()
const undoRoutine = await newQuest('routine', '{"kind":"DAILY"}', '{"STR":1}', '["One","Two"]')
const undoSteps = await query(
  `select id from public.routine_steps where quest_id='${undoRoutine}' order by ordinal`,
)
const tick = (step) =>
  query(`select public.record_routine_step('${undoRoutine}','${fixDay}','${step.id}')`)
for (const step of undoSteps) await tick(step)
const undone = (
  await query(`select id,version from public.quest_occurrences where quest_id='${undoRoutine}'`)
)[0]
await query(`select public.remove_quest_completion('${undone.id}',${undone.version})`)
assert.equal(
  (await query(`select * from public.routine_step_completions where occurrence_id='${undone.id}'`))
    .length,
  0,
)
assert.equal(
  (
    await query(
      `select before_snapshot from public.audit_events where target_id='${undone.id}' and change_type='completion_removed'`,
    )
  )[0].before_snapshot.completed_step_ids.length,
  2,
)
await tick(undoSteps[0])
assert.equal(
  (await query(`select status from public.quest_occurrences where id='${undone.id}'`))[0].status,
  'partial',
)
await tick(undoSteps[1])
const redone = (
  await query(
    `select stats,corrected_lifetime_xp from public.profiles where user_id='${undoOwner}'`,
  )
)[0]
assert.equal(redone.stats.STR, 1)
assert.equal(Number(redone.corrected_lifetime_xp), 150)

// Same-day awards replay in time order: +1 then -1 from zero always ends at zero.
for (let attempt = 0; attempt < 12; attempt++) {
  const owner = await freshAccount()
  const gain = await newQuest('standard', '{"kind":"DAILY"}', '{"STR":1}')
  const loss = await newQuest('standard', '{"kind":"DAILY"}', '{"STR":-1}')
  await query(`select public.record_quest('${gain}','${fixDay}')`)
  await pause()
  await query(`select public.record_quest('${loss}','${fixDay}')`)
  const result = (
    await query(`select stats,corrected_lifetime_xp from public.profiles where user_id='${owner}'`)
  )[0]
  assert.equal(result.stats.STR, 0)
  assert.equal(Number(result.corrected_lifetime_xp), 150)
}

// A corrected award keeps its place in the day instead of moving to the end.
const orderOwner = await freshAccount()
const firstGain = await newQuest('standard', '{"kind":"DAILY"}', '{"STR":1}')
const secondLoss = await newQuest('standard', '{"kind":"DAILY"}', '{"STR":-1}')
const pastDay = (await query(`select ('${fixDay}'::date-1)::text as day`))[0].day
await db.exec(`reset role; update public.quest_schedule_periods set active_from='${pastDay}'
 where owner_user_id='${orderOwner}'; set role authenticated`)
await query(`select public.record_quest('${firstGain}','${pastDay}')`)
await pause()
await query(`select public.record_quest('${secondLoss}','${pastDay}')`)
const firstOccurrence = (
  await query(`select id,version from public.quest_occurrences where quest_id='${firstGain}'`)
)[0]
await query(
  `select public.correct_quest_occurrence('${firstOccurrence.id}',${firstOccurrence.version},null,'${fixDay}')`,
)
await query(
  `select public.correct_quest_occurrence('${firstOccurrence.id}',${firstOccurrence.version + 1},null,'${pastDay}')`,
)
assert.equal(
  (await query(`select stats from public.profiles where user_id='${orderOwner}'`))[0].stats.STR,
  0,
)

// A completed one-time quest archives after rollover. A missed one stays, and a new one waits.
const onceOwner = await freshAccount()
const onceSpec = `{"kind":"ONCE","date":"${pastDay}"}`
const completedOnce = await newQuest('standard', onceSpec, '{"INT":1}')
const missedOnce = await newQuest('standard', onceSpec, '{"INT":1}')
const todayOnce = await newQuest('standard', `{"kind":"ONCE","date":"${fixDay}"}`, '{"INT":1}')
await db.exec(`reset role; update public.quest_schedule_periods set active_from='${pastDay}'
 where owner_user_id='${onceOwner}'; set role authenticated`)
await query(`select public.record_quest('${completedOnce}','${pastDay}')`)
await query(`select public.record_quest('${todayOnce}','${fixDay}')`)
await query(`select public.reconcile_closed_quests()`)
await query(`select public.reconcile_closed_quests()`)
const questState = async (id) =>
  (await query(`select state,version from public.quest_definitions where id='${id}'`))[0]
assert.deepEqual(await questState(completedOnce), { state: 'archived', version: 2 })
assert.equal((await questState(missedOnce)).state, 'active')
assert.equal((await questState(todayOnce)).state, 'active')
assert.equal(
  (
    await query(
      `select * from public.audit_events where target_id='${completedOnce}' and change_type='auto_archived'`,
    )
  ).length,
  1,
)
await rejects(`select public.change_quest_state('${completedOnce}','restore',2)`, '22023')

// Review fixes, 2026-11-10 ---------------------------------------------------------

// Reconciliation keeps a watermark: the second run scans nothing and inserts nothing.
assert.equal(
  (await query(`select last_reconciled_quest_day::text as day from public.profiles where user_id='${onceOwner}'`))[0].day,
  pastDay,
)
assert.equal((await query(`select public.reconcile_closed_quests() as n`))[0].n, 0)

// Today's Volatile choice can be corrected in place and stays streak-eligible.
const todayFixOwner = await freshAccount()
const todayVolatile = (
  await query(
    `select id from public.create_quest('volatile','Mood',null,'{"kind":"DAILY"}','{}','[{"label":"Yes","effects":{"STR":1}},{"label":"No","effects":{"STR":-1}}]',null)`,
  )
)[0].id
const todayOutcomes = await query(
  `select id from public.quest_outcomes where quest_id='${todayVolatile}' order by slot`,
)
await query(`select public.record_quest('${todayVolatile}','${fixDay}','${todayOutcomes[0].id}')`)
const todayOcc = (
  await query(`select id,version from public.quest_occurrences where quest_id='${todayVolatile}'`)
)[0]
await query(
  `select public.correct_quest_occurrence('${todayOcc.id}',${todayOcc.version},'${todayOutcomes[1].id}','${fixDay}')`,
)
const corrected = (
  await query(
    `select o.selected_outcome_id,e.config_snapshot from public.quest_occurrences o
     join public.reward_source_events e on e.source_id=o.id and e.valid where o.id='${todayOcc.id}'`,
  )
)
assert.equal(corrected.length, 1)
assert.equal(corrected[0].selected_outcome_id, todayOutcomes[1].id)
assert.equal(corrected[0].config_snapshot.streak_eligible, true)
assert.equal(
  (await query(`select current_length from public.streak_states where quest_id='${todayVolatile}'`))[0].current_length,
  1,
)
assert.equal(
  (await query(`select stats from public.profiles where user_id='${todayFixOwner}'`))[0].stats.STR,
  0,
)
// An activity date before the quest existed is rejected.
await rejects(
  `select public.correct_quest_occurrence('${todayOcc.id}',${todayOcc.version + 2},'${todayOutcomes[1].id}','2020-01-01')`,
  '22023',
)

// A routine step can be un-ticked until the parent is awarded.
const untickOwner = await freshAccount()
const untickRoutine = await newQuest('routine', '{"kind":"DAILY"}', '{"DIS":1}', '["A","B"]')
const untickSteps = await query(
  `select id from public.routine_steps where quest_id='${untickRoutine}' order by ordinal`,
)
await query(`select public.record_routine_step('${untickRoutine}','${fixDay}','${untickSteps[0].id}')`)
await query(`select public.unrecord_routine_step('${untickRoutine}','${fixDay}','${untickSteps[0].id}')`)
assert.equal(
  (await query(`select status from public.quest_occurrences where quest_id='${untickRoutine}'`))[0].status,
  'unreported',
)
await rejects(
  `select public.unrecord_routine_step('${untickRoutine}','${fixDay}','${untickSteps[0].id}')`,
  '22023',
)
for (const step of untickSteps)
  await query(`select public.record_routine_step('${untickRoutine}','${fixDay}','${step.id}')`)
await rejects(
  `select public.unrecord_routine_step('${untickRoutine}','${fixDay}','${untickSteps[1].id}')`,
  '22023',
)
assert.equal(
  (await query(`select stats from public.profiles where user_id='${untickOwner}'`))[0].stats.DIS,
  1,
)

// Hobby tasks: a plain task awards once ever, a repeatable task once per quest day.
const taskOwner = await freshAccount()
const taskHobby = (
  await query(
    `select id from public.create_hobby('Guitar',null,'{"INT":5}','[{"name":"Buy strings","effects":{"BNK":-1}},{"name":"Practice","effects":{"INT":1},"repeatable":true}]')`,
  )
)[0].id
const taskSteps = await query(
  `select id,repeatable,schedule_spec from public.hobby_steps where hobby_id='${taskHobby}' order by ordinal`,
)
assert.equal(taskSteps[0].repeatable, false)
assert.equal(taskSteps[1].repeatable, true)
assert.equal(taskSteps[0].schedule_spec.kind, 'TASK')
await query(`select public.complete_hobby_task('${taskSteps[0].id}')`)
await query(`select public.complete_hobby_task('${taskSteps[0].id}')`)
await query(`select public.complete_hobby_task('${taskSteps[1].id}')`)
await query(`select public.complete_hobby_task('${taskSteps[1].id}')`)
const taskEvents = async () =>
  (
    await query(
      `select count(*)::int as count from public.reward_source_events where owner_user_id='${taskOwner}' and source_type='hobby' and valid`,
    )
  )[0].count
assert.equal(await taskEvents(), 2)
const practice = (
  await query(`select id,version from public.hobby_occurrences where step_id='${taskSteps[1].id}'`)
)[0]
await query(`select public.correct_hobby_occurrence('${practice.id}',${practice.version},null,null,true)`)
assert.equal(await taskEvents(), 1)
await query(`select public.complete_hobby_task('${taskSteps[1].id}')`)
assert.equal(await taskEvents(), 2)
assert.equal(
  (await query(`select count(*)::int as count from public.hobby_occurrences where step_id='${taskSteps[1].id}'`))[0].count,
  1,
)
await rejects(
  `select public.correct_hobby_occurrence('${practice.id}',${practice.version + 2},'2020-01-01')`,
  '22023',
)
assert.equal(
  (await query(`select stats,corrected_lifetime_xp from public.profiles where user_id='${taskOwner}'`))[0].stats.INT,
  1,
)

// Un-ticking an archived To-Do root restores it without clearing its children.
await freshAccount()
const rootId = crypto.randomUUID(),
  childId = crypto.randomUUID()
await query(`select public.write_todo('create','${rootId}','Pack')`)
await query(`select public.write_todo('create','${childId}','Socks','${rootId}')`)
await query(`select public.write_todo('toggle','${childId}',null,null,true)`)
assert.equal(
  (await query(`select archived from public.todo_items where id='${rootId}'`))[0].archived,
  true,
)
await query(`select public.write_todo('toggle','${rootId}',null,null,false)`)
const todoRows = await query(
  `select id,done,archived from public.todo_items where id in ('${rootId}','${childId}')`,
)
assert.deepEqual(
  todoRows.find((row) => row.id === rootId),
  { id: rootId, done: false, archived: false },
)
assert.equal(todoRows.find((row) => row.id === childId).done, true)

await db.close()
console.log('RLS, idempotency, correction, monotonic level and owner isolation: passed')
