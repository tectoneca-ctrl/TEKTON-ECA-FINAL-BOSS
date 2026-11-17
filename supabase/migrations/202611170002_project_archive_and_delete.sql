-- Projects keep their linked operational, document, and finance history when archived.
update public.erp_module_definitions m
set fields = (
  select jsonb_agg(
    case
      when e.value->>'k' = 'status' and not coalesce(e.value->'options' @> '["Archived"]'::jsonb, false)
        then jsonb_set(e.value, '{options}', coalesce(e.value->'options', '[]'::jsonb) || '["Archived"]'::jsonb, true)
      else e.value
    end order by e.ordinality
  )
  from jsonb_array_elements(m.fields) with ordinality as e(value, ordinality)
) || case
  when exists (select 1 from jsonb_array_elements(m.fields) f where f->>'k' = 'statusBeforeArchive') then '[]'::jsonb
  else '[{"k":"statusBeforeArchive","label":"Status before archive","hidden":true,"type":"text"}]'::jsonb
end
where m.key = 'projects';

create function private.erp_project_archive_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  old_status text;
  new_status text;
  restore_status text;
begin
  new_status := new.payload->>'status';
  if tg_op = 'INSERT' then
    if new_status = 'Archived' then raise exception 'Create the project first, then archive it from the Admin Projects page'; end if;
    return new;
  end if;

  old_status := old.payload->>'status';
  if old_status = 'Archived' and new_status = 'Archived' then
    if new.payload is distinct from old.payload then raise exception 'Archived projects are read-only. Restore the project before editing it.'; end if;
    return new;
  end if;

  if old_status is distinct from new_status and (old_status = 'Archived' or new_status = 'Archived') then
    if private.erp_role() is distinct from 'admin' then raise exception 'Only Admin can archive or restore a project' using errcode='42501'; end if;
    if new_status = 'Archived' then
      new.payload := jsonb_set(new.payload, '{statusBeforeArchive}', to_jsonb(coalesce(old_status, 'Planning')), true);
    else
      restore_status := coalesce(nullif(old.payload->>'statusBeforeArchive', ''), 'Planning');
      if new_status is distinct from restore_status then raise exception 'Restore this project to its previous status: %', restore_status; end if;
      new.payload := jsonb_set(new.payload, '{statusBeforeArchive}', '""'::jsonb, true);
    end if;
  end if;
  return new;
end $$;

create trigger erp_project_archive_guard
before insert or update on public.erp_projects
for each row execute function private.erp_project_archive_guard();

create function private.erp_record_archive_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  target_project text;
  project_status text;
begin
  if tg_op = 'DELETE' then
    target_project := old.project;
    if target_project is not null then
      select p.payload->>'status' into project_status from public.erp_projects p where p.code = target_project for update;
      if project_status = 'Archived' then raise exception 'This project is archived. Restore it before removing linked records.'; end if;
    end if;
    return old;
  end if;

  target_project := new.project;
  if target_project is not null then
    select p.payload->>'status' into project_status from public.erp_projects p where p.code = target_project for update;
    if project_status = 'Archived' then raise exception 'This project is archived. Restore it before adding or moving records.'; end if;
  end if;

  if tg_op = 'UPDATE' and old.project is not null and new.project is not distinct from old.project then
    select p.payload->>'status' into project_status from public.erp_projects p where p.code = old.project for update;
    if project_status = 'Archived' then raise exception 'This project is archived. Restore it before changing linked records.'; end if;
  end if;
  return new;
end $$;

create trigger erp_record_archive_guard
before insert or update or delete on public.erp_records
for each row execute function private.erp_record_archive_guard();

create function private.erp_profile_project_archive_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
declare project_status text;
begin
  if tg_op = 'INSERT' then
    if new.project is not null then
      select p.payload->>'status' into project_status from public.erp_projects p where p.code = new.project for update;
      if not found then raise exception 'Choose an existing project for this user.'; end if;
      if project_status = 'Archived' then raise exception 'Cannot assign a user to an archived project. Restore it first.'; end if;
    end if;
    if new.finance_view_project is not null and new.finance_view_project <> 'all' then
      select p.payload->>'status' into project_status from public.erp_projects p where p.code = new.finance_view_project for update;
      if not found then raise exception 'Choose an existing project for Finance access.'; end if;
      if project_status = 'Archived' then raise exception 'Cannot grant new Finance access to an archived project. Restore it first.'; end if;
    end if;
    return new;
  end if;

  if new.project is distinct from old.project and new.project is not null then
    select p.payload->>'status' into project_status from public.erp_projects p where p.code = new.project for update;
    if not found then raise exception 'Choose an existing project for this user.'; end if;
    if project_status = 'Archived' then raise exception 'Cannot assign a user to an archived project. Restore it first.'; end if;
  end if;
  if new.finance_view_project is distinct from old.finance_view_project and new.finance_view_project is not null and new.finance_view_project <> 'all' then
    select p.payload->>'status' into project_status from public.erp_projects p where p.code = new.finance_view_project for update;
    if not found then raise exception 'Choose an existing project for Finance access.'; end if;
    if project_status = 'Archived' then raise exception 'Cannot grant new Finance access to an archived project. Restore it first.'; end if;
  end if;
  return new;
end $$;

create trigger erp_profile_project_archive_guard
before insert or update on public.erp_profiles
for each row execute function private.erp_profile_project_archive_guard();

-- Dedicated hard-delete operation: require an administrator, a current version, and zero references.
create function public.erp_delete_project(target_id uuid, expected_version integer) returns void
language plpgsql security definer set search_path = '' as $$
declare
  target_code text;
  current_version integer;
  refs text;
  assigned_users integer;
begin
  if private.erp_role() is distinct from 'admin' then raise exception 'Admin access required' using errcode='42501'; end if;
  select p.code, p.version into target_code, current_version
  from public.erp_projects p where p.id = target_id for update;
  if target_code is null then raise exception 'Project not found'; end if;
  if current_version is distinct from expected_version then raise exception 'Project changed. Refresh and try again.' using errcode='40001'; end if;

  select string_agg(format('%s (%s)', ref.module, ref.total), ', ' order by ref.module)
  into refs from (
    select r.module, count(*) as total
    from public.erp_records r where r.project = target_code group by r.module
  ) ref;
  select count(*) into assigned_users from public.erp_profiles u
  where u.project = target_code or u.finance_view_project = target_code;

  if refs is not null or assigned_users > 0 then
    raise exception 'Cannot permanently delete %: linked records remain (%). User assignments: %. Reassign or remove references first, or archive the project.',
      target_code, coalesce(refs, 'none'), assigned_users;
  end if;
  delete from public.erp_projects where id = target_id;
end $$;

-- Prevent the older generic mutation endpoint from bypassing the empty-project check.
create or replace function public.erp_mutate(operations jsonb, request_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare op jsonb; previous jsonb;
begin
  if private.erp_role() is null then raise exception 'No active account' using errcode='42501'; end if;
  if jsonb_typeof(operations) <> 'array' or jsonb_array_length(operations) not between 1 and 300 or request_id is null then raise exception 'Invalid batch'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text || request_id::text, 0));
  select r.operations into previous from private.erp_requests r where actor = auth.uid() and r.request_id = erp_mutate.request_id;
  if previous is not null then
    if previous <> operations then raise exception 'Request ID was reused with different data'; end if;
    return jsonb_build_object('saved', true);
  end if;
  for op in select * from jsonb_array_elements(operations) loop
    if op->>'module' = 'projects' and op->>'action' = 'delete' then
      raise exception 'Use the guarded permanent-delete operation for projects';
    elsif op->>'action' = 'decide' then
      perform private.erp_decide((op->>'id')::uuid, op->'data'->>'status', (op->>'version')::integer);
    elsif op->>'action' = 'pay_invoice' then
      perform private.erp_pay_invoice((op->>'id')::uuid, (op->>'version')::integer);
    elsif op->>'action' = 'generate_payroll' then
      perform private.erp_generate_payroll(op->'data'->>'from', op->'data'->>'to');
    else
      perform private.erp_write(op);
    end if;
  end loop;
  insert into private.erp_requests(actor, request_id, operations) values(auth.uid(), request_id, operations);
  return jsonb_build_object('saved', true);
end $$;

revoke all on function public.erp_delete_project(uuid, integer) from public, anon;
grant execute on function public.erp_delete_project(uuid, integer) to authenticated;
