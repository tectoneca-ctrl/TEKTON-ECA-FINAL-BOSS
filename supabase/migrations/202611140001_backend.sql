-- Single-company ERP. Browser clients have SELECT access through RLS only.
-- Every write uses a validated transactional RPC; Auth secrets never enter these tables.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create table public.erp_module_definitions (
  key text primary key, fields jsonb not null,
  readers text[] not null, writers text[] not null
);
create table public.erp_projects (
  id uuid primary key default gen_random_uuid(),
  payload jsonb not null,
  code text generated always as (payload->>'code') stored unique not null,
  version integer not null default 1,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  check (code ~ '^[A-Za-z0-9._-]+$')
);
create unique index erp_project_code_ci on public.erp_projects(lower(code));
create table public.erp_profiles (
  id bigint generated always as identity primary key,
  auth_id uuid not null unique references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 150),
  email text not null,
  role text not null check (role in ('admin','assistant_manager','site_supervisor','foreman','client','documents','budget','asset','hr','finance')),
  project text references public.erp_projects(code),
  finance_view_project text,
  avatar text,
  disabled boolean not null default false,
  check (finance_view_project is null or role = 'documents')
);
create table public.erp_records (
  id uuid primary key default gen_random_uuid(),
  module text not null references public.erp_module_definitions(key),
  project text references public.erp_projects(code),
  employee_id uuid references public.erp_records(id),
  payload jsonb not null,
  version integer not null default 1,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  check (module <> 'projects')
);
create index erp_records_module_project on public.erp_records(module, project);
create unique index erp_employee_name on public.erp_records(lower(payload->>'name')) where module = 'employees';
create unique index erp_attendance_day on public.erp_records(project, (payload->>'worker'), (payload->>'date')) where module = 'attendance';
create unique index erp_payroll_period on public.erp_records((payload->>'employee'), (payload->>'period')) where module = 'payroll';
create unique index erp_invoice_number on public.erp_records(lower(payload->>'invoice')) where module = 'billing';
create unique index erp_linked_approval on public.erp_records((payload->>'module'), (payload->>'refId')) where module = 'approvals';
create unique index erp_checklist_item on public.erp_records(project, (payload->>'section'), (payload->>'label'), (payload->>'out')) where module = 'checklist';
create table public.erp_settings (
  id boolean primary key default true check(id),
  version integer not null default 1,
  company text not null default 'Tekton ECA Construction',
  vat numeric not null default 12 check(vat between 0 and 100),
  markup numeric not null default 15 check(markup between 0 and 100),
  retention numeric not null default 10 check(retention between 0 and 100)
);
insert into public.erp_settings(id) values(true);
create table public.erp_audit (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(), actor uuid, actor_name text not null,
  message text not null, before_data jsonb, after_data jsonb
);
create table private.erp_requests (
  actor uuid not null, request_id uuid not null, operations jsonb not null,
  created_at timestamptz not null default now(), primary key(actor, request_id)
);

create function private.erp_role() returns text language sql stable security definer set search_path = '' as $$
  select role from public.erp_profiles where auth_id = auth.uid() and not disabled
$$;
create function private.erp_project_access(code text) returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select case when role in ('client','foreman','site_supervisor')
    then project is not null and project = code else true end
    from public.erp_profiles where auth_id = auth.uid() and not disabled), false)
$$;
create function private.erp_can_read(mod text, code text, body jsonb) returns boolean language sql stable security definer set search_path = '' as $$
  select private.erp_project_access(code) and
    (private.erp_role() = 'admin' or exists(
      select 1 from public.erp_module_definitions where key = mod and private.erp_role() = any(readers)
    )) and (private.erp_role() <> 'client' or mod <> 'documents' or body->>'status' = 'Approved')
$$;
create function private.erp_can_write(mod text, code text) returns boolean language sql stable security definer set search_path = '' as $$
  select private.erp_project_access(code) and (private.erp_role() = 'admin' or exists(
    select 1 from public.erp_module_definitions where key = mod and private.erp_role() = any(writers)
  ))
$$;
create function private.erp_audit_write() returns trigger language plpgsql security definer set search_path = '' as $$
declare target text;
begin
  target := coalesce(to_jsonb(new)->>'id', to_jsonb(old)->>'id', '');
  insert into public.erp_audit(actor, actor_name, message, before_data, after_data)
  values(auth.uid(), coalesce((select name from public.erp_profiles where auth_id=auth.uid()), 'System'),
    tg_op || ' ' || tg_table_name || ' ' || target, to_jsonb(old)-'avatar', to_jsonb(new)-'avatar');
  if tg_op = 'DELETE' then return old; else return new; end if;
end $$;
create trigger audit_projects after insert or update or delete on public.erp_projects for each row execute function private.erp_audit_write();
create trigger audit_records after insert or update or delete on public.erp_records for each row execute function private.erp_audit_write();
create trigger audit_profiles after insert or update or delete on public.erp_profiles for each row execute function private.erp_audit_write();
create trigger audit_settings after update on public.erp_settings for each row execute function private.erp_audit_write();

alter table public.erp_module_definitions enable row level security;
alter table public.erp_projects enable row level security;
alter table public.erp_profiles enable row level security;
alter table public.erp_records enable row level security;
alter table public.erp_settings enable row level security;
alter table public.erp_audit enable row level security;
create policy modules_read on public.erp_module_definitions for select to authenticated using (private.erp_role() is not null);
create policy projects_read on public.erp_projects for select to authenticated using (private.erp_project_access(code));
create policy profiles_read on public.erp_profiles for select to authenticated using (
  private.erp_role() is not null and (auth_id=auth.uid() or private.erp_role()='admin')
);
create policy records_read on public.erp_records for select to authenticated using (private.erp_can_read(module,project,payload));
create policy settings_read on public.erp_settings for select to authenticated using (private.erp_role() is not null);
create policy audit_read on public.erp_audit for select to authenticated using (private.erp_role()='admin');
revoke all on public.erp_module_definitions, public.erp_projects, public.erp_profiles, public.erp_records, public.erp_settings, public.erp_audit from anon, authenticated;
grant select on public.erp_module_definitions, public.erp_projects, public.erp_profiles, public.erp_records, public.erp_settings, public.erp_audit to authenticated;
grant all on public.erp_profiles to service_role;
grant select on public.erp_projects to service_role;
grant insert on public.erp_audit to service_role;
grant usage,select on sequence public.erp_audit_id_seq to service_role;
grant usage,select on sequence public.erp_profiles_id_seq to service_role;

create function private.erp_validate(mod text, body jsonb) returns void language plpgsql set search_path = '' as $$
declare specs jsonb; f jsonb; v text; k text; first_key text; extra text[] := '{}';
begin
  select fields into specs from public.erp_module_definitions where key=mod;
  if specs is null or jsonb_typeof(body) <> 'object' then raise exception 'Unknown module or invalid record'; end if;
  if mod='documents' then extra := array['fileId','fileName','size','mime','by','date']; end if;
  if mod='payments' then extra := array['invoiceId']; end if;
  if mod='payroll' then extra := array['from','to']; end if;
  for k in select jsonb_object_keys(body) loop
    if not exists(select 1 from jsonb_array_elements(specs) s where s->>'k'=k) and not k=any(extra) then
      raise exception 'Unknown field: %', k;
    end if;
    if jsonb_typeof(body->k) <> 'string' or length(body->>k)>5000 then raise exception 'Invalid text field: %',k; end if;
  end loop;
  first_key := specs->0->>'k';
  if mod not in ('checklist','templates') and nullif(trim(body->>first_key),'') is null then raise exception '% is required', first_key; end if;
  for f in select * from jsonb_array_elements(specs) loop
    v := body->>(f->>'k');
    if f->>'type'='select' and not coalesce((f->'options') ? v,false) then raise exception 'Invalid % value', f->>'k'; end if;
    if f->>'type'='project' and mod<>'employees' and nullif(v,'') is null then raise exception 'Choose a project'; end if;
    if f->>'type'='number' then
      if v is null or v !~ '^[0-9]+([.][0-9]+)?$' or v::numeric>1000000000000 then raise exception 'Invalid number: %',f->>'k'; end if;
    end if;
    if f->>'type'='date' and coalesce(v,'')<>'' then
      if v !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then raise exception 'Invalid date'; end if;
      perform v::date;
    end if;
  end loop;
  if mod='progress' and (body->>'percent')::numeric>100 then raise exception 'Progress must be 0 to 100'; end if;
  if mod='attendance' and ((body->>'days')::numeric>1 or (body->>'ot')::numeric>24 or nullif(body->>'date','') is null) then raise exception 'Invalid attendance'; end if;
  if mod='leaves' and (nullif(body->>'from','') is null or nullif(body->>'to','') is null or body->>'from'>body->>'to') then raise exception 'Invalid leave dates'; end if;
  if mod='checklist' and (nullif(body->>'section','') is null or (body->>'outStatus'='Out' and nullif(body->>'out','') is null)) then raise exception 'Invalid checklist row'; end if;
  if mod='documents' and nullif(body->>'fileId','') is not null and
     (coalesce(body->>'size','') !~ '^[0-9]+$' or (body->>'size')::bigint>26214400 or coalesce(body->>'fileName','') !~* '[.](pdf|png|jpe?g|docx?|xlsx?|dwg|dxf)$') then raise exception 'Invalid attachment'; end if;
end $$;

create function private.erp_write(op jsonb) returns void language plpgsql security definer set search_path = '' as $$
declare
  mod text := op->>'module'; action text := op->>'action'; rid uuid := (op->>'id')::uuid;
  old_body jsonb; body jsonb; code text; old_code text; employee uuid; old_version integer;
  old_creator uuid; role_name text := private.erp_role(); employee_name text;
  t record; approval_type text; approval_label text;
begin
  if role_name is null then raise exception 'Account is not active' using errcode='42501'; end if;
  if action is null or mod is null or rid is null or action not in ('insert','update','delete') then raise exception 'Unknown operation'; end if;
  if mod='projects' then
    select p.payload,p.code,p.version,p.created_by into old_body,old_code,old_version,old_creator from public.erp_projects p where p.id=rid for update;
  else
    select payload,project,version,created_by into old_body,old_code,old_version,old_creator from public.erp_records where id=rid and module=mod for update;
  end if;
  if action='insert' and old_body is not null then raise exception 'Record already exists'; end if;
  if action<>'insert' and old_body is null then raise exception 'Record not found'; end if;
  if action<>'insert' and (op->>'version')::integer is distinct from old_version then raise exception 'Record changed. Refresh and try again.' using errcode='40001'; end if;
  body := case when action='insert' then coalesce(op->'data','{}') else old_body || coalesce(op->'data','{}') end;
  code := case when mod='projects' then body->>'code' else nullif(body->>'project','') end;
  if mod in ('payroll','leaves','cashadvance','attendance') then
    employee_name := coalesce(body->>'employee',body->>'worker');
    select id,project into employee,code from public.erp_records where module='employees' and payload->>'name'=employee_name;
    if employee is null then raise exception 'Choose a valid employee'; end if;
    if mod='attendance' and code is distinct from body->>'project' then raise exception 'Worker is not assigned to this project'; end if;
  end if;
  if not private.erp_can_write(mod,code) or (old_body is not null and not private.erp_can_write(mod,old_code)) then
    raise exception 'You do not have permission for this action' using errcode='42501';
  end if;
  if mod='approvals' then raise exception 'Use the approval decision action'; end if;
  if mod='projects' and action='update' and body->>'code' is distinct from old_body->>'code' then raise exception 'Site ID cannot change'; end if;
  if mod='employees' and action='update' and
     (body->>'name' is distinct from old_body->>'name' or code is distinct from old_code) and
     exists(select 1 from public.erp_records where employee_id=rid) then raise exception 'Employee has linked records; name and project cannot change'; end if;
  if mod='attendance' and role_name='foreman' and (body->>'status'<>'Pending' or old_body->>'status'='Approved') then raise exception 'Approved attendance is locked'; end if;
  if mod in ('purchases','transfers','cashadvance') then
    if action='insert' and body->>'status'<>'Pending' then raise exception 'New requests must be Pending'; end if;
    if action='update' and body->>'status' is distinct from old_body->>'status' then
      if not (old_body->>'status'='Approved' and
        (mod='purchases' and body->>'status'='Received' or mod='transfers' and body->>'status'='Done' or mod='cashadvance' and body->>'status'='Released' and role_name in ('admin','finance'))) then
        raise exception 'Approval is required before this status change';
      end if;
      if (body-'status') is distinct from (old_body-'status') then raise exception 'Approved request details are locked'; end if;
    elsif old_body->>'status' in ('Approved','Received','Done','Released') and action<>'insert' then
      raise exception 'Approved request details are locked';
    end if;
  end if;
  if mod='payroll' then
    if role_name='finance' and not (action='update' and old_body->>'status'='Approved' and body->>'status'='Paid' and (body-'status')=(old_body-'status')) then raise exception 'Finance may only release approved payroll'; end if;
    if action<>'insert' and old_body->>'status'='Approved' and not (action='update' and body->>'status'='Paid') then raise exception 'Approved payroll is locked'; end if;
    if action='insert' and body->>'status'<>'Draft' then raise exception 'New payroll must be Draft'; end if;
    if action<>'insert' and old_body->>'status'='Paid' then raise exception 'Paid payroll is locked'; end if;
    if body->>'status'='Approved' and role_name not in ('admin','hr') then raise exception 'HR approval required'; end if;
    if body->>'status'='Paid' and (role_name not in ('admin','finance') or old_body->>'status'<>'Approved') then raise exception 'Only Finance can release approved payroll'; end if;
    if action='update' and old_body->>'status'='Approved' and (body-'status') is distinct from (old_body-'status') then raise exception 'Approved payroll details are locked'; end if;
  end if;
  if mod='billing' and (body->>'status'='Paid' or old_body->>'status'='Paid') then raise exception 'Use Mark paid to record the collection'; end if;
  if mod='payments' and action<>'insert' then raise exception 'Posted collections are immutable; contact Admin for a correction'; end if;
  if mod='payments' and body ? 'invoiceId' then raise exception 'Use Mark paid for invoice collections'; end if;
  if mod='documents' and body->>'status'='Approved' and nullif(body->>'fileId','') is null then raise exception 'Upload a file before approving this document'; end if;
  if mod='documents' and action='update' and body->>'fileId' is distinct from old_body->>'fileId' and nullif(old_body->>'fileId','') is not null then raise exception 'Upload a new document for revisions'; end if;
  if action='delete' then
    if mod='projects' then
      delete from public.erp_records where module='checklist' and project=old_code;
      delete from public.erp_projects where id=rid; -- FKs block removing sites that still have records/users.
    else
      if mod in ('purchases','transfers','cashadvance') then
        delete from public.erp_records where module='approvals' and payload->>'refId'=rid::text;
      end if;
      delete from public.erp_records where id=rid;
    end if;
    return;
  end if;
  if mod='documents' then
    body := body || case when action='insert' then jsonb_build_object('by',(select name from public.erp_profiles where auth_id=auth.uid()),'date',(now() at time zone 'Asia/Manila')::date::text) else jsonb_build_object('by',old_body->>'by','date',old_body->>'date') end;
  end if;
  perform private.erp_validate(mod,body);
  if mod='documents' and nullif(body->>'fileId','') is not null then
    if split_part(body->>'fileId','/',1) is distinct from code or split_part(body->>'fileId','/',2)<>rid::text or
      not exists(select 1 from storage.objects where bucket_id='erp-documents' and name=body->>'fileId') then raise exception 'Attachment upload is incomplete'; end if;
  end if;
  if mod='checklist' and body->>'outStatus'='Out' then
    if (nullif(body->>'label','') is not null and body->>'status'<>'Done') or
      (coalesce(body->>'label','')='' and exists(select 1 from public.erp_records where module='checklist' and project=code and payload->>'section'=body->>'section' and coalesce(payload->>'label','')<>'' and payload->>'status'<>'Done')) then
      raise exception 'Complete the required documents before releasing OUT';
    end if;
  end if;
  if mod='projects' then
    if action='insert' then
      insert into public.erp_projects(id,payload,created_by) values(rid,body,auth.uid());
      for t in select payload from public.erp_records where module='templates' and payload->>'type'=body->>'type' loop
        insert into public.erp_records(module,project,payload,created_by) values('checklist',code,
          (t.payload-'type') || jsonb_build_object('project',code,'status','Pending','date','','remarks','','outStatus','Pending','outDate',''),auth.uid());
      end loop;
    else update public.erp_projects set payload=body,version=version+1 where id=rid; end if;
  else
    if action='insert' then
      insert into public.erp_records(id,module,project,employee_id,payload,created_by) values(rid,mod,code,employee,body,auth.uid());
      if mod in ('purchases','transfers','cashadvance') then
        approval_type := case mod when 'purchases' then 'Purchase' when 'transfers' then 'Transfer' else 'Cash advance' end;
        approval_label := coalesce(body->>'item',body->>'asset',body->>'worker');
        insert into public.erp_records(module,project,payload,created_by) values('approvals',code,
          jsonb_build_object('request',approval_type||': '||approval_label,'by',(select name from public.erp_profiles where auth_id=auth.uid()),
          'type',approval_type,'status','Pending','module',mod,'refId',rid::text),auth.uid());
      end if;
    else
      update public.erp_records set payload=body,project=code,employee_id=employee,version=version+1 where id=rid;
      if mod in ('purchases','transfers','cashadvance') and body->>'status'='Pending' then
        update public.erp_records set version=version+1 where module='approvals' and payload->>'refId'=rid::text;
      end if;
    end if;
  end if;
end $$;

create function private.erp_decide(rid uuid, decision text, expected integer) returns void language plpgsql security definer set search_path = '' as $$
declare a public.erp_records; linked public.erp_records;
begin
  if private.erp_role()<>'admin' or private.erp_role() is null then raise exception 'Admin approval required' using errcode='42501'; end if;
  if decision is null or decision not in ('Approved','Rejected') then raise exception 'Invalid decision'; end if;
  select * into a from public.erp_records where id=rid and module='approvals' for update;
  if a.id is null or a.version is distinct from expected or a.payload->>'status'<>'Pending' then raise exception 'Approval is no longer pending. Refresh.'; end if;
  if a.created_by=auth.uid() then raise exception 'Another admin must approve your own request'; end if;
  select * into linked from public.erp_records where id=(a.payload->>'refId')::uuid and module=a.payload->>'module' for update;
  if linked.id is null or linked.payload->>'status'<>'Pending' then raise exception 'Linked request is no longer pending'; end if;
  update public.erp_records set payload=payload||jsonb_build_object('status',decision),version=version+1 where id in (a.id, linked.id);
end $$;

create function private.erp_pay_invoice(rid uuid, expected integer) returns void language plpgsql security definer set search_path = '' as $$
declare invoice public.erp_records; client_name text;
begin
  if coalesce(private.erp_role(),'') not in ('admin','finance') then raise exception 'Finance access required' using errcode='42501'; end if;
  select * into invoice from public.erp_records where id=rid and module='billing' for update;
  if invoice.id is null or invoice.version is distinct from expected or invoice.payload->>'status' not in ('Sent','Overdue') then raise exception 'Invoice changed or already paid. Refresh.'; end if;
  select payload->>'client' into client_name from public.erp_projects where code=invoice.project;
  insert into public.erp_records(module,project,payload,created_by) values('payments',invoice.project,
    jsonb_build_object('client',client_name,'project',invoice.project,'amount',invoice.payload->>'amount','date',(now() at time zone 'Asia/Manila')::date::text,'method','Bank','invoiceId',rid::text),auth.uid());
  update public.erp_records set payload=payload||'{"status":"Paid"}',version=version+1 where id=rid;
end $$;

create function public.erp_finance_summary() returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'code',p.code,'name',p.payload->>'name','site',p.payload->>'site','budget',coalesce((p.payload->>'budget')::numeric,0),
    'spent',a.spent,'billed',a.billed,'collected',a.collected,'balance',greatest(0,a.billed-a.collected),'overdue',a.overdue
  )),'[]') from public.erp_projects p
  join public.erp_profiles u on u.auth_id=auth.uid() and not u.disabled and u.role='documents'
    and (u.finance_view_project='all' or u.finance_view_project=p.code)
  cross join lateral (
    select
      coalesce(sum((payload->>'amount')::numeric) filter(where module='expenses' or module='purchases' and payload->>'status' in ('Approved','Received')),0) spent,
      coalesce(sum((payload->>'amount')::numeric) filter(where module='billing' and payload->>'status'<>'Draft'),0) billed,
      coalesce(sum((payload->>'amount')::numeric) filter(where module='payments'),0) collected,
      count(*) filter(where module='billing' and payload->>'status'='Overdue') overdue
    from public.erp_records where project=p.code and module in ('expenses','purchases','billing','payments')
  ) a
$$;
create function public.erp_snapshot() returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare result jsonb;
begin
  if private.erp_role() is null then raise exception 'No active ERP account. Ask Admin for access.' using errcode='42501'; end if;
  select jsonb_build_object(
    'meId',(select id from public.erp_profiles where auth_id=auth.uid()),
    'users',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'email',email,'role',role,'project',project,'financeViewProject',finance_view_project,'avatar',avatar,'password','')) from public.erp_profiles where not disabled),'[]'),
    'data',coalesce((select jsonb_object_agg(module,rows) from (
      select module,jsonb_agg(payload||jsonb_build_object('id',id::text,'_version',version::text) order by created_at desc,id) rows
      from public.erp_records group by module
    ) t),'{}') || jsonb_build_object('projects',coalesce((select jsonb_agg(payload||jsonb_build_object('id',id::text,'_version',version::text) order by code) from public.erp_projects),'[]')),
    'settings',(select to_jsonb(s)-'id' from public.erp_settings s where id),
    'log',coalesce((select jsonb_agg(jsonb_build_object('at',at,'by',actor_name,'msg',message) order by id desc) from (select * from public.erp_audit order by id desc limit 200) a),'[]'),
    'readableModules',coalesce((select jsonb_agg(key) from public.erp_module_definitions where private.erp_role()='admin' or private.erp_role()=any(readers)),'[]'),
    'financeSummary',public.erp_finance_summary()
  ) into result;
  return result;
end $$;

create function private.erp_generate_payroll(date_from text, date_to text) returns void language plpgsql security definer set search_path = '' as $$
declare e public.erp_records; gross numeric; period_name text;
begin
  if coalesce(private.erp_role(),'') not in ('admin','hr') then raise exception 'HR access required' using errcode='42501'; end if;
  if date_from is null or date_to is null or date_from::date>date_to::date or date_to::date-date_from::date>366 then raise exception 'Invalid payroll period'; end if;
  period_name := date_from || ' to ' || date_to;
  perform pg_advisory_xact_lock(hashtextextended('payroll:'||period_name,0));
  for e in select * from public.erp_records where module='employees' and payload->>'status'='Active' loop
    if exists(select 1 from public.erp_records where module='payroll' and employee_id=e.id and payload->>'period'=period_name) then continue; end if;
    select round(coalesce(sum((payload->>'days')::numeric * (e.payload->>'rate')::numeric +
      (payload->>'ot')::numeric * ((e.payload->>'rate')::numeric/8) * 1.25),0)) into gross
      from public.erp_records where module='attendance' and employee_id=e.id and payload->>'status'='Approved'
        and (payload->>'date')::date between date_from::date and date_to::date;
    if gross>0 then
      insert into public.erp_records(module,project,employee_id,payload,created_by) values('payroll',e.project,e.id,
        jsonb_build_object('employee',e.payload->>'name','period',period_name,'gross',gross::text,'deductions','0','status','Draft','from',date_from,'to',date_to),auth.uid());
    end if;
  end loop;
end $$;

create function public.erp_mutate(operations jsonb, request_id uuid) returns jsonb language plpgsql security definer set search_path = '' as $$
declare op jsonb; previous jsonb; result jsonb;
begin
  if private.erp_role() is null then raise exception 'No active account' using errcode='42501'; end if;
  if jsonb_typeof(operations)<>'array' or jsonb_array_length(operations) not between 1 and 300 or request_id is null then raise exception 'Invalid batch'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||request_id::text,0));
  select r.operations into previous from private.erp_requests r where actor=auth.uid() and r.request_id=erp_mutate.request_id;
  if previous is not null then
    if previous<>operations then raise exception 'Request ID was reused with different data'; end if;
    return jsonb_build_object('saved',true);
  end if;
  for op in select * from jsonb_array_elements(operations) loop
    if op->>'action'='decide' then perform private.erp_decide((op->>'id')::uuid,op->'data'->>'status',(op->>'version')::integer);
    elsif op->>'action'='pay_invoice' then perform private.erp_pay_invoice((op->>'id')::uuid,(op->>'version')::integer);
    elsif op->>'action'='generate_payroll' then perform private.erp_generate_payroll(op->'data'->>'from',op->'data'->>'to');
    else perform private.erp_write(op); end if;
  end loop;
  insert into private.erp_requests(actor,request_id,operations) values(auth.uid(),request_id,operations);
  return jsonb_build_object('saved',true);
end $$;

create function public.erp_update_profile(patch jsonb) returns void language plpgsql security definer set search_path = '' as $$
begin
  if private.erp_role() is null or exists(select 1 from jsonb_object_keys(patch) k where k not in ('name','avatar')) then raise exception 'Invalid profile update'; end if;
  if length(coalesce(patch->>'avatar',''))>500000 or (nullif(patch->>'avatar','') is not null and patch->>'avatar' !~ '^data:image/(png|jpeg|webp);base64,') then raise exception 'Invalid profile photo'; end if;
  update public.erp_profiles set name=coalesce(patch->>'name',name),avatar=case when patch?'avatar' then nullif(patch->>'avatar','') else avatar end where auth_id=auth.uid();
end $$;
create function public.erp_update_settings(patch jsonb) returns void language plpgsql security definer set search_path = '' as $$
begin
  if private.erp_role() is distinct from 'admin' then raise exception 'Admin access required' using errcode='42501'; end if;
  if nullif(trim(patch->>'company'),'') is null or length(patch->>'company')>150 then raise exception 'Company name is required'; end if;
  perform 1 from public.erp_settings where id for update;
  if (patch->>'version')::integer is distinct from (select version from public.erp_settings where id) then raise exception 'Settings changed. Refresh and try again.' using errcode='40001'; end if;
  update public.erp_settings set company=patch->>'company',vat=(patch->>'vat')::numeric,markup=(patch->>'markup')::numeric,retention=(patch->>'retention')::numeric,version=version+1 where id;
end $$;
create function public.erp_admin_profile(target_id bigint, patch jsonb) returns void language plpgsql security definer set search_path = '' as $$
declare target public.erp_profiles; scope text;
begin
  if private.erp_role() is distinct from 'admin' then raise exception 'Admin access required' using errcode='42501'; end if;
  select * into target from public.erp_profiles where id=target_id for update;
  if target.id is null or target.auth_id=auth.uid() then raise exception 'Cannot change your own access'; end if;
  if exists(select 1 from jsonb_object_keys(patch) k where k not in ('role','project','finance_view_project','disabled')) then raise exception 'Invalid access update'; end if;
  scope := case when patch?'finance_view_project' then nullif(patch->>'finance_view_project','') else target.finance_view_project end;
  if scope is not null and scope<>'all' and not exists(select 1 from public.erp_projects where code=scope) then raise exception 'Invalid finance scope'; end if;
  update public.erp_profiles set role=coalesce(patch->>'role',role),
    project=case when patch?'project' then nullif(patch->>'project','') else project end,
    finance_view_project=case when coalesce(patch->>'role',role)='documents' then scope else null end,
    disabled=coalesce((patch->>'disabled')::boolean,disabled)
  where id=target_id;
end $$;

-- Private, project-scoped storage. The document metadata must exist before upload.
insert into storage.buckets(id,name,public,file_size_limit) values('erp-documents','erp-documents',false,26214400)
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit;
create function private.erp_file_read(path text) returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.erp_records where module='documents' and payload->>'fileId'=path
    and private.erp_can_read(module,project,payload))
$$;
create function private.erp_file_upload(path text) returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.erp_records where module='documents' and id::text=split_part(path,'/',2)
    and project=split_part(path,'/',1) and created_by=auth.uid() and private.erp_can_write('documents',project)
    and nullif(payload->>'fileId','') is null)
$$;
create policy erp_files_read on storage.objects for select to authenticated using(bucket_id='erp-documents' and (private.erp_file_read(name) or (private.erp_can_write('documents',split_part(name,'/',1)) and not exists(select 1 from public.erp_records where module='documents' and payload->>'fileId'=name))));
create policy erp_files_insert on storage.objects for insert to authenticated with check(bucket_id='erp-documents' and private.erp_file_upload(name));
create policy erp_files_delete on storage.objects for delete to authenticated using(bucket_id='erp-documents' and private.erp_can_write('documents',split_part(name,'/',1))
  and not exists(select 1 from public.erp_records where module='documents' and payload->>'fileId'=name));

revoke all on all functions in schema private from public,anon,authenticated;
grant execute on function private.erp_role(), private.erp_project_access(text),private.erp_can_read(text,text,jsonb),private.erp_can_write(text,text),private.erp_file_read(text),private.erp_file_upload(text) to authenticated;
revoke all on function public.erp_snapshot(),public.erp_mutate(jsonb,uuid),public.erp_finance_summary(),public.erp_update_profile(jsonb),public.erp_update_settings(jsonb),public.erp_admin_profile(bigint,jsonb) from public,anon;
grant execute on function public.erp_snapshot(),public.erp_mutate(jsonb,uuid),public.erp_finance_summary(),public.erp_update_profile(jsonb),public.erp_update_settings(jsonb),public.erp_admin_profile(bigint,jsonb) to authenticated;
