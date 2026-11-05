-- All activity/configuration mutations now pass through audited owner-checked RPCs.
revoke insert(owner_user_id,type,name,description,schedule_spec,effects,state),
 update(name,description,schedule_spec,effects,state,version,updated_at)
 on public.quest_definitions from authenticated;
revoke insert(owner_user_id,name,description,state,finish_effects),
 update(name,description,state,finish_effects,version)
 on public.hobbies from authenticated;
revoke insert(owner_user_id,parent_id,title,done,archived,position),
 update(title,done,archived,deleted,position), delete
 on public.todo_items from authenticated;
